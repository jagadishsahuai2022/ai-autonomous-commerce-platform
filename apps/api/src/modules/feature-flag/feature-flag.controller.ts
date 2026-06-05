/**
 * Feature Flag Controller
 * REST API for managing feature flags
 */

import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Logger } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { LoggerService } from '../../common/logger.service';

@Controller('feature-flags')
export class FeatureFlagController {
  private readonly logger = new Logger('FeatureFlagController');
  private readonly appLogger = new LoggerService();

  constructor(private readonly featureFlagService: FeatureFlagService) {}

  /**
   * GET /feature-flags
   * Get all feature flags
   */
  @Get()
  async getAllFlags() {
    try {
      const flags = await this.featureFlagService.getAllFlags();
      return {
        success: true,
        data: flags,
        count: flags.length,
      };
    } catch (error) {
      this.logger.error('Error fetching flags:', (error as any).message);
      return {
        success: false,
        error: 'Failed to fetch feature flags',
      };
    }
  }

  /**
   * GET /feature-flags/stats
   * Get feature flag statistics
   */
  @Get('stats')
  async getStats() {
    try {
      const stats = await this.featureFlagService.getStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Error fetching stats:', (error as any).message);
      return {
        success: false,
        error: 'Failed to fetch statistics',
      };
    }
  }

  /**
   * GET /feature-flags/check?name=ai_assistant&userId=1
   * Check if flag is enabled for user
   */
  @Get('check')
  async checkFlag(@Query('name') name: string, @Query('userId') userId?: string) {
    try {
      if (!name) {
        return {
          success: false,
          error: 'Flag name is required',
        };
      }

      const isEnabled = await this.featureFlagService.isFeatureEnabled(
        name,
        userId ? parseInt(userId, 10) : undefined
      );

      this.appLogger.debug('Feature flag checked', {
        flag: name,
        userId,
        enabled: isEnabled,
      });

      return {
        success: true,
        flag: name,
        enabled: isEnabled,
      };
    } catch (error) {
      this.logger.error('Error checking flag:', (error as any).message);
      return {
        success: false,
        enabled: false,
        error: 'Failed to check feature flag',
      };
    }
  }

  /**
   * GET /feature-flags/user/:userId
   * Get all flags evaluated for a specific user (mobile-client endpoint).
   * Returns { flags: Record<string, boolean> } — all known flags with their
   * effective value for this user (percentage rollout + target list applied).
   */
  @Get('user/:userId')
  async getFlagsForUser(@Param('userId') userId: string) {
    try {
      const uid = parseInt(userId, 10);
      const allFlags = await this.featureFlagService.getAllFlags();
      const entries = await Promise.all(
        allFlags.map(async (flag) => {
          const enabled = await this.featureFlagService.isFeatureEnabled(
            flag.name,
            isNaN(uid) ? undefined : uid
          );
          return [flag.name, enabled] as [string, boolean];
        })
      );
      return { flags: Object.fromEntries(entries) };
    } catch (error) {
      this.logger.error('Error fetching flags for user:', (error as any).message);
      return { flags: {} };
    }
  }

  /**
   * GET /feature-flags/:id
   * Get single feature flag by ID
   */
  @Get(':id')
  async getFlag(@Param('id') id: string) {
    try {
      // Parse as name first
      const flag = await this.featureFlagService.getFlag(id);

      if (!flag) {
        return {
          success: false,
          error: `Feature flag ${id} not found`,
        };
      }

      return {
        success: true,
        data: flag,
      };
    } catch (error) {
      this.logger.error('Error fetching flag:', (error as any).message);
      return {
        success: false,
        error: 'Failed to fetch feature flag',
      };
    }
  }

  /**
   * POST /feature-flags
   * Create new feature flag
   */
  @Post()
  async createFlag(
    @Body()
    body: {
      name: string;
      description?: string;
      isEnabled?: boolean;
      rolloutPercentage?: number;
    }
  ) {
    try {
      if (!body.name) {
        return {
          success: false,
          error: 'Flag name is required',
        };
      }

      const flag = await this.featureFlagService.createFlag(body);

      this.appLogger.log('Feature flag created via API', {
        flagName: flag.name,
        enabled: flag.isEnabled,
      });

      return {
        success: true,
        data: flag,
      };
    } catch (error) {
      this.logger.error('Error creating flag:', (error as any).message);
      return {
        success: false,
        error: 'Failed to create feature flag',
      };
    }
  }

  /**
   * PATCH /feature-flags/:id
   * Update feature flag
   */
  @Patch(':id')
  async updateFlag(
    @Param('id') id: string,
    @Body()
    body: {
      isEnabled?: boolean;
      rolloutPercentage?: number;
      targetUserIds?: string[];
      description?: string;
    }
  ) {
    try {
      const flagId = parseInt(id, 10);
      const flag = await this.featureFlagService.updateFlag(flagId, body);

      this.appLogger.log('Feature flag updated via API', {
        flagId,
        flagName: flag.name,
        enabled: flag.isEnabled,
        rollout: flag.rolloutPercentage,
      });

      return {
        success: true,
        data: flag,
      };
    } catch (error) {
      this.logger.error('Error updating flag:', (error as any).message);
      return {
        success: false,
        error: 'Failed to update feature flag',
      };
    }
  }

  /**
   * DELETE /feature-flags/:id
   * Delete feature flag
   */
  @Delete(':id')
  async deleteFlag(@Param('id') id: string) {
    try {
      const flagId = parseInt(id, 10);
      const success = await this.featureFlagService.deleteFlag(flagId);

      return {
        success,
        message: 'Feature flag deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting flag:', (error as any).message);
      return {
        success: false,
        error: 'Failed to delete feature flag',
      };
    }
  }
}
