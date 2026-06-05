import { Injectable } from '@nestjs/common';
import * as prometheus from 'prom-client';

/**
 * PRODUCTION-GRADE METRICS
 * Prometheus metrics for monitoring system health
 */

@Injectable()
export class MetricsService {
  // Response metrics
  private httpRequestDuration = new prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  });

  private httpRequestsTotal = new prometheus.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code', 'user_id'],
  });

  // Error metrics
  private errorsTotal = new prometheus.Counter({
    name: 'errors_total',
    help: 'Total errors',
    labelNames: ['type', 'service', 'user_id'],
  });

  // Business metrics
  private ordersTotal = new prometheus.Counter({
    name: 'orders_total',
    help: 'Total orders created',
    labelNames: ['status', 'user_id'],
  });

  private orderValue = new prometheus.Histogram({
    name: 'order_value',
    help: 'Order value in rupees',
    labelNames: ['category'],
    buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000],
  });

  // AI metrics
  private aiRequestDuration = new prometheus.Histogram({
    name: 'ai_request_duration_seconds',
    help: 'AI service response time',
    labelNames: ['service', 'model'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  });

  private aiConfidenceScore = new prometheus.Gauge({
    name: 'ai_confidence_score',
    help: 'AI confidence score for recommendations',
    labelNames: ['service'],
  });

  // Wallet metrics
  private walletBalance = new prometheus.Gauge({
    name: 'wallet_balance',
    help: 'User wallet balance',
    labelNames: ['user_id'],
  });

  private walletTransactions = new prometheus.Counter({
    name: 'wallet_transactions_total',
    help: 'Total wallet transactions',
    labelNames: ['type', 'status'],
  });

  // Queue metrics
  private kafkaLag = new prometheus.Gauge({
    name: 'kafka_lag',
    help: 'Kafka consumer lag',
    labelNames: ['topic', 'partition'],
  });

  private kafkaProcessDuration = new prometheus.Histogram({
    name: 'kafka_process_duration_seconds',
    help: 'Kafka message processing time',
    labelNames: ['topic'],
    buckets: [0.01, 0.1, 0.5, 1, 2, 5, 10],
  });

  // Cache metrics
  private cacheHits = new prometheus.Counter({
    name: 'cache_hits_total',
    help: 'Total cache hits',
    labelNames: ['key'],
  });

  private cacheMisses = new prometheus.Counter({
    name: 'cache_misses_total',
    help: 'Total cache misses',
    labelNames: ['key'],
  });

  // Database metrics
  private dbQueryDuration = new prometheus.Histogram({
    name: 'db_query_duration_seconds',
    help: 'Database query duration',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1],
  });

  private dbConnections = new prometheus.Gauge({
    name: 'db_connections',
    help: 'Active database connections',
  });

  constructor() {
    // Register all metrics safely (ignore if already registered)
    this.safeRegister(this.httpRequestDuration);
    this.safeRegister(this.httpRequestsTotal);
    this.safeRegister(this.errorsTotal);
    this.safeRegister(this.ordersTotal);
    this.safeRegister(this.orderValue);
    this.safeRegister(this.aiRequestDuration);
    this.safeRegister(this.aiConfidenceScore);
    this.safeRegister(this.walletBalance);
    this.safeRegister(this.walletTransactions);
    this.safeRegister(this.kafkaLag);
    this.safeRegister(this.kafkaProcessDuration);
    this.safeRegister(this.cacheHits);
    this.safeRegister(this.cacheMisses);
    this.safeRegister(this.dbQueryDuration);
    this.safeRegister(this.dbConnections);
  }

  /**
   * Safely register metrics, ignoring if already registered
   * This handles cases where the service might be instantiated multiple times
   */
  private safeRegister(metric: any) {
    try {
      prometheus.register.registerMetric(metric);
    } catch (error: any) {
      // Ignore "already registered" errors - metric is already available
      if (!error.message?.includes('already been registered')) {
        throw error;
      }
    }
  }

  // ========== HTTP Metrics ==========

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
    userId?: number
  ) {
    this.httpRequestDuration
      .labels(method, route, statusCode.toString())
      .observe(durationMs / 1000);
    this.httpRequestsTotal
      .labels(method, route, statusCode.toString(), userId?.toString() || 'anonymous')
      .inc();
  }

  recordError(type: string, service: string, userId?: number) {
    this.errorsTotal.labels(type, service, userId?.toString() || 'anonymous').inc();
  }

  // ========== Business Metrics ==========

  recordOrder(status: string, value: number, category: string, userId?: number) {
    this.ordersTotal.labels(status, userId?.toString() || 'anonymous').inc();
    this.orderValue.labels(category).observe(value);
  }

  // ========== AI Metrics ==========

  recordAiRequest(service: string, model: string, durationMs: number) {
    this.aiRequestDuration.labels(service, model).observe(durationMs / 1000);
  }

  setAiConfidenceScore(service: string, score: number) {
    this.aiConfidenceScore.labels(service).set(score);
  }

  // ========== Wallet Metrics ==========

  setWalletBalance(userId: number, balance: number) {
    this.walletBalance.labels(userId.toString()).set(balance);
  }

  recordWalletTransaction(type: string, status: string) {
    this.walletTransactions.labels(type, status).inc();
  }

  // ========== Queue Metrics ==========

  setKafkaLag(topic: string, partition: number, lag: number) {
    this.kafkaLag.labels(topic, partition.toString()).set(lag);
  }

  recordKafkaProcess(topic: string, durationMs: number) {
    this.kafkaProcessDuration.labels(topic).observe(durationMs / 1000);
  }

  // ========== Cache Metrics ==========

  recordCacheHit(key: string) {
    this.cacheHits.labels(key).inc();
  }

  recordCacheMiss(key: string) {
    this.cacheMisses.labels(key).inc();
  }

  // ========== Database Metrics ==========

  recordDbQuery(operation: string, table: string, durationMs: number) {
    this.dbQueryDuration.labels(operation, table).observe(durationMs / 1000);
  }

  setDbConnections(count: number) {
    this.dbConnections.set(count);
  }

  // ========== Get Metrics ==========

  /**
   * Get Prometheus metrics in text format
   */
  async getMetrics(): Promise<string> {
    return prometheus.register.metrics();
  }

  /**
   * Get metrics in JSON format
   */
  async getMetricsJson(): Promise<Record<string, any>> {
    const metrics = await this.getMetrics();
    return this.parsePrometheusMetrics(metrics);
  }

  /**
   * Parse Prometheus metrics to JSON
   */
  private parsePrometheusMetrics(metrics: string): Record<string, any> {
    const result: Record<string, any> = {};

    const lines = metrics.split('\n');
    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue;

      const [metricName, ...rest] = line.split(' ');
      const value = rest.pop();

      if (!result[metricName]) {
        result[metricName] = [];
      }

      result[metricName].push({
        value,
        full: line,
      });
    }

    return result;
  }

  /**
   * Generic counter metric (for backward compatibility)
   */
  recordCounterMetric(name: string, value: number = 1, labels?: Record<string, string>) {
    // No-op wrapper – real metrics use specific named methods above.
    // Silently records to avoid breaking callers.
    this.errorsTotal
      .labels(name, labels?.service || 'unknown', labels?.userId || 'unknown')
      .inc(value);
  }

  /**
   * Generic gauge metric (for backward compatibility)
   */
  recordGaugeMetric(name: string, value: number, labels?: Record<string, string>) {
    // Forwards to ai confidence gauge as a generic gauge
    this.aiConfidenceScore.labels(labels?.service || name).set(value);
  }

  /**
   * Generic metric recorder (any type)
   */
  recordMetric(name: string, value: number, labels?: Record<string, string>) {
    this.recordGaugeMetric(name, value, labels);
  }

  /**
   * Increment a named counter
   */
  increment(name: string, labels?: Record<string, string>) {
    this.recordCounterMetric(name, 1, labels);
  }

  /**
   * Reset all metrics (for testing)
   */
  resetAll() {
    prometheus.register.resetMetrics();
  }
}
