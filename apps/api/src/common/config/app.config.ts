import { Injectable } from '@nestjs/common';

/**
 * PRODUCTION-GRADE ENVIRONMENT CONFIGURATION
 * Centralized configuration management with validation
 */

export interface AppConfig {
  // App
  nodeEnv: 'development' | 'staging' | 'production';
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  port: number;
  apiPrefix: string;

  // Database
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
    ssl: boolean;
    poolSize: number;
    maxConnections: number;
  };

  // Redis
  redis: {
    host: string;
    port: number;
    db: number;
    password?: string;
    ttl: number;
    keyPrefix: string;
  };

  // JWT
  jwt: {
    secret: string;
    accessTokenExpiry: number;
    refreshTokenExpiry: number;
  };

  // Kafka
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
    ssl: boolean;
    sasl: {
      enabled: boolean;
      mechanism: string;
      username?: string;
      password?: string;
    };
  };

  // Rate Limiting
  rateLimiting: {
    enabled: boolean;
    requestsPerWindow: number;
    windowSizeMs: number;
    strictMode: boolean;
  };

  // AI Services
  aiServices: {
    intentParserUrl: string;
    productAggregatorUrl: string;
    rankingEngineUrl: string;
    timeout: number;
  };

  // Features
  features: {
    demoMode: boolean;
    aiPoweredRanking: boolean;
    walletAutoApproval: boolean;
    sellerAiFeatures: boolean;
  };

  // Observability
  observability: {
    metricsEnabled: boolean;
    tracingEnabled: boolean;
    metricsPort: number;
  };

  // Security
  security: {
    corsOrigins: string[];
    allowedHosts: string[];
    requireHttps: boolean;
    csrfProtection: boolean;
  };

  // Caching
  caching: {
    enabled: boolean;
    ttlSeconds: number;
    strategyEnabled: {
      products: boolean;
      search: boolean;
      rankings: boolean;
      userPreferences: boolean;
    };
  };
}

@Injectable()
export class ConfigService {
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  private loadConfig(): AppConfig {
    return {
      // App
      nodeEnv: (process.env.NODE_ENV as any) || 'development',
      logLevel: (process.env.LOG_LEVEL as any) || 'INFO',
      port: parseInt(process.env.PORT || '3000'),
      apiPrefix: process.env.API_PREFIX || '/api/v1',

      // Database
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        name: process.env.DB_NAME || 'delegatecart',
        ssl: process.env.DB_SSL === 'true',
        poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      },

      // Redis
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: parseInt(process.env.REDIS_DB || '0'),
        password: process.env.REDIS_PASSWORD,
        ttl: parseInt(process.env.REDIS_TTL || '3600'),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'dc:',
      },

      // JWT
      jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        accessTokenExpiry: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRY || '900'),
        refreshTokenExpiry: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRY || '604800'),
      },

      // Kafka
      kafka: {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        clientId: process.env.KAFKA_CLIENT_ID || 'delegatecart-api',
        groupId: process.env.KAFKA_GROUP_ID || 'delegatecart-group',
        ssl: process.env.KAFKA_SSL === 'true',
        sasl: {
          enabled: process.env.KAFKA_SASL_ENABLED === 'true',
          mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
          username: process.env.KAFKA_SASL_USERNAME,
          password: process.env.KAFKA_SASL_PASSWORD,
        },
      },

      // Rate Limiting
      rateLimiting: {
        enabled: process.env.RATE_LIMITING_ENABLED !== 'false',
        requestsPerWindow: parseInt(process.env.RATE_LIMIT_REQUESTS || '100'),
        windowSizeMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
        strictMode: process.env.RATE_LIMIT_STRICT_MODE === 'true',
      },

      // AI Services
      aiServices: {
        intentParserUrl: process.env.INTENT_PARSER_URL || 'http://localhost:3002',
        productAggregatorUrl: process.env.PRODUCT_AGGREGATOR_URL || 'http://localhost:3001',
        rankingEngineUrl: process.env.RANKING_ENGINE_URL || 'http://localhost:3004',
        timeout: parseInt(process.env.AI_SERVICE_TIMEOUT || '30000'),
      },

      // Features
      features: {
        demoMode: process.env.DEMO_MODE_ENABLED === 'true',
        aiPoweredRanking: process.env.AI_RANKING_ENABLED !== 'false',
        walletAutoApproval: process.env.WALLET_AUTO_APPROVAL === 'true',
        sellerAiFeatures: process.env.SELLER_AI_ENABLED !== 'false',
      },

      // Observability
      observability: {
        metricsEnabled: process.env.METRICS_ENABLED !== 'false',
        tracingEnabled: process.env.TRACING_ENABLED === 'true',
        metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
      },

      // Security
      security: {
        corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
        allowedHosts: (process.env.ALLOWED_HOSTS || 'localhost').split(','),
        requireHttps: process.env.REQUIRE_HTTPS === 'true',
        csrfProtection: process.env.CSRF_PROTECTION !== 'false',
      },

      // Caching
      caching: {
        enabled: process.env.CACHING_ENABLED !== 'false',
        ttlSeconds: parseInt(process.env.CACHE_TTL || '3600'),
        strategyEnabled: {
          products: process.env.CACHE_PRODUCTS !== 'false',
          search: process.env.CACHE_SEARCH !== 'false',
          rankings: process.env.CACHE_RANKINGS !== 'false',
          userPreferences: process.env.CACHE_USER_PREFS !== 'false',
        },
      },
    };
  }

  private validateConfig(): void {
    // Validate required fields
    if (!this.config.jwt.secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    if (this.config.nodeEnv === 'production') {
      if (!this.config.database.password) {
        throw new Error('DB_PASSWORD required in production');
      }
      if (this.config.jwt.secret === 'your-secret-key-change-in-production') {
        throw new Error('JWT_SECRET must be changed in production');
      }
    }

    // eslint-disable-next-line no-console
    console.log('✅ Configuration validated successfully');
  }

  get(): AppConfig {
    return this.config;
  }

  getOrThrow(key: keyof AppConfig): any {
    const value = this.config[key];
    if (!value) {
      throw new Error(`Configuration key not found: ${key}`);
    }
    return value;
  }

  isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }

  isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  isStaging(): boolean {
    return this.config.nodeEnv === 'staging';
  }
}

// Export singleton instance
export const appConfig = new ConfigService();
