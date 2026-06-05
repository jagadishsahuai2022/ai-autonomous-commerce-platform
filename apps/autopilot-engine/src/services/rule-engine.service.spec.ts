/**
 * Rule Engine Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngine } from '../services/rule-engine.service';
import { AutopilotRule, ProductData } from '../types';

describe('RuleEngine', () => {
  let service: RuleEngine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RuleEngine],
    }).compile();

    service = module.get<RuleEngine>(RuleEngine);
  });

  describe('createRule', () => {
    it('should create a valid rule', async () => {
      const rule: AutopilotRule = {
        id: '',
        userId: 'user123',
        name: 'Budget Phone Alerts',
        conditions: [
          {
            field: 'price',
            operator: 'lte',
            value: 15000,
          },
        ],
        action: {
          type: 'auto_buy',
          parameters: { quantity: 1 },
        },
        maxSpendPerMonth: 50000,
        maxOrderValue: 25000,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0,
        successCount: 0,
        failureCount: 0,
      };

      const created = await service.createRule(rule);

      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.userId).toBe('user123');
      expect(created.status).toBe('active');
      expect(created.triggerCount).toBe(0);
    });

    it('should reject invalid rule', async () => {
      const invalidRule: AutopilotRule = {
        id: '',
        userId: '',
        name: '',
        conditions: [],
        action: {
          type: 'auto_buy',
          parameters: {},
        },
        maxSpendPerMonth: 0,
        maxOrderValue: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0,
        successCount: 0,
        failureCount: 0,
      };

      await expect(service.createRule(invalidRule)).rejects.toThrow('Invalid rule configuration');
    });
  });

  describe('evaluateRule', () => {
    let rule: AutopilotRule;

    beforeEach(async () => {
      rule = await service.createRule({
        id: '',
        userId: 'user123',
        name: 'Budget Phone',
        conditions: [
          {
            field: 'price',
            operator: 'lte',
            value: 15000,
          },
          {
            field: 'category',
            operator: 'eq',
            value: 'smartphones',
          },
        ],
        action: {
          type: 'auto_buy',
          parameters: { quantity: 1 },
        },
        maxSpendPerMonth: 50000,
        maxOrderValue: 25000,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0,
        successCount: 0,
        failureCount: 0,
      });
    });

    it('should match product with all conditions satisfied', () => {
      const product: ProductData = {
        id: 'prod123',
        name: 'Budget Phone',
        price: 12000,
        category: 'smartphones',
        brand: 'Xiaomi',
        rating: 4.5,
        stock: 5,
        imageUrl: 'http://example.com/phone.jpg',
      };

      const matches = service.evaluateRule(rule, product);
      expect(matches).toBe(true);
    });

    it('should not match product with price above threshold', () => {
      const product: ProductData = {
        id: 'prod123',
        name: 'Premium Phone',
        price: 20000,
        category: 'smartphones',
        brand: 'Apple',
        rating: 4.8,
        stock: 3,
        imageUrl: 'http://example.com/phone.jpg',
      };

      const matches = service.evaluateRule(rule, product);
      expect(matches).toBe(false);
    });

    it('should not match product with wrong category', () => {
      const product: ProductData = {
        id: 'prod123',
        name: 'Tablet',
        price: 12000,
        category: 'tablets',
        brand: 'Samsung',
        rating: 4.3,
        stock: 2,
        imageUrl: 'http://example.com/tablet.jpg',
      };

      const matches = service.evaluateRule(rule, product);
      expect(matches).toBe(false);
    });

    it('should not evaluate inactive rule', () => {
      rule.status = 'inactive';
      const product: ProductData = {
        id: 'prod123',
        name: 'Budget Phone',
        price: 12000,
        category: 'smartphones',
        brand: 'Xiaomi',
        rating: 4.5,
        stock: 5,
        imageUrl: 'http://example.com/phone.jpg',
      };

      const matches = service.evaluateRule(rule, product);
      expect(matches).toBe(false);
    });
  });

  describe('evalute condition operators', () => {
    it('should support equality operator', () => {
      const rule: AutopilotRule = {
        id: '',
        userId: 'user123',
        name: 'Test',
        conditions: [{ field: 'brand', operator: 'eq', value: 'Samsung' }],
        action: { type: 'auto_buy', parameters: {} },
        maxSpendPerMonth: 50000,
        maxOrderValue: 25000,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0,
        successCount: 0,
        failureCount: 0,
      };

      const matchingProduct: ProductData = {
        id: 'prod1',
        name: 'Phone',
        price: 10000,
        category: 'smartphones',
        brand: 'Samsung',
        rating: 4.5,
        stock: 5,
        imageUrl: '',
      };

      const nonMatchingProduct: ProductData = {
        ...matchingProduct,
        brand: 'Apple',
      };

      expect(service.evaluateRule(rule, matchingProduct)).toBe(true);
      expect(service.evaluateRule(rule, nonMatchingProduct)).toBe(false);
    });

    it('should support greater than operator', () => {
      const rule: AutopilotRule = {
        id: '',
        userId: 'user123',
        name: 'Test',
        conditions: [{ field: 'rating', operator: 'gt', value: 4.0 }],
        action: { type: 'auto_buy', parameters: {} },
        maxSpendPerMonth: 50000,
        maxOrderValue: 25000,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0,
        successCount: 0,
        failureCount: 0,
      };

      const highRatedProduct: ProductData = {
        id: 'prod1',
        name: 'Phone',
        price: 10000,
        category: 'smartphones',
        brand: 'Samsung',
        rating: 4.5,
        stock: 5,
        imageUrl: '',
      };

      const lowRatedProduct: ProductData = {
        ...highRatedProduct,
        rating: 3.8,
      };

      expect(service.evaluateRule(rule, highRatedProduct)).toBe(true);
      expect(service.evaluateRule(rule, lowRatedProduct)).toBe(false);
    });

    it('should support IN operator', () => {
      const rule: AutopilotRule = {
        id: '',
        userId: 'user123',
        name: 'Test',
        conditions: [{ field: 'brand', operator: 'in', value: ['Samsung', 'Apple', 'OnePlus'] }],
        action: { type: 'auto_buy', parameters: {} },
        maxSpendPerMonth: 50000,
        maxOrderValue: 25000,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0,
        successCount: 0,
        failureCount: 0,
      };

      const product1: ProductData = {
        id: 'prod1',
        name: 'Phone',
        price: 10000,
        category: 'smartphones',
        brand: 'Samsung',
        rating: 4.5,
        stock: 5,
        imageUrl: '',
      };

      const product2: ProductData = {
        ...product1,
        brand: 'Xiaomi',
      };

      expect(service.evaluateRule(rule, product1)).toBe(true);
      expect(service.evaluateRule(rule, product2)).toBe(false);
    });
  });

  describe('getUserRules', () => {
    it('should return only active rules for user', async () => {
      const userId = 'user456';

      const rule1 = await service.createRule({
        id: '',
        userId,
        name: 'Rule 1',
        conditions: [{ field: 'price', operator: 'lte', value: 10000 }],
        action: { type: 'auto_buy', parameters: {} },
        maxSpendPerMonth: 50000,
        maxOrderValue: 25000,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0,
        successCount: 0,
        failureCount: 0,
      });

      const rule2 = await service.createRule({
        id: '',
        userId,
        name: 'Rule 2',
        conditions: [{ field: 'category', operator: 'eq', value: 'electronics' }],
        action: { type: 'auto_buy', parameters: {} },
        maxSpendPerMonth: 50000,
        maxOrderValue: 25000,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0,
        successCount: 0,
        failureCount: 0,
      });

      const rules = await service.getUserRules(userId);

      expect(rules.length).toBe(2);
      expect(rules.some((r) => r.id === rule1.id)).toBe(true);
      expect(rules.some((r) => r.id === rule2.id)).toBe(true);
    });

    it('should not return inactive rules', async () => {
      const userId = 'user789';

      const rule1 = await service.createRule({
        id: '',
        userId,
        name: 'Active Rule',
        conditions: [{ field: 'price', operator: 'lte', value: 10000 }],
        action: { type: 'auto_buy', parameters: {} },
        maxSpendPerMonth: 50000,
        maxOrderValue: 25000,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0,
        successCount: 0,
        failureCount: 0,
      });

      const rule2 = await service.createRule({
        id: '',
        userId,
        name: 'Inactive Rule',
        conditions: [{ field: 'category', operator: 'eq', value: 'electronics' }],
        action: { type: 'auto_buy', parameters: {} },
        maxSpendPerMonth: 50000,
        maxOrderValue: 25000,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0,
        successCount: 0,
        failureCount: 0,
      });

      await service.disableRule(rule2.id);
      const rules = await service.getUserRules(userId);

      expect(rules.length).toBe(1);
      expect(rules[0].id).toBe(rule1.id);
    });
  });

  describe('recordRuleExecution', () => {
    it('should increment trigger count on execution', async () => {
      const rule = await service.createRule({
        id: '',
        userId: 'user999',
        name: 'Test Rule',
        conditions: [{ field: 'price', operator: 'lte', value: 10000 }],
        action: { type: 'auto_buy', parameters: {} },
        maxSpendPerMonth: 50000,
        maxOrderValue: 25000,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0,
        successCount: 0,
        failureCount: 0,
      });

      await service.recordRuleExecution(rule.id, true);

      const stats = await service.getRuleStats(rule.id);
      expect(stats.triggerCount).toBe(1);
      expect(stats.successRate).toBe(1.0);
    });

    it('should track success and failure counts', async () => {
      const rule = await service.createRule({
        id: '',
        userId: 'user1000',
        name: 'Test Rule',
        conditions: [{ field: 'price', operator: 'lte', value: 10000 }],
        action: { type: 'auto_buy', parameters: {} },
        maxSpendPerMonth: 50000,
        maxOrderValue: 25000,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0,
        successCount: 0,
        failureCount: 0,
      });

      await service.recordRuleExecution(rule.id, true);
      await service.recordRuleExecution(rule.id, true);
      await service.recordRuleExecution(rule.id, false);

      const stats = await service.getRuleStats(rule.id);
      expect(stats.triggerCount).toBe(3);
      expect(stats.successRate).toBe(2 / 3);
    });
  });
});
