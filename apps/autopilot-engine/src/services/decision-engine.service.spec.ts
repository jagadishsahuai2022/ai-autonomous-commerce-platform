/**
 * Decision Engine Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DecisionEngine } from '../services/decision-engine.service';
import { DecisionContext, ProductData, UserPurchaseHistory } from '../types';

describe('DecisionEngine', () => {
  let service: DecisionEngine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DecisionEngine],
    }).compile();

    service = module.get<DecisionEngine>(DecisionEngine);
  });

  describe('makeDecision', () => {
    it('should make a high-confidence decision for familiar product', async () => {
      const context: DecisionContext = {
        userId: 'user123',
        ruleId: 'rule456',
        product: {
          id: 'prod789',
          name: 'Samsung Galaxy S21',
          price: 45000,
          category: 'smartphones',
          brand: 'Samsung',
          rating: 4.7,
          stock: 8,
          imageUrl: 'http://example.com/phone.jpg',
        },
        userHistory: {
          userId: 'user123',
          totalPurchases: 15,
          totalSpent: 680000, // Average: ~45k per purchase
          returnRate: 0.05,
          averageRating: 4.6,
          purchasesByCategory: { smartphones: 8, accessories: 5, electronics: 2 },
          lastPurchaseDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        minimumConfidenceThreshold: 0.6,
        rankingScore: 85,
        intentScore: 80,
      };

      const decision = await service.makeDecision(context);

      expect(decision).toBeDefined();
      expect(decision.id).toBeDefined();
      expect(decision.confidence.overall).toBeGreaterThan(0.7);
      expect(decision.shouldProceed).toBe(true);
      expect(decision.riskLevel).toBe('low');
    });

    it('should make a low-confidence decision for unfamiliar product', async () => {
      const context: DecisionContext = {
        userId: 'user456',
        ruleId: 'rule789',
        product: {
          id: 'prod999',
          name: 'Niche Brand Premium Camera',
          price: 85000,
          category: 'cameras',
          brand: 'UnknownBrand',
          rating: 3.2,
          stock: 2,
          imageUrl: 'http://example.com/camera.jpg',
        },
        userHistory: {
          userId: 'user456',
          totalPurchases: 2, // New user
          totalSpent: 15000,
          returnRate: 0.3,
          averageRating: 3.0,
          purchasesByCategory: { electronics: 2 },
          lastPurchaseDate: new Date(),
        },
        minimumConfidenceThreshold: 0.6,
        rankingScore: 35,
        intentScore: 40,
      };

      const decision = await service.makeDecision(context);

      expect(decision).toBeDefined();
      expect(decision.confidence.overall).toBeLessThan(0.6);
      expect(decision.shouldProceed).toBe(false);
      expect(decision.riskLevel).toBe('high');
    });

    it('should require approval for medium confidence', async () => {
      const context: DecisionContext = {
        userId: 'user789',
        ruleId: 'rule111',
        product: {
          id: 'prodABC',
          name: 'Mid-range Headphones',
          price: 3000,
          category: 'audio',
          brand: 'TechBrand',
          rating: 4.0,
          stock: 15,
          imageUrl: 'http://example.com/headphones.jpg',
        },
        userHistory: {
          userId: 'user789',
          totalPurchases: 5,
          totalSpent: 25000,
          returnRate: 0.1,
          averageRating: 4.2,
          purchasesByCategory: { audio: 0, electronics: 5 },
          lastPurchaseDate: new Date(),
        },
        minimumConfidenceThreshold: 0.6,
        rankingScore: 70,
        intentScore: 65,
      };

      const decision = await service.makeDecision(context);

      expect(decision.confidence.overall).toBeGreaterThanOrEqual(0.65);
      expect(decision.confidence.overall).toBeLessThan(0.85);
      expect(decision.requiresApproval).toBe(true);
    });
  });

  describe('confidence scoring factors', () => {
    it('should score price relevance based on history', async () => {
      const lowPriceContext: DecisionContext = {
        userId: 'user_price1',
        ruleId: 'rule_price1',
        product: {
          id: 'prod_price1',
          name: 'Budget Phone',
          price: 8000,
          category: 'smartphones',
          brand: 'Xiaomi',
          rating: 4.3,
          stock: 10,
          imageUrl: '',
        },
        userHistory: {
          userId: 'user_price1',
          totalPurchases: 10,
          totalSpent: 320000, // Average: 32k per purchase
          returnRate: 0.05,
          averageRating: 4.5,
          purchasesByCategory: {},
          lastPurchaseDate: new Date(),
        },
        minimumConfidenceThreshold: 0.5,
      };

      const decision = await service.makeDecision(lowPriceContext);
      expect(decision.confidence.factors.priceConfidence).toBeLessThan(0.5);
    });

    it('should score product quality by rating and stock', async () => {
      const highQualityContext: DecisionContext = {
        userId: 'user_quality',
        ruleId: 'rule_quality',
        product: {
          id: 'prod_quality',
          name: 'Premium Product',
          price: 50000,
          category: 'smartphones',
          brand: 'Apple',
          rating: 4.8,
          stock: 25,
          imageUrl: '',
        },
        userHistory: {
          userId: 'user_quality',
          totalPurchases: 5,
          totalSpent: 200000,
          returnRate: 0.02,
          averageRating: 4.7,
          purchasesByCategory: {},
          lastPurchaseDate: new Date(),
        },
        minimumConfidenceThreshold: 0.5,
      };

      const decision = await service.makeDecision(highQualityContext);
      expect(decision.confidence.factors.qualityConfidence).toBeGreaterThan(0.7);
    });

    it('should score history confidence for repeat buyers', async () => {
      const repeatBuyerContext: DecisionContext = {
        userId: 'user_repeat',
        ruleId: 'rule_repeat',
        product: {
          id: 'prod_repeat',
          name: 'Common Product',
          price: 15000,
          category: 'smartphones',
          brand: 'Samsung',
          rating: 4.5,
          stock: 8,
          imageUrl: '',
        },
        userHistory: {
          userId: 'user_repeat',
          totalPurchases: 50, // Many purchases
          totalSpent: 750000,
          returnRate: 0.05,
          averageRating: 4.6,
          purchasesByCategory: { smartphones: 20, accessories: 15, electronics: 15 },
          lastPurchaseDate: new Date(),
        },
        minimumConfidenceThreshold: 0.5,
      };

      const decision = await service.makeDecision(repeatBuyerContext);
      expect(decision.confidence.factors.historyConfidence).toBeGreaterThan(0.7);
    });

    it('should score lower for new users', async () => {
      const newUserContext: DecisionContext = {
        userId: 'user_new',
        ruleId: 'rule_new',
        product: {
          id: 'prod_new',
          name: 'Good Product',
          price: 25000,
          category: 'smartphones',
          brand: 'Samsung',
          rating: 4.6,
          stock: 10,
          imageUrl: '',
        },
        userHistory: {
          userId: 'user_new',
          totalPurchases: 0, // No purchase history
          totalSpent: 0,
          returnRate: 0,
          averageRating: 0,
          purchasesByCategory: {},
          lastPurchaseDate: undefined,
        },
        minimumConfidenceThreshold: 0.5,
      };

      const decision = await service.makeDecision(newUserContext);
      expect(decision.confidence.factors.historyConfidence).toBeLessThan(0.5);
    });
  });

  describe('risk level calculation', () => {
    it('should classify low risk', async () => {
      const context: DecisionContext = {
        userId: 'user_low_risk',
        ruleId: 'rule_lr',
        product: {
          id: 'prod_lr',
          name: 'Product',
          price: 10000,
          category: 'smartphones',
          brand: 'Samsung',
          rating: 4.8,
          stock: 20,
          imageUrl: '',
        },
        userHistory: {
          userId: 'user_low_risk',
          totalPurchases: 30,
          totalSpent: 450000,
          returnRate: 0.02,
          averageRating: 4.7,
          purchasesByCategory: { smartphones: 20 },
          lastPurchaseDate: new Date(),
        },
        minimumConfidenceThreshold: 0.5,
        rankingScore: 90,
        intentScore: 90,
      };

      const decision = await service.makeDecision(context);
      expect(decision.riskLevel).toBe('low');
    });

    it('should classify medium risk', async () => {
      const context: DecisionContext = {
        userId: 'user_med_risk',
        ruleId: 'rule_mr',
        product: {
          id: 'prod_mr',
          name: 'Product',
          price: 20000,
          category: 'electronics',
          brand: 'Generic',
          rating: 3.8,
          stock: 5,
          imageUrl: '',
        },
        userHistory: {
          userId: 'user_med_risk',
          totalPurchases: 10,
          totalSpent: 100000,
          returnRate: 0.1,
          averageRating: 4.0,
          purchasesByCategory: {},
          lastPurchaseDate: new Date(),
        },
        minimumConfidenceThreshold: 0.5,
      };

      const decision = await service.makeDecision(context);
      expect(decision.riskLevel).toBe('medium');
    });

    it('should classify high risk', async () => {
      const context: DecisionContext = {
        userId: 'user_high_risk',
        ruleId: 'rule_hr',
        product: {
          id: 'prod_hr',
          name: 'Risky Product',
          price: 100000,
          category: 'cameras',
          brand: 'Unknown',
          rating: 2.5,
          stock: 1,
          imageUrl: '',
        },
        userHistory: {
          userId: 'user_high_risk',
          totalPurchases: 0,
          totalSpent: 0,
          returnRate: 0,
          averageRating: 0,
          purchasesByCategory: {},
          lastPurchaseDate: undefined,
        },
        minimumConfidenceThreshold: 0.5,
        rankingScore: 20,
        intentScore: 30,
      };

      const decision = await service.makeDecision(context);
      expect(decision.riskLevel).toBe('high');
    });
  });

  describe('reasoning generation', () => {
    it('should generate positive reasoning for good decisions', async () => {
      const context: DecisionContext = {
        userId: 'user_reasoning',
        ruleId: 'rule_reasoning',
        product: {
          id: 'prod_reasoning',
          name: 'Great Phone',
          price: 45000,
          category: 'smartphones',
          brand: 'Samsung',
          rating: 4.7,
          stock: 15,
          imageUrl: '',
        },
        userHistory: {
          userId: 'user_reasoning',
          totalPurchases: 20,
          totalSpent: 900000,
          returnRate: 0.03,
          averageRating: 4.6,
          purchasesByCategory: { smartphones: 15 },
          lastPurchaseDate: new Date(),
        },
        minimumConfidenceThreshold: 0.5,
      };

      const decision = await service.makeDecision(context);

      expect(decision.reasoning.positiveFactors.length).toBeGreaterThan(0);
      expect(decision.reasoning.summary).toBeDefined();
      expect(decision.reasoning.summary.length).toBeGreaterThan(0);
    });

    it('should include limited stock warning', async () => {
      const context: DecisionContext = {
        userId: 'user_stock_warn',
        ruleId: 'rule_stock',
        product: {
          id: 'prod_stock',
          name: 'Limited Product',
          price: 30000,
          category: 'smartphones',
          brand: 'Samsung',
          rating: 4.5,
          stock: 2, // Very low stock
          imageUrl: '',
        },
        userHistory: {
          userId: 'user_stock_warn',
          totalPurchases: 10,
          totalSpent: 300000,
          returnRate: 0.05,
          averageRating: 4.4,
          purchasesByCategory: { smartphones: 10 },
          lastPurchaseDate: new Date(),
        },
        minimumConfidenceThreshold: 0.5,
      };

      const decision = await service.makeDecision(context);

      expect(decision.reasoning.positiveFactors.some((f) => f.includes('Limited stock'))).toBe(
        true
      );
    });
  });

  describe('decision outcome recording', () => {
    it('should record successful decision outcome', async () => {
      const context: DecisionContext = {
        userId: 'user_outcome',
        ruleId: 'rule_outcome',
        product: {
          id: 'prod_outcome',
          name: 'Product',
          price: 15000,
          category: 'smartphones',
          brand: 'Samsung',
          rating: 4.5,
          stock: 5,
          imageUrl: '',
        },
        userHistory: {
          userId: 'user_outcome',
          totalPurchases: 5,
          totalSpent: 75000,
          returnRate: 0.05,
          averageRating: 4.4,
          purchasesByCategory: {},
          lastPurchaseDate: new Date(),
        },
        minimumConfidenceThreshold: 0.5,
      };

      const decision = await service.makeDecision(context);

      expect(async () => {
        await service.recordDecisionOutcome(decision.id, true, true);
      }).not.toThrow();
    });
  });
});
