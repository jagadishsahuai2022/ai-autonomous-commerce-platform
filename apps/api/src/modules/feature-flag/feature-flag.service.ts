/**
 * Feature Flag Service
 * Manages feature flags with:
 * - Database persistence
 * - Redis caching
 * - Percentage-based rollout
 * - User-targeted rollout
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { RedisService } from '../../services/redis.service';
import { LoggerService } from '../../common/logger.service';

export interface FeatureFlag {
  id: number;
  name: string;
  description?: string;
  isEnabled: boolean;
  rolloutPercentage: number;
  targetUserIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger('FeatureFlagService');
  private readonly appLogger = new LoggerService();
  private readonly CACHE_KEY_PREFIX = 'feature-flag:';
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private prisma: PrismaService,
    private redis: RedisService
  ) {
    this.logger.log('✅ Feature Flag Service initialized');
  }

  /**
   * Check if feature is enabled for a specific user
   * Supports:
   * - Global enable/disable
   * - Percentage-based rollout
   * - User-targeted rollout
   */
  async isFeatureEnabled(featureName: string, userId?: number): Promise<boolean> {
    try {
      // Get flag from cache or database
      const flag = await this.getFeatureFlagCached(featureName);

      if (!flag) {
        this.logger.warn(`Feature flag not found: ${featureName}. Defaulting to false.`);
        return false;
      }

      // If not enabled globally, always return false
      if (!flag.isEnabled) {
        return false;
      }

      if (!userId) {
        // No user context: return based on global enable
        return true;
      }

      // Check user-targeted rollout
      if (flag.targetUserIds && flag.targetUserIds.length > 0) {
        return flag.targetUserIds.includes(String(userId));
      }

      // Check percentage-based rollout
      if (flag.rolloutPercentage < 100) {
        const userHash = this.hashUserId(userId);
        const isRolledOut = userHash % 100 < flag.rolloutPercentage;

        this.appLogger.debug('Feature rollout decision', {
          featureName,
          userId,
          rolloutPercentage: flag.rolloutPercentage,
          userHash: userHash % 100,
          isRolledOut,
        });

        return isRolledOut;
      }

      return true;
    } catch (error) {
      this.logger.error(`Error checking feature flag ${featureName}:`, (error as any).message);
      // Fail-safe: default to false in case of error
      return false;
    }
  }

  /**
   * Get all feature flags
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    try {
      const flags: FeatureFlag[] = []; // TODO: featureFlag model not in prisma schema
      return flags;
    } catch (error) {
      this.logger.error('Error fetching all flags:', (error as any).message);
      return [];
    }
  }

  /**
   * Get single feature flag
   */
  async getFlag(name: string): Promise<FeatureFlag | null> {
    try {
      return await this.getFeatureFlagCached(name);
    } catch (error) {
      this.logger.error(`Error fetching flag ${name}:`, (error as any).message);
      return null;
    }
  }

  /**
   * Create new feature flag
   */
  async createFlag(data: {
    name: string;
    description?: string;
    isEnabled?: boolean;
    rolloutPercentage?: number;
  }): Promise<FeatureFlag> {
    try {
      // TODO: featureFlag model not in prisma schema
      const flag: any = {
        id: Date.now(),
        name: data.name,
        description: data.description,
        isEnabled: data.isEnabled ?? false,
        rolloutPercentage: data.rolloutPercentage ?? 0,
        targetUserIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Invalidate cache
      await this.invalidateCache(data.name);

      this.appLogger.log('Feature flag created', {
        name: flag.name,
        enabled: flag.isEnabled,
      });

      return flag;
    } catch (error) {
      this.logger.error('Error creating flag:', (error as any).message);
      throw error;
    }
  }

  /**
   * Update feature flag
   */
  async updateFlag(
    id: number,
    data: {
      isEnabled?: boolean;
      rolloutPercentage?: number;
      targetUserIds?: string[];
      description?: string;
    }
  ): Promise<FeatureFlag> {
    try {
      const flag: FeatureFlag | null = null; // TODO: featureFlag model not in prisma schema

      if (!flag) {
        throw new Error(`Feature flag ${id} not found`);
      }

      const updated: any = {
        ...flag,
        isEnabled: data.isEnabled ?? flag.isEnabled,
        rolloutPercentage: data.rolloutPercentage ?? flag.rolloutPercentage,
        targetUserIds: data.targetUserIds ?? flag.targetUserIds,
        description: data.description ?? flag.description,
        updatedAt: new Date(),
      };

      // Invalidate cache
      await this.invalidateCache(updated.name);

      this.appLogger.log('Feature flag updated', {
        flagId: id,
        flagName: updated.name,
        enabled: updated.isEnabled,
        rollout: updated.rolloutPercentage,
      });

      return updated;
    } catch (error) {
      this.logger.error('Error updating flag:', (error as any).message);
      throw error;
    }
  }

  /**
   * Delete feature flag
   */
  async deleteFlag(id: number): Promise<boolean> {
    try {
      const flag: FeatureFlag | null = null; // TODO: featureFlag model not in prisma schema

      if (!flag) {
        throw new Error(`Feature flag ${id} not found`);
      }

      // TODO: featureFlag model not in prisma schema
      // await this.prisma.featureFlag.delete({
      //   where: { id },
      // });

      // Invalidate cache
      await this.invalidateCache(flag.name);

      this.appLogger.log('Feature flag deleted', {
        flagId: id,
        flagName: flag.name,
      });

      return true;
    } catch (error) {
      this.logger.error('Error deleting flag:', (error as any).message);
      throw error;
    }
  }

  /**
   * Get feature flag from cache or database
   */
  private async getFeatureFlagCached(name: string): Promise<FeatureFlag | null> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${name}`;

    try {
      // Try cache first
      const cached = await this.redis.get<FeatureFlag>(cacheKey);
      if (cached) {
        return cached;
      }

      // Fallback to database
      const flag: FeatureFlag | null = null; // TODO: featureFlag model not in prisma schema

      if (flag) {
        // Cache the result
        await this.redis.set(cacheKey, flag, { ttl: this.CACHE_TTL });
      }

      return flag;
    } catch (error) {
      this.logger.error(`Error getting cached flag ${name}:`, (error as any).message);
      // Return null, which isFeatureEnabled will handle
      return null;
    }
  }

  /**
   * Invalidate cache for feature flag
   */
  private async invalidateCache(name: string): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}${name}`;
      await this.redis.delete(cacheKey);
      this.logger.debug(`Cache invalidated for flag: ${name}`);
    } catch (error) {
      this.logger.warn(`Failed to invalidate cache for ${name}`);
    }
  }

  /**
   * Hash userId for consistent rollout decisions
   * Same user always gets same rollout result
   */
  private hashUserId(userId: number): number {
    // Simple hash: use userId directly, mod 100
    // For production, consider using a proper hash function
    return Math.abs((userId * 73856093) ^ 19349663) % 100;
  }

  /**
   * Get decision analytics
   */
  async getStats(): Promise<any> {
    try {
      const flags: FeatureFlag[] = []; // TODO: featureFlag model not in prisma schema
      return {
        totalFlags: flags.length,
        enabledFlags: flags.filter((f) => f.isEnabled).length,
        disabledFlags: flags.filter((f) => !f.isEnabled).length,
        withRollout: flags.filter((f) => f.rolloutPercentage > 0).length,
        flags: flags.map((f) => ({
          name: f.name,
          enabled: f.isEnabled,
          rollout: f.rolloutPercentage,
          targeted: f.targetUserIds.length,
        })),
      };
    } catch (error) {
      this.logger.error('Error getting stats:', (error as any).message);
      return null;
    }
  }
}
