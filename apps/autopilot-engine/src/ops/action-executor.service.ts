/**
 * Action Executor Service
 *
 * Translates policy decisions into concrete Docker operations.
 * Uses the Docker CLI via child_process (requires /var/run/docker.sock to be
 * mounted into the autopilot-engine container).
 *
 * Supported actions:
 *   restart  — docker restart <container>
 *   rollback — docker service rollback <service> (Swarm) or pull previous tag
 *   log_incident — no-op action, incident already recorded by caller
 */

import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type ActionType = 'restart' | 'rollback' | 'log_incident';

export interface ActionResult {
  success: boolean;
  actionType: ActionType;
  target: string;
  stdout?: string;
  stderr?: string;
  error?: string;
}

@Injectable()
export class ActionExecutorService {
  private readonly logger = new Logger(ActionExecutorService.name);

  async execute(actionType: ActionType, target: string): Promise<ActionResult> {
    this.logger.warn(`Executing action: ${actionType} on target: ${target}`);

    switch (actionType) {
      case 'restart':
        return this.restartContainer(target);
      case 'rollback':
        return this.rollbackService(target);
      case 'log_incident':
        this.logger.log(`log_incident action for target "${target}" — no Docker op performed`);
        return { success: true, actionType, target };
      default:
        return { success: false, actionType, target, error: `Unknown action type: ${actionType}` };
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async restartContainer(container: string): Promise<ActionResult> {
    // Sanitise: only allow alphanumeric, dash, underscore
    const safe = this.sanitiseTarget(container);
    if (!safe) {
      return { success: false, actionType: 'restart', target: container, error: 'Invalid container name' };
    }
    try {
      const { stdout, stderr } = await execAsync(`docker restart ${safe}`, { timeout: 30_000 });
      this.logger.log(`Restarted container "${safe}". stdout: ${stdout.trim()}`);
      return { success: true, actionType: 'restart', target: safe, stdout, stderr };
    } catch (err) {
      const error = (err as Error).message;
      this.logger.error(`Failed to restart "${safe}": ${error}`);
      return { success: false, actionType: 'restart', target: safe, error };
    }
  }

  private async rollbackService(service: string): Promise<ActionResult> {
    const safe = this.sanitiseTarget(service);
    if (!safe) {
      return { success: false, actionType: 'rollback', target: service, error: 'Invalid service name' };
    }
    try {
      // For Docker Swarm: docker service rollback <service>
      // For Compose: re-pull the previous image tag stored in PREVIOUS_<SERVICE>_TAG env var
      const prevTag = process.env[`PREVIOUS_${safe.toUpperCase().replace(/-/g, '_')}_TAG`];
      let cmd: string;
      if (prevTag) {
        // Compose / standalone: pull previous image and recreate
        const image = process.env[`${safe.toUpperCase().replace(/-/g, '_')}_IMAGE`] || `delegatecart/${safe}`;
        cmd = `docker pull ${image}:${prevTag} && docker compose -f /opt/delegatecart/docker-compose.latest.yml up -d --no-deps ${safe}`;
      } else {
        // Swarm rollback
        cmd = `docker service rollback ${safe}`;
      }
      const { stdout, stderr } = await execAsync(cmd, { timeout: 120_000 });
      this.logger.warn(`Rolled back service "${safe}". stdout: ${stdout.trim()}`);
      return { success: true, actionType: 'rollback', target: safe, stdout, stderr };
    } catch (err) {
      const error = (err as Error).message;
      this.logger.error(`Rollback failed for "${safe}": ${error}`);
      return { success: false, actionType: 'rollback', target: safe, error };
    }
  }

  /** Allow only safe container/service name characters to prevent injection. */
  private sanitiseTarget(name: string): string | null {
    if (/^[a-zA-Z0-9_-]{1,64}$/.test(name)) return name;
    this.logger.error(`Rejected unsafe target name: "${name}"`);
    return null;
  }
}
