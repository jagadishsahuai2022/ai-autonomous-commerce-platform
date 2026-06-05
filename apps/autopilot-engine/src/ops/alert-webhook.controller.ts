/**
 * Alert Webhook Controller
 *
 * Receives Alertmanager webhook payloads at POST /api/v1/ops/alerts.
 * Implements the observe → diagnose → decide → act → verify → learn loop:
 *
 *   1. Observe   — receive alert payload
 *   2. Diagnose  — identify which policy matches
 *   3. Decide    — check guardrails (cooldown, limits, kill-switch)
 *   4. Act       — execute action (restart / rollback / log)
 *   5. Verify    — health-check target after action (async)
 *   6. Learn     — persist incident + outcome to append-only log
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
  Headers,
} from '@nestjs/common';
import { PolicyEngineService, AlertmanagerPayload } from './policy-engine.service';
import { ActionExecutorService } from './action-executor.service';
import { GuardrailsService } from './guardrails.service';
import { IncidentStoreService } from './incident-store.service';
import { VerifierService } from './verifier.service';

@Controller('ops')
export class AlertWebhookController {
  private readonly logger = new Logger(AlertWebhookController.name);

  constructor(
    private readonly policyEngine: PolicyEngineService,
    private readonly executor: ActionExecutorService,
    private readonly guardrails: GuardrailsService,
    private readonly incidents: IncidentStoreService,
    private readonly verifier: VerifierService,
  ) {}

  // ── Health ─────────────────────────────────────────────────────────────────

  @Get('health')
  health() {
    return { status: 'ok', service: 'autopilot-ops', timestamp: new Date().toISOString() };
  }

  // ── Incident log tail ──────────────────────────────────────────────────────

  @Get('incidents')
  async listIncidents() {
    const items = await this.incidents.tail(100);
    return { count: items.length, incidents: items };
  }

  // ── Alertmanager webhook ───────────────────────────────────────────────────

  @Post('alerts')
  @HttpCode(HttpStatus.OK)
  async receiveAlert(
    @Body() payload: AlertmanagerPayload,
    @Headers('authorization') authHeader: string,
  ) {
    // Verify shared secret (set AUTOPILOT_WEBHOOK_SECRET in env)
    this.verifyWebhookSecret(authHeader);

    const alerts = payload.alerts ?? [];
    this.logger.log(
      `Received ${alerts.length} alert(s) from Alertmanager (status: ${payload.status})`
    );

    // Process each alert independently
    const results = await Promise.all(
      alerts.map((alert) => this.processAlert(alert))
    );

    return { processed: results.length, results };
  }

  // ── Core loop ──────────────────────────────────────────────────────────────

  private async processAlert(alert: AlertmanagerPayload['alerts'][number]) {
    const alertName = alert.labels?.alertname ?? 'unknown';
    const severity = alert.labels?.severity ?? 'unknown';

    // --- 1. OBSERVE ---
    this.logger.log(`[OBSERVE] Alert: ${alertName} severity=${severity} status=${alert.status}`);

    // Resolved alerts are recorded and skipped
    if (alert.status === 'resolved') {
      await this.incidents.record({
        alertName,
        service: alert.labels?.job ?? alert.labels?.service ?? 'unknown',
        severity,
        policyName: null,
        action: null,
        actionTarget: null,
        outcome: 'observe-only',
        notes: 'Alert resolved — no action needed',
      });
      return { alertName, status: 'resolved', action: 'none' };
    }

    // --- 2. DIAGNOSE ---
    const match = this.policyEngine.evaluate(alert);
    if (!match) {
      this.logger.debug(`[DIAGNOSE] No policy matched for "${alertName}"`);
      await this.incidents.record({
        alertName,
        service: alert.labels?.job ?? 'unknown',
        severity,
        policyName: null,
        action: null,
        actionTarget: null,
        outcome: 'observe-only',
        notes: 'No matching policy',
      });
      return { alertName, status: 'no-policy' };
    }
    this.logger.log(`[DIAGNOSE] Matched policy: "${match.policy.name}" → ${match.actionType} "${match.target}"`);

    // --- 3. DECIDE (guardrails) ---
    const g = this.policyEngine.guardrails;
    const check = this.guardrails.canAct({
      policyName: match.policy.name,
      target: match.target,
      cooldownMinutes: match.policy.cooldown_minutes,
      maxActionsPerHour: match.policy.max_actions_per_hour,
      globalMaxPerHour: g.global_max_actions_per_hour,
      protectedContainers: g.protected_containers,
    });

    if (!check.allowed) {
      this.logger.warn(`[DECIDE] Blocked by guardrails: ${check.reason}`);
      await this.incidents.record({
        alertName,
        service: match.target,
        severity,
        policyName: match.policy.name,
        action: match.actionType,
        actionTarget: match.target,
        outcome: 'blocked',
        blockedReason: check.reason,
      });
      return { alertName, status: 'blocked', reason: check.reason };
    }
    this.logger.log(`[DECIDE] Guardrails passed — proceeding with action`);

    // --- 4. ACT ---
    const incident = await this.incidents.record({
      alertName,
      service: match.target,
      severity,
      policyName: match.policy.name,
      action: match.actionType,
      actionTarget: match.target,
      outcome: 'success', // optimistic; updated in verify step
    });

    this.guardrails.recordAction(match.policy.name, match.target);
    const result = await this.executor.execute(match.actionType, match.target);
    this.logger.log(`[ACT] ${match.actionType} "${match.target}": success=${result.success}`);

    if (!result.success) {
      await this.incidents.resolve(incident.id, 'failed', result.error);
      return { alertName, status: 'action-failed', error: result.error };
    }

    // --- 5. VERIFY (non-blocking — runs in background) ---
    this.scheduleVerification(incident.id, match.target, match.verifyAfterSeconds);

    // --- 6. LEARN — resolution appended after verify completes ---
    return {
      alertName,
      status: 'acted',
      policy: match.policy.name,
      action: match.actionType,
      target: match.target,
      incidentId: incident.id,
    };
  }

  private scheduleVerification(incidentId: string, target: string, delaySeconds: number): void {
    // Fire-and-forget; errors are caught internally
    this.verifier
      .verify(target, delaySeconds)
      .then(async (verificationResult) => {
        this.logger.log(`[VERIFY] ${target}: ${verificationResult}`);
        await this.incidents.resolve(
          incidentId,
          verificationResult === 'pass' ? 'success' : 'failed',
          `post-action verification: ${verificationResult}`
        );
      })
      .catch((err: Error) => {
        this.logger.error(`[VERIFY] Unhandled error for ${target}: ${err.message}`);
      });
  }

  private verifyWebhookSecret(authHeader: string | undefined): void {
    const secret = process.env.AUTOPILOT_WEBHOOK_SECRET;
    if (!secret) return; // No secret configured — allow all (dev mode)
    const expected = `Bearer ${secret}`;
    if (authHeader !== expected) {
      this.logger.warn('Webhook request rejected: invalid secret');
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }
}
