/**
 * Rule Engine Service
 * Manages user-defined autopilot rules and conditions
 */

import { Injectable, Logger } from '@nestjs/common';
import { AutopilotRule, RuleCondition, ProductData } from '../types';

@Injectable()
export class RuleEngine {
  private readonly logger = new Logger(RuleEngine.name);
  private rules: Map<string, AutopilotRule> = new Map();

  /**
   * Create a new autopilot rule
   */
  async createRule(rule: AutopilotRule): Promise<AutopilotRule> {
    if (!this.validateRule(rule)) {
      throw new Error('Invalid rule configuration');
    }

    const createdRule: AutopilotRule = {
      ...rule,
      id: this.generateRuleId(),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      triggerCount: 0,
      successCount: 0,
      failureCount: 0,
    };

    this.rules.set(createdRule.id, createdRule);
    this.logger.log(`Rule created: ${createdRule.id} for user: ${rule.userId}`);

    return createdRule;
  }

  /**
   * Evaluate rule against product
   * Returns true if product matches rule conditions
   */
  evaluateRule(rule: AutopilotRule, product: ProductData): boolean {
    if (rule.status !== 'active') {
      return false;
    }

    return rule.conditions.every((condition) => this.evaluateCondition(condition, product));
  }

  /**
   * Evaluate individual condition
   */
  private evaluateCondition(condition: RuleCondition, product: ProductData): boolean {
    const value = this.getProductFieldValue(condition.field, product);

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'neq':
        return value !== condition.value;
      case 'gt':
        return value > condition.value;
      case 'gte':
        return value >= condition.value;
      case 'lt':
        return value < condition.value;
      case 'lte':
        return value <= condition.value;
      case 'in':
        return Array.isArray(condition.value) ? condition.value.includes(value) : false;
      case 'contains':
        return String(value).includes(String(condition.value));
      default:
        return false;
    }
  }

  /**
   * Extract field value from product
   */
  private getProductFieldValue(field: string, product: ProductData): any {
    const fieldMap: Record<string, any> = {
      price: product.price,
      category: product.category,
      brand: product.brand,
      rating: product.rating,
      stock: product.stock,
      date: new Date().toISOString().split('T')[0],
      time: new Date().getHours(),
    };

    return fieldMap[field];
  }

  /**
   * Get all active rules for user
   */
  async getUserRules(userId: string): Promise<AutopilotRule[]> {
    return Array.from(this.rules.values()).filter(
      (rule) => rule.userId === userId && rule.status !== 'inactive'
    );
  }

  /**
   * Update rule
   */
  async updateRule(ruleId: string, updates: Partial<AutopilotRule>): Promise<AutopilotRule> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const updated: AutopilotRule = {
      ...rule,
      ...updates,
      id: rule.id, // Immutable
      userId: rule.userId, // Immutable
      createdAt: rule.createdAt, // Immutable
      updatedAt: new Date(),
    };

    this.rules.set(ruleId, updated);
    this.logger.log(`Rule updated: ${ruleId}`);

    return updated;
  }

  /**
   * Disable rule
   */
  async disableRule(ruleId: string): Promise<void> {
    await this.updateRule(ruleId, { status: 'inactive' });
  }

  /**
   * Get rule by ID
   */
  async getRule(ruleId: string): Promise<AutopilotRule | null> {
    return this.rules.get(ruleId) || null;
  }

  /**
   * Increment rule trigger count
   */
  async recordRuleExecution(ruleId: string, success: boolean): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule) return;

    rule.triggerCount++;
    if (success) {
      rule.successCount++;
    } else {
      rule.failureCount++;
    }
    rule.lastTriggeredAt = new Date();

    this.rules.set(ruleId, rule);
  }

  /**
   * Validate rule configuration
   */
  private validateRule(rule: AutopilotRule): boolean {
    if (!rule.userId || !rule.name || !rule.conditions || rule.conditions.length === 0) {
      return false;
    }

    if (!rule.action || !rule.action.type) {
      return false;
    }

    if (rule.maxSpendPerMonth <= 0 || rule.maxOrderValue <= 0) {
      return false;
    }

    return true;
  }

  /**
   * Generate unique rule ID
   */
  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get rule statistics
   */
  async getRuleStats(ruleId: string): Promise<{
    triggerCount: number;
    successRate: number;
    lastTriggered: Date | null;
  }> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    return {
      triggerCount: rule.triggerCount,
      successRate: rule.triggerCount > 0 ? rule.successCount / rule.triggerCount : 0,
      lastTriggered: rule.lastTriggeredAt || null,
    };
  }
}
