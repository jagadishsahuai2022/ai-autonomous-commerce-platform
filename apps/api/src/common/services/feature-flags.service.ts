import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { CacheService } from './cache.service';

/**
 * PRODUCTION-GRADE FEATURE FLAGS
 * Control feature rollout, A/B testing, kill switches
 */

export interface FeatureFlagConfig {
  name: string;
  description?: string;
  isEnabled: boolean;
  rolloutPercentage: number; // 0-100
  targetUserIds?: number[]; // For canary/targeted rollout
}

@Injectable()
export class FeatureFlagsService {
  constructor(
    private prismaService: PrismaService,
    private cacheService: CacheService
  ) {
    this.initializeCommonFlags();
  }

  /**
   * Check if feature is enabled for user
   */
  async isFeatureEnabled(featureName: string, userId?: number): Promise<boolean> {
    const flag = await this.getFlag(featureName);

    if (!flag || !flag.isEnabled) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const userHash = userId ? userId % 100 : Math.floor(Math.random() * 100);

      if (userHash >= flag.rolloutPercentage) {
        return false;
      }
    }

    // Check target user IDs (for canary/manual rollout)
    if (flag.targetUserIds && flag.targetUserIds.length > 0) {
      if (userId && !flag.targetUserIds.includes(userId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get feature flag
   */
  async getFlag(name: string): Promise<FeatureFlagConfig | null> {
    // Try cache first
    const cached = await this.cacheService.get<FeatureFlagConfig>(`feature_flag:${name}`);
    if (cached !== null) {
      return cached;
    }

    const flag = await this.prismaService.featureFlag.findUnique({
      where: { name },
    });

    if (flag) {
      await this.cacheService.set(`feature_flag:${name}`, flag, 300); // 5 min cache
    }

    return flag as unknown as FeatureFlagConfig;
  }

  /**
   * Create or update feature flag
   */
  async setFlag(config: FeatureFlagConfig): Promise<void> {
    const existing = await this.prismaService.featureFlag.findUnique({
      where: { name: config.name },
    });

    if (existing) {
      await this.prismaService.featureFlag.update({
        where: { name: config.name },
        data: {
          description: config.description,
          isEnabled: config.isEnabled,
          rolloutPercentage: config.rolloutPercentage,
          targetUserIds: (config.targetUserIds || []).map(String),
        },
      });
    } else {
      await this.prismaService.featureFlag.create({
        data: {
          name: config.name,
          description: config.description,
          isEnabled: config.isEnabled,
          rolloutPercentage: config.rolloutPercentage,
          targetUserIds: (config.targetUserIds || []).map(String),
        },
      });
    }

    // Invalidate cache
    await this.cacheService.invalidate(`feature_flag:${config.name}`);
  }

  /**
   * Enable feature globally
   */
  async enableFeature(name: string): Promise<void> {
    const flag = await this.getFlag(name);
    if (flag) {
      await this.setFlag({ ...flag, isEnabled: true, rolloutPercentage: 100 });
    }
  }

  /**
   * Disable feature (kill switch)
   */
  async disableFeature(name: string): Promise<void> {
    const flag = await this.getFlag(name);
    if (flag) {
      await this.setFlag({ ...flag, isEnabled: false, rolloutPercentage: 0 });
    }
  }

  /**
   * Gradual rollout (percentage-based)
   */
  async rolloutFeature(name: string, percentage: number): Promise<void> {
    const flag = await this.getFlag(name);
    if (flag) {
      await this.setFlag({
        ...flag,
        isEnabled: percentage > 0,
        rolloutPercentage: Math.min(percentage, 100),
      });
    }
  }

  /**
   * Canary rollout (target specific users)
   */
  async canaryRollout(name: string, userIds: number[]): Promise<void> {
    const flag = await this.getFlag(name);
    if (flag) {
      await this.setFlag({
        ...flag,
        isEnabled: true,
        targetUserIds: userIds,
      });
    }
  }

  /**
   * Get all flags
   */
  async getAllFlags(): Promise<FeatureFlagConfig[]> {
    return this.prismaService.featureFlag.findMany() as unknown as Promise<FeatureFlagConfig[]>;
  }

  /**
   * Get flag status for monitoring
   */
  async getStatus(): Promise<Record<string, any>> {
    const flags = await this.getAllFlags();
    return flags.reduce(
      (acc, flag) => {
        acc[flag.name] = {
          enabled: flag.isEnabled,
          rolloutPercentage: flag.rolloutPercentage,
          targetUserCount: flag.targetUserIds?.length || 0,
        };
        return acc;
      },
      {} as Record<string, any>
    );
  }

  /**
   * A/B Testing helpers
   */

  async isVariantA(testName: string, userId: number): Promise<boolean> {
    const hash = userId % 2;
    return hash === 0;
  }

  async isVariantB(testName: string, userId: number): Promise<boolean> {
    const hash = userId % 2;
    return hash === 1;
  }

  /**
   * Initialize common flags
   */
  private async initializeCommonFlags(): Promise<void> {
    const commonFlags: FeatureFlagConfig[] = [
      {
        name: 'ai_shopping_enabled',
        description: 'Enable AI-powered shopping assistant',
        isEnabled: true,
        rolloutPercentage: 100,
      },
      {
        name: 'auto_ranking_enabled',
        description: 'Enable automatic product ranking',
        isEnabled: true,
        rolloutPercentage: 100,
      },
      {
        name: 'wallet_ai_authorized',
        description: 'Allow AI to authorize wallet transactions',
        isEnabled: false, // Disabled by default for safety
        rolloutPercentage: 0,
      },
      {
        name: 'seller_ai_pricing',
        description: 'Enable AI pricing suggestions for sellers',
        isEnabled: true,
        rolloutPercentage: 50, // 50% rollout
      },
      {
        name: 'demo_mode_enabled',
        description: 'Enable demo mode for showcasing',
        isEnabled: true,
        rolloutPercentage: 100,
      },
      {
        name: 'advanced_search',
        description: 'Advanced search filters',
        isEnabled: true,
        rolloutPercentage: 100,
      },
      {
        name: 'product_comparison',
        description: 'Product comparison feature',
        isEnabled: true,
        rolloutPercentage: 100,
      },
      {
        name: 'seller_analytics',
        description: 'Seller analytics dashboard',
        isEnabled: true,
        rolloutPercentage: 75,
      },
      {
        name: 'mobile_v2',
        description: 'New mobile app version',
        isEnabled: false,
        rolloutPercentage: 0,
      },
      {
        name: 'social_commerce',
        description: 'Social commerce features (sharing, groups)',
        isEnabled: false,
        rolloutPercentage: 0,
      },
    ];

    for (const flag of commonFlags) {
      const existing = await this.getFlag(flag.name);
      if (!existing) {
        await this.setFlag(flag);
      }
    }
  }
}
