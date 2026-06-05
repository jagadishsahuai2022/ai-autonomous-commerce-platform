import { Injectable, ServiceUnavailableException } from '@nestjs/common';

/**
 * PRODUCTION-GRADE CIRCUIT BREAKER
 * Prevents cascading failures by stopping requests to failing services
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests immediately fail
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */

export enum CircuitStateEnum {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes needed to close from half-open
  timeout: number; // Time in ms before transitioning OPEN -> HALF_OPEN
  requestVolumeThreshold?: number; // Min requests to consider for opening
}

export interface CircuitBreakerState {
  state: CircuitStateEnum;
  failures: number;
  successes: number;
  nextAttempt: number;
  lastFailure?: Error;
}

@Injectable()
export class CircuitBreakerService {
  private circuits = new Map<string, CircuitBreakerState>();
  private configMap = new Map<string, CircuitBreakerConfig>();

  /**
   * Register a circuit breaker
   */
  register(config: CircuitBreakerConfig): void {
    this.configMap.set(config.name, config);
    this.circuits.set(config.name, {
      state: CircuitStateEnum.CLOSED,
      failures: 0,
      successes: 0,
      nextAttempt: Date.now(),
      lastFailure: undefined,
    });
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    const circuit = this.circuits.get(serviceName);
    const config = this.configMap.get(serviceName);

    if (!circuit || !config) {
      throw new Error(`Circuit breaker not registered: ${serviceName}`);
    }

    // Check if circuit is open
    if (circuit.state === CircuitStateEnum.OPEN) {
      if (Date.now() < circuit.nextAttempt) {
        // Still open
        if (fallback) {
          return await Promise.resolve(fallback());
        }
        throw new ServiceUnavailableException(
          `Circuit breaker OPEN for ${serviceName}. Last error: ${circuit.lastFailure?.message}`
        );
      } else {
        // Transition to half-open
        circuit.state = CircuitStateEnum.HALF_OPEN;
        circuit.successes = 0;
      }
    }

    try {
      const result = await fn();

      // Record success
      if (circuit.state === CircuitStateEnum.HALF_OPEN) {
        circuit.successes++;
        if (circuit.successes >= config.successThreshold) {
          // Close circuit
          circuit.state = CircuitStateEnum.CLOSED;
          circuit.failures = 0;
          circuit.successes = 0;
          // eslint-disable-next-line no-console
          console.log(`✅ Circuit breaker CLOSED for ${serviceName}`);
        }
      } else if (circuit.state === CircuitStateEnum.CLOSED) {
        circuit.failures = Math.max(0, circuit.failures - 1); // Decay failures
      }

      return result;
    } catch (error) {
      circuit.failures++;
      circuit.lastFailure = error;

      // Check if threshold exceeded
      if (circuit.failures >= config.failureThreshold) {
        circuit.state = CircuitStateEnum.OPEN;
        circuit.nextAttempt = Date.now() + config.timeout;
        console.error(`❌ Circuit breaker OPEN for ${serviceName}: ${error.message}`);
      }

      if (fallback && circuit.state === CircuitStateEnum.OPEN) {
        return await Promise.resolve(fallback());
      }

      throw error;
    }
  }

  /**
   * Get circuit status
   */
  getStatus(serviceName: string): CircuitBreakerState | null {
    return this.circuits.get(serviceName) || null;
  }

  /**
   * Get all circuits status
   */
  getAllStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    for (const [name, circuit] of this.circuits) {
      status[name] = {
        state: circuit.state,
        failures: circuit.failures,
        successes: circuit.successes,
        nextAttempt: new Date(circuit.nextAttempt),
        lastFailure: circuit.lastFailure?.message,
      };
    }
    return status;
  }

  /**
   * Reset circuit (admin only)
   */
  reset(serviceName: string): void {
    const circuit = this.circuits.get(serviceName);
    if (circuit) {
      circuit.state = CircuitStateEnum.CLOSED;
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.nextAttempt = Date.now();
      // eslint-disable-next-line no-console
      console.log(`🔄 Circuit breaker reset for ${serviceName}`);
    }
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const [name] of this.circuits) {
      this.reset(name);
    }
  }
}
