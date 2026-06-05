import { Injectable, Logger } from '@nestjs/common';

interface LogContext {
  userId?: number | string;
  requestId?: string;
  [key: string]: any;
}

@Injectable()
export class LoggerService {
  private readonly logger = new Logger('App');

  log(message: string, context?: LogContext) {
    const contextStr = context ? JSON.stringify(context) : '';
    this.logger.log(`${message} ${contextStr}`);
  }

  debug(message: string, context?: LogContext) {
    const contextStr = context ? JSON.stringify(context) : '';
    this.logger.debug(`${message} ${contextStr}`);
  }

  warn(message: string, context?: LogContext) {
    const contextStr = context ? JSON.stringify(context) : '';
    this.logger.warn(`${message} ${contextStr}`);
  }

  error(message: string, trace?: string, context?: LogContext) {
    const contextStr = context ? JSON.stringify(context) : '';
    this.logger.error(`${message} ${contextStr}`, trace);
  }
}
