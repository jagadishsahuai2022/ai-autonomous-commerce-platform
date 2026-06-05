/**
 * Autopilot Rule Repository
 * Database operations for autopilot rules
 */

import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AutopilotRule, Prisma } from '../../generated/prisma';
import { CreateRuleDto, UpdateRuleDto } from '../../dto';

@Injectable()
export class AutopilotRuleRepository {
  private readonly logger = new Logger(AutopilotRuleRepository.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create new autopilot rule
   */
  async create(data: CreateRuleDto): Promise<AutopilotRule> {
    try {
      const rule = await this.prisma.autopilotRule.create({
        data: {
          userId: data.userId,
          name: data.name,
          description: data.description,
          conditions: data.conditions,
          action: data.action,
          maxSpendPerMonth: data.maxSpendPerMonth,
          maxOrderValue: data.maxOrderValue,
          status: 'active',
        },
      });

      this.logger.log(`✓ Rule created: ${rule.id} for user: ${data.userId}`);
      return rule;
    } catch (error) {
      this.logger.error('Failed to create rule', error);
      throw error;
    }
  }

  /**
   * Find rule by ID
   */
  async findById(ruleId: string): Promise<AutopilotRule | null> {
    return this.prisma.autopilotRule.findUnique({
      where: { id: ruleId },
      include: { metadata: true },
    });
  }

  /**
   * Find all active rules for user
   */
  async findByUserId(userId: string, status?: string): Promise<AutopilotRule[]> {
    return this.prisma.autopilotRule.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      include: { metadata: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find all rules (paginated)
   */
  async findAll(
    skip: number = 0,
    take: number = 20,
    where?: Prisma.AutopilotRuleWhereInput
  ): Promise<{ rules: AutopilotRule[]; total: number }> {
    const [rules, total] = await Promise.all([
      this.prisma.autopilotRule.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.autopilotRule.count({ where }),
    ]);

    return { rules, total };
  }

  /**
   * Update rule
   */
  async update(ruleId: string, data: UpdateRuleDto): Promise<AutopilotRule> {
    const rule = await this.findById(ruleId);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }

    try {
      const updated = await this.prisma.autopilotRule.update({
        where: { id: ruleId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description && { description: data.description }),
          ...(data.conditions && { conditions: data.conditions }),
          ...(data.action && { action: data.action }),
          ...(data.maxSpendPerMonth && { maxSpendPerMonth: data.maxSpendPerMonth }),
          ...(data.maxOrderValue && { maxOrderValue: data.maxOrderValue }),
          ...(data.status && { status: data.status }),
          updatedAt: new Date(),
        },
      });

      this.logger.log(`✓ Rule updated: ${ruleId}`);
      return updated;
    } catch (error) {
      this.logger.error('Failed to update rule', error);
      throw error;
    }
  }

  /**
   * Disable/deactivate rule
   */
  async disable(ruleId: string): Promise<void> {
    const rule = await this.findById(ruleId);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }

    await this.prisma.autopilotRule.update({
      where: { id: ruleId },
      data: { status: 'inactive', updatedAt: new Date() },
    });

    this.logger.log(`✓ Rule disabled: ${ruleId}`);
  }

  /**
   * Delete rule
   */
  async delete(ruleId: string): Promise<void> {
    const rule = await this.findById(ruleId);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }

    await this.prisma.autopilotRule.delete({
      where: { id: ruleId },
    });

    this.logger.log(`✓ Rule deleted: ${ruleId}`);
  }

  /**
   * Record rule execution
   */
  async recordExecution(ruleId: string, success: boolean): Promise<void> {
    const rule = await this.findById(ruleId);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }

    await this.prisma.autopilotRule.update({
      where: { id: ruleId },
      data: {
        triggerCount: rule.triggerCount + 1,
        successCount: success ? rule.successCount + 1 : rule.successCount,
        failureCount: success ? rule.failureCount : rule.failureCount + 1,
        lastTriggeredAt: new Date(),
      },
    });

    this.logger.debug(`Recorded execution for rule ${ruleId}: ${success ? 'SUCCESS' : 'FAILURE'}`);
  }

  /**
   * Get rule statistics
   */
  async getStats(ruleId: string): Promise<{
    triggerCount: number;
    successRate: number;
    lastTriggered: Date | null;
  }> {
    const rule = await this.findById(ruleId);
    if (!rule) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }

    return {
      triggerCount: rule.triggerCount,
      successRate: rule.triggerCount > 0 ? rule.successCount / rule.triggerCount : 0,
      lastTriggered: rule.lastTriggeredAt,
    };
  }

  /**
   * Find rules matching criteria (for decision engine)
   */
  async findApplicableRules(userId: string, category?: string): Promise<AutopilotRule[]> {
    const rules = await this.findByUserId(userId, 'active');

    if (!category) {
      return rules;
    }

    // Filter by category preference
    return rules.filter((rule) => {
      const metadata = (rule as any).metadata;
      if (!metadata?.preferredCategories || metadata.preferredCategories.length === 0) {
        return true; // No category restriction
      }
      return metadata.preferredCategories.includes(category);
    });
  }

  /**
   * Bulk update rules
   */
  async bulkUpdate(
    ruleIds: string[],
    data: Partial<Prisma.AutopilotRuleUpdateInput>
  ): Promise<number> {
    const result = await this.prisma.autopilotRule.updateMany({
      where: { id: { in: ruleIds } },
      data: { ...data, updatedAt: new Date() },
    });

    this.logger.log(`✓ Bulk updated ${result.count} rules`);
    return result.count;
  }

  /**
   * Count rules by status
   */
  async countByStatus(userId: string): Promise<Record<string, number>> {
    const results = await this.prisma.autopilotRule.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    const counts: Record<string, number> = {
      active: 0,
      inactive: 0,
      paused: 0,
    };

    results.forEach((result: { status: string; _count: number }) => {
      counts[result.status] = result._count;
    });

    return counts;
  }
}
