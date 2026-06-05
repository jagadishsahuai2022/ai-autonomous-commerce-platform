/**
 * Guardrails Service
 *
 * Enforces safety limits before any automated action is executed:
 *   - Per-policy cooldown windows
 *   - Per-policy max-actions-per-hour cap
 *   - Global max-actions-per-hour cap
 *   - Protected container list
 *   - Kill-switch via AUTOPILOT_ENABLED env var
 */

import { Injectable, Logger } from '@nestjs/common';

interface ActionRecord {
  policyName: string;
  target: string;
  timestamp: Date;
}

@Injectable()
export class GuardrailsService {
  private readonly logger = new Logger(GuardrailsService.name);
  private readonly history: ActionRecord[] = [];

  /** Returns true when an action is permitted, false when blocked. */
  canAct(opts: {
    policyName: string;
    target: string;
    cooldownMinutes: number;
    maxActionsPerHour: number;
    globalMaxPerHour: number;
    protectedContainers: string[];
  }): { allowed: boolean; reason?: string } {
    // 1. Kill-switch
    if (process.env.AUTOPILOT_ENABLED === 'false') {
      return { allowed: false, reason: 'kill-switch: AUTOPILOT_ENABLED=false' };
    }

    // 2. Protected containers
    if (opts.protectedContainers.includes(opts.target)) {
      return { allowed: false, reason: `target "${opts.target}" is protected` };
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recent = this.history.filter((r) => r.timestamp >= oneHourAgo);

    // 3. Global hourly cap
    if (recent.length >= opts.globalMaxPerHour) {
      return {
        allowed: false,
        reason: `global cap reached (${recent.length}/${opts.globalMaxPerHour} actions/h)`,
      };
    }

    // 4. Per-policy hourly cap
    const policyRecent = recent.filter((r) => r.policyName === opts.policyName);
    if (policyRecent.length >= opts.maxActionsPerHour) {
      return {
        allowed: false,
        reason: `policy "${opts.policyName}" cap reached (${policyRecent.length}/${opts.maxActionsPerHour}/h)`,
      };
    }

    // 5. Per-policy cooldown
    const cooldownMs = opts.cooldownMinutes * 60 * 1000;
    const lastAction = this.history
      .filter((r) => r.policyName === opts.policyName)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (lastAction) {
      const elapsed = now.getTime() - lastAction.timestamp.getTime();
      if (elapsed < cooldownMs) {
        const remainingS = Math.ceil((cooldownMs - elapsed) / 1000);
        return {
          allowed: false,
          reason: `cooldown active for "${opts.policyName}" (${remainingS}s remaining)`,
        };
      }
    }

    return { allowed: true };
  }

  /** Record a completed action so future calls respect limits. */
  recordAction(policyName: string, target: string): void {
    this.history.push({ policyName, target, timestamp: new Date() });

    // Trim history older than 2 hours to prevent unbounded growth
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const before = this.history.length;
    this.history.splice(
      0,
      this.history.findIndex((r) => r.timestamp >= twoHoursAgo)
    );
    this.logger.debug(
      `Recorded action "${policyName}" on "${target}". History size: ${this.history.length} (trimmed ${before - this.history.length})`
    );
  }

  /** Count how many times a policy has fired in the last hour (for escalation). */
  recentFireCount(policyName: string): number {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.history.filter(
      (r) => r.policyName === policyName && r.timestamp >= oneHourAgo
    ).length;
  }
}
