/**
 * Verifier Service
 *
 * After an automated action runs, the verifier performs a health check
 * to confirm the target service recovered.  Results are fed back into the
 * incident store.
 *
 * Verification strategy (in order):
 *   1. HTTP GET to the service's /health endpoint
 *   2. docker inspect to confirm container is in "running" state
 */

import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as http from 'http';
import * as https from 'https';

const execAsync = promisify(exec);

export type VerificationResult = 'pass' | 'fail' | 'skipped';

// Map container/service names to their internal health-check URLs
const HEALTH_URLS: Record<string, string> = {
  api: 'http://api:3001/health',
  'ai-commerce-api': 'http://api:3001/health',
  'autopilot-engine': 'http://autopilot-engine:3002/health',
  web: 'http://web:3000/api/health',
};

@Injectable()
export class VerifierService {
  private readonly logger = new Logger(VerifierService.name);

  /** Run the verification check `delaySeconds` after the action completed. */
  async verify(target: string, delaySeconds = 30): Promise<VerificationResult> {
    this.logger.log(`Verification scheduled for "${target}" in ${delaySeconds}s`);
    await this.sleep(delaySeconds * 1000);

    // 1. HTTP health check if URL is known
    const url = HEALTH_URLS[target];
    if (url) {
      const httpResult = await this.httpHealthCheck(url);
      if (httpResult !== null) {
        const result: VerificationResult = httpResult ? 'pass' : 'fail';
        this.logger.log(`HTTP health check for "${target}": ${result} (${url})`);
        return result;
      }
    }

    // 2. Fall back to docker inspect
    return this.dockerInspect(target);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async httpHealthCheck(url: string): Promise<boolean | null> {
    return new Promise((resolve) => {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, { timeout: 5000 }, (res) => {
        resolve(res.statusCode !== undefined && res.statusCode < 400);
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  }

  private async dockerInspect(container: string): Promise<VerificationResult> {
    // Only allow safe names to prevent injection
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(container)) {
      this.logger.error(`Unsafe container name in verify: "${container}"`);
      return 'skipped';
    }
    try {
      const { stdout } = await execAsync(
        `docker inspect --format='{{.State.Running}}' ${container}`,
        { timeout: 10_000 }
      );
      const running = stdout.trim() === 'true';
      this.logger.log(`Docker inspect "${container}": running=${running}`);
      return running ? 'pass' : 'fail';
    } catch {
      this.logger.warn(`docker inspect failed for "${container}" — skipping verification`);
      return 'skipped';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
