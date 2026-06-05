import { Injectable, Logger } from '@nestjs/common';

export interface CacheOptions {
  ttl?: number; // seconds
}

@Injectable()
export class RedisService {
  private readonly logger = new Logger('RedisService');
  private cache = new Map<string, { data: any; expiresAt: number }>();

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const item = this.cache.get(key);
      if (!item) {
        this.logger.debug(`Cache miss: ${key}`);
        return null;
      }

      if (item.expiresAt < Date.now()) {
        this.cache.delete(key);
        this.logger.debug(`Cache expired: ${key}`);
        return null;
      }

      this.logger.debug(`Cache hit: ${key}`);
      return item.data as T;
    } catch (error) {
      this.logger.error('Error getting from cache', error as any);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || 3600; // Default 1 hour
      const expiresAt = Date.now() + ttl * 1000;

      this.cache.set(key, { data: value, expiresAt });
      this.logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error('Error setting cache', error as any);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      this.cache.delete(key);
      this.logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      this.logger.error('Error deleting from cache', error as any);
    }
  }

  /**
   * Clear all cache
   */
  async flush(): Promise<void> {
    try {
      this.cache.clear();
      this.logger.debug('Cache flushed');
    } catch (error) {
      this.logger.error('Error flushing cache', error as any);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;
    if (item.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  // ========== Extended Redis-compatible API ==========

  /** Delete key(s) */
  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.cache.has(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Set key with expiry (seconds) */
  async setex(key: string, ttlSeconds: number, value: any): Promise<void> {
    await this.set(key, value, { ttl: ttlSeconds });
  }

  /** Set only if not exists */
  async setnx(key: string, value: any): Promise<boolean> {
    const existing = await this.exists(key);
    if (existing) return false;
    await this.set(key, value);
    return true;
  }

  /** Set expiry on existing key */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;
    item.expiresAt = Date.now() + ttlSeconds * 1000;
    return true;
  }

  /** Increment integer value */
  async increment(key: string): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = Number(current) + 1;
    await this.set(key, next, { ttl: 3600 });
    return next;
  }

  /** Decrement integer value */
  async decrement(key: string): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = Math.max(0, Number(current) - 1);
    await this.set(key, next, { ttl: 3600 });
    return next;
  }

  /** Get multiple keys */
  async mget(keys: string[]): Promise<(any | null)[]> {
    return Promise.all(keys.map((k) => this.get(k)));
  }

  /** Sorted set: add member with score */
  async zadd(key: string, score: number, member: string): Promise<number> {
    const set: Map<string, number> = (await this.get<Map<string, number>>(key)) ?? new Map();
    set.set(member, score);
    await this.set(key, set, { ttl: 3600 });
    return 1;
  }

  /** Sorted set: count members */
  async zcard(key: string): Promise<number> {
    const set = await this.get<Map<string, number>>(key);
    return set ? set.size : 0;
  }

  /** Sorted set: remove members by score range */
  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    const set = await this.get<Map<string, number>>(key);
    if (!set) return 0;
    let removed = 0;
    for (const [member, score] of Array.from(set.entries())) {
      if (score >= min && score <= max) {
        set.delete(member);
        removed++;
      }
    }
    await this.set(key, set, { ttl: 3600 });
    return removed;
  }

  /** Set: add member(s) */
  async sadd(key: string, ...members: string[]): Promise<number> {
    const set: Set<string> = (await this.get<Set<string>>(key)) ?? new Set();
    const before = set.size;
    members.forEach((m) => set.add(m));
    await this.set(key, set, { ttl: 86400 });
    return set.size - before;
  }

  /** Set: get all members */
  async smembers(key: string): Promise<string[]> {
    const set = await this.get<Set<string>>(key);
    return set ? Array.from(set) : [];
  }

  /** List all keys matching a pattern (simple glob) */
  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return Array.from(this.cache.keys()).filter((k) => regex.test(k));
  }

  /** Hash: get all fields */
  async hgetall(key: string): Promise<Record<string, string> | null> {
    return this.get<Record<string, string>>(key);
  }

  /** Eval Lua script (token bucket stub for rate limiting) */
  async eval(script: string, numKeys: number, ...args: string[]): Promise<any[]> {
    // Token bucket implementation using in-memory cache
    const key = args[0];
    const now = parseInt(args[1]);
    const tokensPerWindow = parseInt(args[2]);
    const windowSizeMs = parseInt(args[3]);

    const state = (await this.get<{ tokens: number; last_reset: number }>(key)) ?? {
      tokens: tokensPerWindow,
      last_reset: now,
    };

    const elapsed = now - state.last_reset;
    if (elapsed >= windowSizeMs) {
      state.tokens = tokensPerWindow;
      state.last_reset = now;
    }

    const allowed = state.tokens > 0;
    if (allowed) state.tokens--;

    await this.set(key, state, { ttl: Math.ceil(windowSizeMs / 1000) + 1 });

    const resetAt = state.last_reset + windowSizeMs;
    return [allowed ? 1 : 0, state.tokens, resetAt, now];
  }

  /** Pipeline stub - executes commands in sequence */
  pipeline() {
    const commands: Array<() => Promise<any>> = [];
    const pipe = {
      setex: (key: string, ttl: number, value: any) => {
        commands.push(() => this.setex(key, ttl, value));
        return pipe;
      },
      del: (key: string) => {
        commands.push(() => this.del(key));
        return pipe;
      },
      exec: async () => {
        return Promise.all(commands.map((c) => c()));
      },
    };
    return pipe;
  }
}
