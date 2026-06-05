import { Injectable, LoggerService } from '@nestjs/common';

/**
 * PRODUCTION-GRADE STRUCTURED LOGGING
 * JSON-formatted logs with correlation IDs for distributed tracing
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  correlationId?: string;
  userId?: number;
  service?: string;
  message: string;
  metadata?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private context: string = 'App';
  private logLevel = LogLevel.INFO;
  private correlationId?: string;
  private userId?: number;

  constructor() {
    // Set log level from environment
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel && Object.values(LogLevel).includes(envLevel as LogLevel)) {
      this.logLevel = envLevel as LogLevel;
    }
  }

  /**
   * Set context for logs
   */
  setContext(context: string) {
    this.context = context;
  }

  /**
   * Set correlation ID for tracing
   */
  setCorrelationId(correlationId: string) {
    this.correlationId = correlationId;
  }

  /**
   * Set user ID for logs
   */
  setUserId(userId: number) {
    this.userId = userId;
  }

  // ========== Log Methods ==========

  debug(message: string, metadata?: Record<string, any>) {
    this.writeLog(LogLevel.DEBUG, message, metadata);
  }

  log(message: string, metadataOrContext?: Record<string, any> | string) {
    const metadata = typeof metadataOrContext === 'object' ? metadataOrContext : undefined;
    this.writeLog(LogLevel.INFO, message, metadata);
  }

  info(message: string, metadata?: Record<string, any>) {
    this.writeLog(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.writeLog(LogLevel.WARN, message, metadata);
  }

  error(message: string, trace?: string, metadata?: Record<string, any>) {
    const errorMetadata = {
      ...metadata,
      stack: trace,
    };
    this.logWithError(message, new Error(trace), errorMetadata);
  }

  fatal(message: string, error?: Error, metadata?: Record<string, any>) {
    this.logWithError(message, error, metadata, LogLevel.FATAL);
    process.exit(1);
  }

  // ========== Private Methods ==========

  private writeLog(level: LogLevel, message: string, metadata?: Record<string, any>) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      correlationId: this.correlationId,
      userId: this.userId,
      service: this.context,
      message,
      metadata: metadata || {},
    };

    this.output(entry);
  }

  private logWithError(
    message: string,
    error?: Error,
    metadata?: Record<string, any>,
    level: LogLevel = LogLevel.ERROR
  ) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      correlationId: this.correlationId,
      userId: this.userId,
      service: this.context,
      message,
      metadata: metadata || {},
      error: error
        ? {
            message: error.message,
            stack: error.stack,
            code: (error as any).code,
          }
        : undefined,
    };

    this.output(entry);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private output(entry: LogEntry) {
    const json = JSON.stringify(entry);

    // Choose output stream based on level
    if (entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) {
      console.error(json);
    } else if (entry.level === LogLevel.WARN) {
      console.warn(json);
    } else {
      // eslint-disable-next-line no-console
      console.log(json);
    }
  }

  /**
   * Log API request
   */
  logRequest(method: string, path: string, metadata?: Record<string, any>) {
    this.writeLog(LogLevel.INFO, `${method} ${path}`, {
      type: 'HTTP_REQUEST',
      method,
      path,
      ...metadata,
    });
  }

  /**
   * Log API response
   */
  logResponse(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    metadata?: Record<string, any>
  ) {
    const level =
      statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;

    this.writeLog(level, `${method} ${path} ${statusCode} (${durationMs}ms)`, {
      type: 'HTTP_RESPONSE',
      method,
      path,
      statusCode,
      durationMs,
      ...metadata,
    });
  }

  /**
   * Log database query
   */
  logDbQuery(operation: string, table: string, durationMs: number, metadata?: Record<string, any>) {
    this.writeLog(LogLevel.DEBUG, `DB ${operation} on ${table} (${durationMs}ms)`, {
      type: 'DB_QUERY',
      operation,
      table,
      durationMs,
      ...metadata,
    });
  }

  /**
   * Log business event
   */
  logBusinessEvent(
    event: string,
    categoryOrMetadata?: string | Record<string, any>,
    metadata?: Record<string, any>
  ) {
    const category = typeof categoryOrMetadata === 'string' ? categoryOrMetadata : 'general';
    const meta = typeof categoryOrMetadata === 'object' ? categoryOrMetadata : metadata;
    this.writeLog(LogLevel.INFO, `EVENT: ${event}`, {
      type: 'BUSINESS_EVENT',
      event,
      category,
      ...meta,
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, durationMs: number, metadata?: Record<string, any>) {
    const level = durationMs > 1000 ? LogLevel.WARN : LogLevel.INFO;
    this.writeLog(level, `PERF: ${operation} took ${durationMs}ms`, {
      type: 'PERFORMANCE',
      operation,
      durationMs,
      ...metadata,
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(
    event: string,
    severityOrMetadata?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | Record<string, any>,
    metadata?: Record<string, any>
  ) {
    const severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
      typeof severityOrMetadata === 'string' ? severityOrMetadata : 'MEDIUM';
    const meta = typeof severityOrMetadata === 'object' ? severityOrMetadata : metadata;
    const level =
      severity === 'CRITICAL'
        ? LogLevel.FATAL
        : severity === 'HIGH'
          ? LogLevel.ERROR
          : LogLevel.WARN;
    this.writeLog(level, `SECURITY: ${event} (${severity})`, {
      type: 'SECURITY_EVENT',
      event,
      severity,
      ...meta,
    });
  }

  /**
   * Create a child logger with inherited context
   */
  createChildLogger(context: string): StructuredLoggerService {
    const child = new StructuredLoggerService();
    child.setContext(this.context + ':' + context);
    if (this.correlationId) child.setCorrelationId(this.correlationId);
    if (this.userId) child.setUserId(this.userId);
    return child;
  }
}
