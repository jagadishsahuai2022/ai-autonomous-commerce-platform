/**
 * Policy Engine Service
 *
 * Loads policies from infra/autopilot/policies.yml (or POLICY_FILE env var).
 * Evaluates incoming Alertmanager alerts against policies and returns the
 * matching policy + resolved action target (if any).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// ── Types ──────────────────────────────────────────────────────────────────

interface PolicyCondition {
  field: string;          // dot-path into the alert object, e.g. "labels.severity"
  equals?: string;
  greater_than?: number;
}

interface PolicyAction {
  type: 'restart' | 'rollback' | 'log_incident';
  target?: string;             // literal container name
  target_from_label?: string;  // derive target from alert label
  message?: string;
}

export interface Policy {
  name: string;
  description?: string;
  trigger: string;           // alert name, e.g. "ServiceDown"
  conditions?: PolicyCondition[];
  actions: PolicyAction[];
  cooldown_minutes: number;
  max_actions_per_hour: number;
  verify_after_seconds?: number;
  enabled: boolean;
}

interface PoliciesFile {
  policies: Policy[];
  guardrails: {
    global_max_actions_per_hour: number;
    protected_containers: string[];
    kill_switch_env: string;
    escalation_threshold: number;
  };
}

export interface PolicyMatch {
  policy: Policy;
  actionType: 'restart' | 'rollback' | 'log_incident';
  target: string;
  verifyAfterSeconds: number;
}

// ── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class PolicyEngineService implements OnModuleInit {
  private readonly logger = new Logger(PolicyEngineService.name);
  private policies: Policy[] = [];
  public guardrails!: PoliciesFile['guardrails'];

  onModuleInit(): void {
    this.loadPolicies();
  }

  evaluate(alert: AlertmanagerAlert): PolicyMatch | null {
    for (const policy of this.policies) {
      if (!policy.enabled) continue;
      if (policy.trigger !== alert.labels?.alertname) continue;
      if (!this.conditionsPass(policy.conditions ?? [], alert)) continue;

      const action = policy.actions[0]; // execute first action only
      const target = action.target ?? this.resolveTargetFromLabel(action.target_from_label, alert);
      if (!target) {
        this.logger.warn(`Policy "${policy.name}" matched but no target resolved`);
        continue;
      }

      return {
        policy,
        actionType: action.type,
        target,
        verifyAfterSeconds: policy.verify_after_seconds ?? 30,
      };
    }
    return null;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private loadPolicies(): void {
    const filePath =
      process.env.POLICY_FILE ??
      path.resolve(__dirname, '../../../../../infra/autopilot/policies.yml');

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = yaml.load(content) as PoliciesFile;
      this.policies = parsed.policies ?? [];
      this.guardrails = parsed.guardrails;
      this.logger.log(`Loaded ${this.policies.length} policies from ${filePath}`);
    } catch (err) {
      this.logger.error(`Failed to load policies from ${filePath}: ${(err as Error).message}`);
      this.policies = [];
      this.guardrails = {
        global_max_actions_per_hour: 10,
        protected_containers: ['dc-latest-postgres', 'dc-latest-redis'],
        kill_switch_env: 'AUTOPILOT_ENABLED',
        escalation_threshold: 3,
      };
    }
  }

  private conditionsPass(conditions: PolicyCondition[], alert: AlertmanagerAlert): boolean {
    for (const cond of conditions) {
      const actual = this.resolvePath(cond.field, alert as unknown as Record<string, unknown>);

      if (cond.equals !== undefined && String(actual) !== String(cond.equals)) {
        return false;
      }
      if (cond.greater_than !== undefined && Number(actual) <= cond.greater_than) {
        return false;
      }
    }
    return true;
  }

  private resolvePath(dotPath: string, obj: Record<string, unknown>): unknown {
    return dotPath.split('.').reduce((acc: unknown, key: string) => {
      if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
      return undefined;
    }, obj as unknown);
  }

  private resolveTargetFromLabel(labelKey: string | undefined, alert: AlertmanagerAlert): string | null {
    if (!labelKey) return null;
    const value = alert.labels?.[labelKey];
    return typeof value === 'string' ? value : null;
  }
}

// ── Alertmanager payload types ─────────────────────────────────────────────

export interface AlertmanagerAlert {
  status: 'firing' | 'resolved';
  labels: Record<string, string> & { alertname: string; severity?: string };
  annotations?: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  generatorURL?: string;
  fingerprint?: string;
  value?: number;
}

export interface AlertmanagerPayload {
  version: string;
  groupKey: string;
  status: 'firing' | 'resolved';
  receiver: string;
  alerts: AlertmanagerAlert[];
  commonLabels?: Record<string, string>;
  commonAnnotations?: Record<string, string>;
}
