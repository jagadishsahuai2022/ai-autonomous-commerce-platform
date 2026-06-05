/**
 * Incident Store Service
 *
 * Persists every alert, action, and outcome to a newline-delimited JSON log
 * at /data/incidents/incidents.ndjson (bind-mounted volume in Docker).
 * This file can be imported into any analytics tool or fed back into the
 * learning loop.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface Incident {
  id: string;
  timestamp: string;
  alertName: string;
  service: string;
  severity: string;
  policyName: string | null;
  action: string | null;
  actionTarget: string | null;
  outcome: 'success' | 'blocked' | 'failed' | 'observe-only';
  blockedReason?: string;
  verificationResult?: 'pass' | 'fail' | 'skipped';
  resolvedAt?: string;
  notes?: string;
}

@Injectable()
export class IncidentStoreService implements OnModuleInit {
  private readonly logger = new Logger(IncidentStoreService.name);
  private logPath: string;

  onModuleInit(): void {
    const dir = process.env.INCIDENT_LOG_DIR || '/data/incidents';
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Directory may already exist; ignore
    }
    this.logPath = path.join(dir, 'incidents.ndjson');
    this.logger.log(`Incident log: ${this.logPath}`);
  }

  /** Append a new incident record and return it. */
  async record(incident: Omit<Incident, 'id' | 'timestamp'>): Promise<Incident> {
    const entry: Incident = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      ...incident,
    };
    const line = JSON.stringify(entry) + '\n';
    try {
      fs.appendFileSync(this.logPath, line, { encoding: 'utf8' });
    } catch (err) {
      this.logger.error(`Failed to write incident: ${(err as Error).message}`);
    }
    return entry;
  }

  /** Update an existing incident by id (patches the in-memory cache only;
   *  appends a resolution record to the log for full auditability). */
  async resolve(id: string, outcome: Incident['outcome'], notes?: string): Promise<void> {
    const patch: Partial<Incident> = {
      id,
      resolvedAt: new Date().toISOString(),
      outcome,
      notes,
    };
    const line = JSON.stringify({ _type: 'resolution', ...patch }) + '\n';
    try {
      fs.appendFileSync(this.logPath, line, { encoding: 'utf8' });
    } catch (err) {
      this.logger.error(`Failed to write resolution: ${(err as Error).message}`);
    }
  }

  /** Read back the last N incidents (tail of the log file). */
  async tail(n = 50): Promise<Incident[]> {
    try {
      const content = fs.readFileSync(this.logPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines
        .slice(-n)
        .map((l) => {
          try {
            return JSON.parse(l) as Incident;
          } catch {
            return null;
          }
        })
        .filter((x): x is Incident => x !== null && !('_type' in (x as object)));
    } catch {
      return [];
    }
  }

  private generateId(): string {
    return `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
