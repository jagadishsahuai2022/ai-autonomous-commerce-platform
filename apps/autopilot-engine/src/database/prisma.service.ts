/**
 * Prisma Service
 * Handles database connection and provides Prisma client instance
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Database disconnected');
  }

  /**
   * Clear database (for testing)
   */
  async clearDb() {
    const models = Object.getOwnPropertyNames(this).filter(
      (prop: string) => (this as any)[prop] && typeof (this as any)[prop].deleteMany === 'function'
    );

    for (const model of models) {
      try {
        await (this as any)[model].deleteMany();
      } catch (error) {
        this.logger.warn(`Could not clear model ${model}`, error);
      }
    }
  }
}
