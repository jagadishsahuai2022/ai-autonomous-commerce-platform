/**
 * Autopilot Controller
 * REST API endpoints for autopilot engine
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RuleEngine } from '../services/rule-engine.service';
import { DecisionEngine } from '../services/decision-engine.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { AutopilotRule, DecisionContext } from '../types';

@Controller('autopilot')
export class AutopilotController {
  private readonly logger = new Logger(AutopilotController.name);

  constructor(
    private ruleEngine: RuleEngine,
    private decisionEngine: DecisionEngine,
    private kafkaProducer: KafkaProducerService
  ) {}

  /**
   * Create new autopilot rule
   * POST /autopilot/rules
   */
  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  async createRule(@Body() rule: AutopilotRule) {
    try {
      const created = await this.ruleEngine.createRule(rule);
      await this.kafkaProducer.publishRuleCreated(created.id, created.userId);
      return {
        success: true,
        data: created,
        message: 'Rule created successfully',
      };
    } catch (error) {
      this.logger.error('Failed to create rule', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create rule',
      };
    }
  }

  /**
   * Get all rules for a user
   * GET /autopilot/rules?userId=xxx
   */
  @Get('rules')
  async getUserRules(@Query('userId') userId: string) {
    try {
      const rules = await this.ruleEngine.getUserRules(userId);
      return {
        success: true,
        data: rules,
        count: rules.length,
      };
    } catch (error) {
      this.logger.error('Failed to fetch user rules', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch rules',
      };
    }
  }

  /**
   * Get specific rule
   * GET /autopilot/rules/:ruleId
   */
  @Get('rules/:ruleId')
  async getRule(@Param('ruleId') ruleId: string) {
    try {
      const rule = await this.ruleEngine.getRule(ruleId);
      if (!rule) {
        return {
          success: false,
          error: 'Rule not found',
        };
      }
      return {
        success: true,
        data: rule,
      };
    } catch (error) {
      this.logger.error('Failed to fetch rule', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch rule',
      };
    }
  }

  /**
   * Update rule
   * PUT /autopilot/rules/:ruleId
   */
  @Put('rules/:ruleId')
  async updateRule(@Param('ruleId') ruleId: string, @Body() updates: Partial<AutopilotRule>) {
    try {
      const updated = await this.ruleEngine.updateRule(ruleId, updates);
      return {
        success: true,
        data: updated,
        message: 'Rule updated successfully',
      };
    } catch (error) {
      this.logger.error('Failed to update rule', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update rule',
      };
    }
  }

  /**
   * Disable rule
   * DELETE /autopilot/rules/:ruleId
   */
  @Delete('rules/:ruleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableRule(@Param('ruleId') ruleId: string) {
    try {
      await this.ruleEngine.disableRule(ruleId);
      return {
        success: true,
        message: 'Rule disabled successfully',
      };
    } catch (error) {
      this.logger.error('Failed to disable rule', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable rule',
      };
    }
  }

  /**
   * Evaluate decision
   * POST /autopilot/evaluate
   */
  @Post('evaluate')
  async evaluateDecision(@Body() context: DecisionContext) {
    try {
      const decision = await this.decisionEngine.makeDecision(context);

      if (decision.shouldProceed) {
        await this.kafkaProducer.publishDecisionTriggered(
          decision.id,
          context.ruleId || 'manual',
          context.userId,
          context.product.id
        );
      }

      return {
        success: true,
        data: decision,
        message: 'Decision evaluated successfully',
      };
    } catch (error) {
      this.logger.error('Failed to evaluate decision', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to evaluate decision',
      };
    }
  }

  /**
   * Get rule statistics
   * GET /autopilot/rules/:ruleId/stats
   */
  @Get('rules/:ruleId/stats')
  async getRuleStats(@Param('ruleId') ruleId: string) {
    try {
      const stats = await this.ruleEngine.getRuleStats(ruleId);
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Failed to fetch rule stats', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch statistics',
      };
    }
  }

  /**
   * Health check
   * GET /autopilot/health
   */
  @Get('health')
  async health() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'autopilot-engine',
      version: '1.0.0',
    };
  }
}
