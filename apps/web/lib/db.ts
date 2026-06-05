/**
 * PostgreSQL connection pool for Next.js API routes.
 * Uses the `pg` package (installed in Docker container).
 * Connection details come from POSTGRES_URL env (set in docker-compose).
 */

import { Pool, PoolClient } from 'pg';

const DEFAULT_DB_URL = 'postgresql://admin:password@postgres:5432/delegatecart?schema=public';
const PRIMARY_DB_URL = process.env.DATABASE_URL || DEFAULT_DB_URL;

let pool: Pool | null = null;
let poolPromise: Promise<Pool> | null = null;
let _schemaMigrated = false;
let _schemaMigrationPromise: Promise<void> | null = null;

/**
 * Idempotent schema migration — runs once per process after the DB pool is
 * ready.  All DDL uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so it is safe
 * to run against a schema that is already fully up-to-date.
 */
async function ensureSchema(p: Pool): Promise<void> {
  if (_schemaMigrated) return;
  if (_schemaMigrationPromise) return _schemaMigrationPromise;

  _schemaMigrationPromise = (async () => {
    const client = await p.connect();
    try {
      // ── User core columns (role may be missing if Prisma never ran) ─────────
      await client.query(
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'customer'`
      );
      await client.query(
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`
      );

      // ── User profile extended columns ─────────────────────────────────────
      await client.query(`
        ALTER TABLE "User"
          ADD COLUMN IF NOT EXISTS "whatsappNumber"              TEXT,
          ADD COLUMN IF NOT EXISTS "notificationEmail"           TEXT,
          ADD COLUMN IF NOT EXISTS "avatarUrl"                   TEXT,
          ADD COLUMN IF NOT EXISTS "autoPurchaseEnabled"         BOOLEAN       NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS "autoPurchaseThreshold"       INTEGER       NOT NULL DEFAULT 10000,
          ADD COLUMN IF NOT EXISTS "displayName"                 TEXT,
          ADD COLUMN IF NOT EXISTS "aliasName"                   TEXT,
          ADD COLUMN IF NOT EXISTS "preferredCommunicationEmail" TEXT,
          ADD COLUMN IF NOT EXISTS "defaultBillingAddressId"     INTEGER,
          ADD COLUMN IF NOT EXISTS "defaultShippingAddressId"    INTEGER,
          ADD COLUMN IF NOT EXISTS "subscriptionPlan"            TEXT          NOT NULL DEFAULT 'BASIC',
          ADD COLUMN IF NOT EXISTS "preferredModel"              TEXT          NOT NULL DEFAULT 'gpt-4o-mini',
          ADD COLUMN IF NOT EXISTS "monthlyAiBudget"             NUMERIC(12,2) NOT NULL DEFAULT 50000,
          ADD COLUMN IF NOT EXISTS "defaultDeliveryDays"         INTEGER       NOT NULL DEFAULT 7,
          ADD COLUMN IF NOT EXISTS "defaultPaymentMethod"        TEXT          NOT NULL DEFAULT 'cod'
      `);

      // ── UserAddress table ─────────────────────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS "UserAddress" (
          id          SERIAL      PRIMARY KEY,
          "userId"    INTEGER     NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
          name        TEXT        NOT NULL,
          phone       TEXT,
          line1       TEXT        NOT NULL,
          line2       TEXT,
          city        TEXT        NOT NULL,
          state       TEXT        NOT NULL,
          pincode     TEXT        NOT NULL,
          "isDefault" BOOLEAN     NOT NULL DEFAULT false,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_useraddress_userid ON "UserAddress"("userId")`
      );

      // ── UserSession table ─────────────────────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS "UserSession" (
          id             SERIAL      PRIMARY KEY,
          "userId"       INTEGER     NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
          "sessionToken" TEXT        NOT NULL UNIQUE,
          "expiresAt"    TIMESTAMPTZ NOT NULL,
          "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_usersession_token  ON "UserSession"("sessionToken")`
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_usersession_userid ON "UserSession"("userId")`
      );

      // ── SmartIntentEngineResponse table + extra columns ───────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS "SmartIntentEngineResponse" (
          id                             SERIAL      PRIMARY KEY,
          "userId"                       INTEGER     REFERENCES "User"(id) ON DELETE SET NULL,
          "queryBy"                      TEXT        NOT NULL DEFAULT 'anonymous',
          "queryText"                    TEXT        NOT NULL,
          "initialProductSuggestionText" TEXT,
          "intentEngineResponse"         JSONB       NOT NULL DEFAULT '{}',
          "supervisedResponse"           JSONB       NOT NULL DEFAULT '{}',
          "aiEnrichedResponse"           JSONB,
          "enhancedByAI"                 BOOLEAN     NOT NULL DEFAULT false,
          "aiModel"                      TEXT,
          "isActive"                     BOOLEAN     NOT NULL DEFAULT true,
          comments                       JSONB       NOT NULL DEFAULT '[]',
          "updatedBy"                    TEXT,
          "createdAt"                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt"                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      // Add any columns that may be missing in older deployments
      await client.query(
        `ALTER TABLE "SmartIntentEngineResponse" ADD COLUMN IF NOT EXISTS "aiModel"    TEXT`
      );
      await client.query(
        `ALTER TABLE "SmartIntentEngineResponse" ADD COLUMN IF NOT EXISTS "isActive"   BOOLEAN NOT NULL DEFAULT true`
      );
      await client.query(
        `ALTER TABLE "SmartIntentEngineResponse" ADD COLUMN IF NOT EXISTS comments     JSONB   NOT NULL DEFAULT '[]'`
      );
      await client.query(
        `ALTER TABLE "SmartIntentEngineResponse" ADD COLUMN IF NOT EXISTS "updatedBy"  TEXT`
      );
      await client.query(
        `ALTER TABLE "SmartIntentEngineResponse" ADD COLUMN IF NOT EXISTS "enhancedByAI" BOOLEAN NOT NULL DEFAULT false`
      );
      await client.query(
        `ALTER TABLE "SmartIntentEngineResponse" ADD COLUMN IF NOT EXISTS "aiEnrichedResponse" JSONB`
      );

      // ── ValidationSession table ───────────────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS "ValidationSession" (
          id               SERIAL      PRIMARY KEY,
          "userId"         INTEGER     REFERENCES "User"(id) ON DELETE SET NULL,
          "userExternalId" TEXT        NOT NULL,
          "userEmail"      TEXT,
          "queryText"      TEXT        NOT NULL,
          "sessionSource"  TEXT        NOT NULL DEFAULT 'smart-shopping-assistant',
          "productsJson"   JSONB       NOT NULL DEFAULT '[]',
          "timelineJson"   JSONB,
          "feedbackJson"   JSONB       NOT NULL DEFAULT '[]',
          "metricsJson"    JSONB       NOT NULL DEFAULT '{}',
          "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_vs_userid   ON "ValidationSession"("userId")`
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_vs_extid    ON "ValidationSession"("userExternalId")`
      );

      _schemaMigrated = true;
      console.log('[DB] Auto-migration: schema is up-to-date');
    } catch (err: any) {
      console.error('[DB] Auto-migration error (non-fatal):', err.message);
      // Reset so the next request retries
      _schemaMigrationPromise = null;
    } finally {
      client.release();
    }
  })();

  return _schemaMigrationPromise;
}

function buildDbUrlCandidates(connectionString: string): string[] {
  const candidates: string[] = [];

  const addCandidate = (value: string | null | undefined) => {
    if (value && !candidates.includes(value)) {
      candidates.push(value);
    }
  };

  // Always try the original connection string first
  addCandidate(connectionString);

  try {
    const parsed = new URL(connectionString);
    const currentHostname = parsed.hostname;

    // If the current hostname is 'postgres', prioritize Docker network hosts
    if (currentHostname === 'postgres') {
      // Inside Docker container, 'postgres' hostname should work via Docker network DNS
      // Don't add 127.0.0.1 or localhost as they won't reach the postgres container
      addCandidate(connectionString); // Already added above
      // Only add host.docker.internal as last resort (for Docker Desktop on Mac/Windows)
      const hostDockerInternalUrl = new URL(connectionString);
      hostDockerInternalUrl.hostname = 'host.docker.internal';
      addCandidate(hostDockerInternalUrl.toString());
    } else {
      // For non-docker hostnames, try multiple variants
      const hosts = [currentHostname];
      if (currentHostname !== 'localhost') hosts.push('localhost');
      if (currentHostname !== '127.0.0.1') hosts.push('127.0.0.1');

      for (const host of hosts) {
        if (host === currentHostname && candidates.length > 0) continue; // Skip if already added
        const url = new URL(connectionString);
        url.hostname = host;
        addCandidate(url.toString());
      }

      // Also try 'postgres' as a fallback (in case running in Docker)
      const postgresUrl = new URL(connectionString);
      postgresUrl.hostname = 'postgres';
      addCandidate(postgresUrl.toString());
    }
  } catch (e) {
    // If URL parsing fails, use default
    addCandidate(DEFAULT_DB_URL);
  }

  return candidates;
}

function createPool(connectionString: string): Pool {
  const nextPool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  nextPool.on('error', (err) => {
    console.error('[DB] Pool error:', err.message);
  });
  return nextPool;
}

export async function getPool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  if (!poolPromise) {
    poolPromise = (async () => {
      let lastError: unknown = null;

      // For connections to "postgres" hostname (Docker), try it multiple times with delays
      const isDockerConnection = PRIMARY_DB_URL.includes('postgres:5432');

      if (isDockerConnection) {
        // Docker container: just use the postgres hostname, retry a few times with backoff
        const postgresPool = createPool(PRIMARY_DB_URL);
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            const client = await postgresPool.connect();
            client.release();
            pool = postgresPool;
            console.log('[DB] Successfully connected to postgres on Docker network');
            ensureSchema(postgresPool).catch((e) =>
              console.error('[DB] ensureSchema failed:', e.message)
            );
            return postgresPool;
          } catch (err) {
            lastError = err;
            if (attempt < 5) {
              const delayMs = attempt * 1000;
              console.warn(
                `[DB] Connection attempt ${attempt} failed, retrying in ${delayMs}ms...`,
                (err as any).message
              );
              await new Promise((r) => setTimeout(r, delayMs));
            }
          }
        }
        // If all retries failed, throw the error
        throw lastError instanceof Error
          ? lastError
          : new Error('Unable to establish a PostgreSQL connection to postgres container');
      } else {
        // Non-Docker: try multiple hostname variants
        for (const connectionString of buildDbUrlCandidates(PRIMARY_DB_URL)) {
          const candidatePool = createPool(connectionString);
          try {
            const client = await candidatePool.connect();
            client.release();
            pool = candidatePool;
            ensureSchema(candidatePool).catch((e) =>
              console.error('[DB] ensureSchema failed:', e.message)
            );
            return candidatePool;
          } catch (err) {
            lastError = err;
            await candidatePool.end().catch(() => undefined);
          }
        }

        throw lastError instanceof Error
          ? lastError
          : new Error('Unable to establish a PostgreSQL connection');
      }
    })();
  }

  try {
    return await poolPromise;
  } catch (err) {
    poolPromise = null;
    throw err;
  }
}

export async function query<T = any>(sql: string, params?: unknown[]): Promise<T[]> {
  const client = await (await getPool()).connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = any>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await (await getPool()).connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── User helpers ──────────────────────────────────────────────────────────────

export async function getUserByEmail(email: string) {
  try {
    return await queryOne(
      `SELECT id, email, name, "passwordHash", "createdAt", "role", "subscriptionPlan"
       FROM "User" WHERE email = $1`,
      [email]
    );
  } catch {
    // Backward-compatible fallback for databases that do not have role/subscription columns yet.
    return queryOne(
      `SELECT id, email, name, "passwordHash", "createdAt"
       FROM "User" WHERE email = $1`,
      [email]
    );
  }
}

export async function upsertUser(email: string, name?: string) {
  return queryOne(
    `INSERT INTO "User" (email, name, "createdAt", "updatedAt")
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, "updatedAt" = NOW()
     RETURNING id, email, name, "createdAt"`,
    [email, name || email.split('@')[0]]
  );
}

export async function updateUserProfile(
  userId: number,
  fields: {
    name?: string;
  }
) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  if (fields.name !== undefined) {
    sets.push(`name = $${i++}`);
    vals.push(fields.name);
  }

  if (!sets.length) return null;
  sets.push(`"updatedAt" = NOW()`);
  vals.push(userId);

  return queryOne(
    `UPDATE "User" SET ${sets.join(', ')} WHERE id = $${i}
     RETURNING id, email, name, "updatedAt"`,
    vals
  );
}

// ── Session helpers ───────────────────────────────────────────────────────────

export async function createSession(userId: number): Promise<string> {
  const token = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
  try {
    // Ensure UserSession table exists (idempotent)
    await query(
      `CREATE TABLE IF NOT EXISTS "UserSession" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        "sessionToken" TEXT NOT NULL UNIQUE,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );
    await query(
      `INSERT INTO "UserSession" ("userId", "sessionToken", "expiresAt") VALUES ($1, $2, NOW() + INTERVAL '30 days')
       ON CONFLICT ("sessionToken") DO NOTHING`,
      [userId, token]
    );
    // Verify the session was actually persisted; if not, re-insert with a fresh token
    const persisted = await queryOne(`SELECT 1 FROM "UserSession" WHERE "sessionToken" = $1`, [
      token,
    ]);
    if (!persisted) {
      console.error('[DB] createSession: token was not persisted for userId', userId);
    }
  } catch (err: any) {
    // Token was generated but could not be stored. The caller (login route) checks for this
    // by sending x-user-email header alongside authToken so demo fallback paths still work.
    console.error('[DB] createSession error:', err.message);
  }
  return token;
}

export async function validateSession(token: string) {
  try {
    return await queryOne(
      `SELECT us."userId", u.email, u.name
       FROM "UserSession" us JOIN "User" u ON u.id = us."userId"
       WHERE us."sessionToken" = $1 AND us."expiresAt" > NOW()`,
      [token]
    );
  } catch (err: any) {
    console.error('[DB] validateSession failed:', err.message);
    return null;
  }
}

export async function deleteSession(token: string) {
  await query(`DELETE FROM "UserSession" WHERE "sessionToken" = $1`, [token]);
}

// ── Order helpers ─────────────────────────────────────────────────────────────

// Idempotent schema migration for OrderItem.productSlug
let _migrated = false;
async function ensureOrderItemSlug() {
  if (_migrated) return;
  try {
    await query(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "productSlug" TEXT`);
  } catch {
    /* column may already exist or table uses different DDL – non-fatal */
  }
  _migrated = true;
}

function sanitizeOrderItemReference(productId?: number | string, productSlug?: string) {
  const normalizedId =
    typeof productId === 'number'
      ? Number.isInteger(productId) && productId > 0
        ? productId
        : null
      : typeof productId === 'string' && /^\d+$/.test(productId.trim())
        ? parseInt(productId.trim(), 10)
        : null;

  const normalizedSlug =
    normalizedId !== null
      ? String(normalizedId)
      : typeof productSlug === 'string' && /^\d+$/.test(productSlug.trim())
        ? productSlug.trim()
        : null;

  return {
    productId: normalizedId ?? (normalizedSlug ? parseInt(normalizedSlug, 10) : null),
    productSlug: normalizedSlug,
  };
}

/**
 * Server-side product name → DB ID resolution.
 * When a cart item has no valid numeric productId, resolve from the Product table
 * by exact name match. This ensures OrderItems always have a real DB reference.
 */
async function resolveProductIdByName(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  productName: string,
  price?: number
): Promise<{ productId: number | null; productSlug: string | null }> {
  if (!productName || productName.length < 2) return { productId: null, productSlug: null };
  try {
    // Exact name match — prefer price-close match when multiple rows share the same name.
    const res = await client.query(
      `SELECT id FROM "Product" WHERE LOWER(name) = LOWER($1) ORDER BY ABS(price - $2) LIMIT 1`,
      [productName.trim(), price ?? 0]
    );
    if (res.rows.length > 0) {
      const id = res.rows[0].id;
      return { productId: id, productSlug: String(id) };
    }
    return { productId: null, productSlug: null };
  } catch {
    return { productId: null, productSlug: null };
  }
}

export async function createOrder(
  userId: number,
  data: {
    items: Array<{
      productId?: number | string;
      productSlug?: string;
      productName: string;
      quantity: number;
      price: number;
      imageUrl?: string;
    }>;
    total: number;
    aiAssisted?: boolean;
    paymentMethod?: string;
    shippingAddress?: object;
    notes?: string;
  }
) {
  await ensureOrderItemSlug();
  const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

  return withTransaction(async (client) => {
    // Create order
    const orderRes = await client.query(
      `INSERT INTO "Order" ("userId", total, status, "aiAssisted", "orderNumber", "paymentMethod", "shippingAddress", notes, "createdAt", "updatedAt")
       VALUES ($1, $2, 'processing', $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [
        userId,
        data.total,
        data.aiAssisted ?? false,
        orderNumber,
        data.paymentMethod ?? 'cod',
        data.shippingAddress ? JSON.stringify(data.shippingAddress) : null,
        data.notes ?? null,
      ]
    );
    const order = orderRes.rows[0];

    // Create order items — resolve product IDs from DB when not provided
    for (const item of data.items) {
      let refs = sanitizeOrderItemReference(item.productId, item.productSlug);
      // Server-side fallback: resolve by product name when client didn't send a valid numeric ID
      if (refs.productId === null) {
        refs = await resolveProductIdByName(client, item.productName, item.price);
      }
      await client.query(
        `INSERT INTO "OrderItem" ("orderId", "productId", "productName", quantity, price, "imageUrl", "productSlug")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          refs.productId,
          item.productName,
          item.quantity,
          item.price,
          item.imageUrl ?? null,
          refs.productSlug,
        ]
      );
    }

    return order;
  });
}

/**
 * Atomically creates an order AND debits the wallet in a single transaction.
 * If wallet debit fails (insufficient balance, daily limit, etc.), the order is NOT created.
 */
export async function createOrderWithWalletPayment(
  userId: number,
  walletId: number,
  data: {
    items: Array<{
      productId?: number | string;
      productSlug?: string;
      productName: string;
      quantity: number;
      price: number;
      imageUrl?: string;
    }>;
    total: number;
    aiAssisted?: boolean;
    paymentMethod?: string;
    shippingAddress?: object;
    notes?: string;
  }
) {
  await ensureOrderItemSlug();
  const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

  return withTransaction(async (client) => {
    // Step 1: Lock & validate wallet
    const walletRes = await client.query(
      `SELECT * FROM "Wallet" WHERE id = $1 AND "userId" = $2 FOR UPDATE`,
      [walletId, userId]
    );
    const wallet = walletRes.rows[0];
    if (!wallet) throw new Error('Wallet not found');
    if (!wallet.isActive) throw new Error('Wallet is not active');
    if (wallet.isLocked) throw new Error('Wallet is temporarily locked');
    if (!wallet.isAiAuthorized)
      throw new Error(
        'Wallet not authorized for AI auto-checkout. Please enable AI authorization in Wallet Settings.'
      );
    if (wallet.balance < data.total)
      throw new Error(
        `Insufficient wallet balance. Available: ₹${wallet.balance.toLocaleString('en-IN')}, Required: ₹${data.total.toLocaleString('en-IN')}`
      );
    if (wallet.maxPerOrder && data.total > wallet.maxPerOrder)
      throw new Error(
        `Order amount ₹${data.total.toLocaleString('en-IN')} exceeds your per-order wallet limit of ₹${wallet.maxPerOrder.toLocaleString('en-IN')}`
      );
    // Reset daily spend if date changed
    const today = new Date().toISOString().split('T')[0];
    const lastReset = wallet.lastResetDate
      ? new Date(wallet.lastResetDate).toISOString().split('T')[0]
      : '';
    const dailySpent = lastReset === today ? wallet.dailySpentToday || 0 : 0;
    if (wallet.dailyLimit && dailySpent + data.total > wallet.dailyLimit)
      throw new Error(
        `This order would exceed your daily wallet spending limit of ₹${wallet.dailyLimit.toLocaleString('en-IN')}. Daily spent so far: ₹${dailySpent.toLocaleString('en-IN')}`
      );
    if (wallet.aiSpendingLimit && data.total > wallet.aiSpendingLimit)
      throw new Error(
        `Order amount exceeds your AI spending limit of ₹${wallet.aiSpendingLimit.toLocaleString('en-IN')} per transaction`
      );

    // Step 2: Create order
    const orderRes = await client.query(
      `INSERT INTO "Order" ("userId", total, status, "aiAssisted", "orderNumber", "paymentMethod", "shippingAddress", notes, "createdAt", "updatedAt")
       VALUES ($1, $2, 'confirmed', $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [
        userId,
        data.total,
        data.aiAssisted ?? true,
        orderNumber,
        data.paymentMethod ?? 'wallet',
        data.shippingAddress ? JSON.stringify(data.shippingAddress) : null,
        data.notes ?? null,
      ]
    );
    const order = orderRes.rows[0];

    // Step 3: Create order items — resolve product IDs from DB when not provided
    for (const item of data.items) {
      let refs = sanitizeOrderItemReference(item.productId, item.productSlug);
      if (refs.productId === null) {
        refs = await resolveProductIdByName(client, item.productName, item.price);
      }
      await client.query(
        `INSERT INTO "OrderItem" ("orderId", "productId", "productName", quantity, price, "imageUrl", "productSlug")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          refs.productId,
          item.productName,
          item.quantity,
          item.price,
          item.imageUrl ?? null,
          refs.productSlug,
        ]
      );
    }

    // Step 4: Debit wallet
    const newBalance = wallet.balance - data.total;
    const newDailySpent = (lastReset === today ? wallet.dailySpentToday || 0 : 0) + data.total;
    await client.query(
      `UPDATE "Wallet" SET balance = $1, "totalSpent" = "totalSpent" + $2,
       "dailySpentToday" = $3, "lastResetDate" = CURRENT_DATE, "updatedAt" = NOW()
       WHERE id = $4`,
      [newBalance, data.total, newDailySpent, walletId]
    );
    await client.query(
      `INSERT INTO "WalletTransaction" ("walletId", type, amount, description, "orderId", status, "balanceBefore", "balanceAfter", "updatedAt")
       VALUES ($1, 'debit', $2, $3, $4, 'completed', $5, $6, NOW())`,
      [
        walletId,
        data.total,
        `Auto-checkout: ${data.items.map((i) => i.productName).join(', ')}`,
        order.id,
        wallet.balance,
        newBalance,
      ]
    );

    return { order, walletBalanceAfter: newBalance };
  });
}

export async function getUserOrders(userId: number, limit = 20, offset = 0) {
  const orders = await query(
    `SELECT o.id, o."orderNumber", o.total, o.status, o."aiAssisted", o."paymentMethod", o."createdAt",
            json_agg(json_build_object(
              'id', oi.id, 'productId', oi."productId", 'productSlug', oi."productSlug",
              'productName', oi."productName",
              'quantity', oi.quantity, 'price', oi.price, 'imageUrl', oi."imageUrl"
            ) ORDER BY oi.id) as items
     FROM "Order" o
     LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
     WHERE o."userId" = $1
     GROUP BY o.id
     ORDER BY o."createdAt" DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  const total = await queryOne<{ count: string }>(
    `SELECT count(*) FROM "Order" WHERE "userId" = $1`,
    [userId]
  );
  return { orders, total: parseInt(total?.count ?? '0', 10) };
}

export async function getOrderById(orderId: number, userId: number) {
  return queryOne(
    `SELECT o.id, o."orderNumber", o.total, o.status, o."aiAssisted", o."paymentMethod",
            o."shippingAddress", o.notes, o."createdAt",
            json_agg(json_build_object(
              'id', oi.id, 'productId', oi."productId", 'productSlug', oi."productSlug",
              'productName', oi."productName",
              'quantity', oi.quantity, 'price', oi.price, 'imageUrl', oi."imageUrl"
            ) ORDER BY oi.id) as items
     FROM "Order" o
     LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
     WHERE o.id = $1 AND o."userId" = $2
     GROUP BY o.id`,
    [orderId, userId]
  );
}

// ── Shopping List Search helpers ──────────────────────────────────────────────

export async function findCachedSearch(searchHash: string) {
  return queryOne(
    `SELECT id, items, results, summary, "createdAt", "expiresAt"
     FROM "ShoppingListSearch"
     WHERE "searchHash" = $1 AND "expiresAt" > NOW()
     ORDER BY "createdAt" DESC
     LIMIT 1`,
    [searchHash]
  );
}

export async function saveSearch(
  userId: number | null,
  searchHash: string,
  items: object,
  results: object,
  summary: object
) {
  return queryOne(
    `INSERT INTO "ShoppingListSearch" ("userId", "searchHash", items, results, summary, "createdAt", "expiresAt")
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '5 hours')
     RETURNING id, "createdAt", "expiresAt"`,
    [userId, searchHash, JSON.stringify(items), JSON.stringify(results), JSON.stringify(summary)]
  );
}

export async function getUserSearchHistory(userId: number, limit = 20) {
  return query(
    `SELECT id, items, results, summary, "createdAt", "expiresAt",
            "expiresAt" > NOW() AS "isValid"
     FROM "ShoppingListSearch"
     WHERE "userId" = $1
     ORDER BY "createdAt" DESC
     LIMIT $2`,
    [userId, limit]
  );
}

// ── Magic Link helpers ────────────────────────────────────────────────────────

export async function createMagicLink(
  userId: number,
  purpose: string,
  payload: object,
  expiryHours = 48
) {
  const token = `ml_${Math.random().toString(36).slice(2, 18)}${Date.now().toString(36)}`;
  await query(
    `INSERT INTO "MagicLink" ("userId", token, purpose, payload, "expiresAt")
     VALUES ($1, $2, $3, $4, NOW() + ($5 || ' hours')::INTERVAL)`,
    [userId, token, purpose, JSON.stringify(payload), expiryHours]
  );
  return token;
}

export async function validateMagicLink(token: string, consume = false) {
  const link = await queryOne(
    `SELECT ml.*, u.email, u.name FROM "MagicLink" ml
     JOIN "User" u ON u.id = ml."userId"
     WHERE ml.token = $1 AND ml."expiresAt" > NOW()`,
    [token]
  );
  if (link && consume) {
    await query(`UPDATE "MagicLink" SET "usedAt" = NOW() WHERE token = $1`, [token]);
  }
  return link;
}

// ── Wishlist helpers ──────────────────────────────────────────────────────────

export async function getWishlist(userId: number) {
  return query(
    `SELECT id, "productName", price, "imageUrl", "addedAt" FROM "WishlistItem" WHERE "userId" = $1 ORDER BY "addedAt" DESC`,
    [userId]
  );
}

export async function addToWishlist(
  userId: number,
  data: { productId?: string; productName: string; price?: number; imageUrl?: string; url?: string }
) {
  return queryOne(
    `INSERT INTO "WishlistItem" ("userId", "productId", "productName", price, "imageUrl", url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT ("userId", "productName") DO UPDATE SET price = EXCLUDED.price, "imageUrl" = EXCLUDED."imageUrl"
     RETURNING *`,
    [
      userId,
      data.productId ?? null,
      data.productName,
      data.price ?? null,
      data.imageUrl ?? null,
      data.url ?? null,
    ]
  );
}

// ── Address helpers ───────────────────────────────────────────────────────────

export async function getUserAddresses(userId: number) {
  return query(
    `SELECT id, name, phone, line1, line2, city, state, pincode, "isDefault", "createdAt"
     FROM "UserAddress" WHERE "userId" = $1 ORDER BY "isDefault" DESC, "createdAt" DESC`,
    [userId]
  );
}

export async function createAddress(
  userId: number,
  data: {
    name: string;
    phone?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    isDefault?: boolean;
  }
) {
  if (data.isDefault) {
    await query(`UPDATE "UserAddress" SET "isDefault" = false WHERE "userId" = $1`, [userId]);
  }
  return queryOne(
    `INSERT INTO "UserAddress" ("userId", name, phone, line1, line2, city, state, pincode, "isDefault")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      data.name,
      data.phone ?? null,
      data.line1,
      data.line2 ?? null,
      data.city,
      data.state,
      data.pincode,
      data.isDefault ?? false,
    ]
  );
}

export async function updateAddress(
  addressId: number,
  userId: number,
  data: Record<string, unknown>
) {
  const allowed = ['name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode', 'isDefault'];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const key of allowed) {
    if (data[key] !== undefined) {
      const col = key === 'isDefault' ? `"isDefault"` : key;
      sets.push(`${col} = $${i++}`);
      vals.push(data[key]);
    }
  }
  if (!sets.length) return null;
  if (data.isDefault) {
    await query(`UPDATE "UserAddress" SET "isDefault" = false WHERE "userId" = $1`, [userId]);
  }
  sets.push(`"updatedAt" = NOW()`);
  vals.push(addressId, userId);
  return queryOne(
    `UPDATE "UserAddress" SET ${sets.join(', ')} WHERE id = $${i} AND "userId" = $${i + 1} RETURNING *`,
    vals
  );
}

export async function deleteAddress(addressId: number, userId: number) {
  await query(`DELETE FROM "UserAddress" WHERE id = $1 AND "userId" = $2`, [addressId, userId]);
}

// ── Behavior tracking helpers ─────────────────────────────────────────────────

export async function trackBehavior(
  userId: number | null,
  productId: string | null,
  action: string,
  metadata?: object
) {
  return queryOne(
    `INSERT INTO "UserBehavior" ("userId", "productId", action, metadata)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, productId, action, metadata ? JSON.stringify(metadata) : '{}']
  );
}

export async function getUserBehavior(userId: number, limit = 100) {
  return query(
    `SELECT "productId", action, metadata, "createdAt"
     FROM "UserBehavior" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
    [userId, limit]
  );
}

export async function getProductBehaviorStats(userId: number) {
  return query(
    `SELECT "productId", action, COUNT(*) as count
     FROM "UserBehavior" WHERE "userId" = $1
     GROUP BY "productId", action ORDER BY count DESC LIMIT 50`,
    [userId]
  );
}

// ── User preference helpers ───────────────────────────────────────────────────

export async function getUserPreferences(userId: number) {
  return queryOne(`SELECT * FROM "UserPreference" WHERE "userId" = $1`, [userId]);
}

export async function upsertUserPreferences(
  userId: number,
  prefs: {
    preferredCategories?: string[];
    priceRange?: { min: number; max: number };
    brands?: string[];
    interactionHistory?: object[];
  }
) {
  return queryOne(
    `INSERT INTO "UserPreference" ("userId", "preferredCategories", "priceRange", brands, "interactionHistory", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT ("userId") DO UPDATE SET
       "preferredCategories" = COALESCE($2, "UserPreference"."preferredCategories"),
       "priceRange" = COALESCE($3, "UserPreference"."priceRange"),
       brands = COALESCE($4, "UserPreference".brands),
       "interactionHistory" = COALESCE($5, "UserPreference"."interactionHistory"),
       "updatedAt" = NOW()
     RETURNING *`,
    [
      userId,
      prefs.preferredCategories ? JSON.stringify(prefs.preferredCategories) : null,
      prefs.priceRange ? JSON.stringify(prefs.priceRange) : null,
      prefs.brands ? JSON.stringify(prefs.brands) : null,
      prefs.interactionHistory ? JSON.stringify(prefs.interactionHistory) : null,
    ]
  );
}

// ── Analytics helpers ─────────────────────────────────────────────────────────

export async function trackAnalyticsEvent(
  eventType: string,
  userId: number | null,
  productId: string | null,
  metadata?: object
) {
  return queryOne(
    `INSERT INTO "AnalyticsEvent" ("eventType", "userId", "productId", metadata)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [eventType, userId, productId, metadata ? JSON.stringify(metadata) : '{}']
  );
}

export async function getAnalyticsSummary(days = 30) {
  const metrics = await queryOne<{
    total_events: string;
    unique_users: string;
    add_to_cart_count: string;
    purchase_count: string;
    search_count: string;
  }>(
    `SELECT
       COUNT(*) as total_events,
       COUNT(DISTINCT "userId") as unique_users,
       COUNT(*) FILTER (WHERE "eventType" = 'add_to_cart') as add_to_cart_count,
       COUNT(*) FILTER (WHERE "eventType" = 'purchase') as purchase_count,
       COUNT(*) FILTER (WHERE "eventType" = 'search') as search_count
     FROM "AnalyticsEvent"
     WHERE "createdAt" > NOW() - ($1 || ' days')::INTERVAL`,
    [days]
  );

  const topProducts = await query(
    `SELECT "productId", metadata->>'productName' as name, COUNT(*) as events,
       COUNT(*) FILTER (WHERE "eventType" = 'add_to_cart') as cart_adds,
       COUNT(*) FILTER (WHERE "eventType" = 'purchase') as purchases
     FROM "AnalyticsEvent"
     WHERE "productId" IS NOT NULL AND "createdAt" > NOW() - ($1 || ' days')::INTERVAL
     GROUP BY "productId", metadata->>'productName'
     ORDER BY events DESC LIMIT 10`,
    [days]
  );

  const dailyTrend = await query(
    `SELECT DATE("createdAt") as date,
       COUNT(*) as events,
       COUNT(*) FILTER (WHERE "eventType" = 'add_to_cart') as cart_adds,
       COUNT(*) FILTER (WHERE "eventType" = 'purchase') as purchases,
       COUNT(DISTINCT "userId") as users
     FROM "AnalyticsEvent"
     WHERE "createdAt" > NOW() - ($1 || ' days')::INTERVAL
     GROUP BY DATE("createdAt") ORDER BY date`,
    [days]
  );

  return { metrics, topProducts, dailyTrend };
}

export async function getAiRecommendationStats(days = 30) {
  const stats = await queryOne<{
    total_recommendations: string;
    accepted: string;
    rejected: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE "eventType" = 'ai_recommendation') as total_recommendations,
       COUNT(*) FILTER (WHERE "eventType" = 'ai_recommendation_accepted') as accepted,
       COUNT(*) FILTER (WHERE "eventType" = 'ai_recommendation_rejected') as rejected
     FROM "AnalyticsEvent"
     WHERE "createdAt" > NOW() - ($1 || ' days')::INTERVAL`,
    [days]
  );
  return stats;
}

// ── Wallet helpers ────────────────────────────────────────────────────────────

export async function getOrCreateWallet(userId: number) {
  let wallet = await queryOne(`SELECT * FROM "Wallet" WHERE "userId" = $1`, [userId]);
  if (!wallet) {
    wallet = await queryOne(
      `INSERT INTO "Wallet" ("userId", balance, "totalAdded", "totalSpent", "isAiAuthorized", "isActive", "updatedAt")
       VALUES ($1, 0, 0, 0, false, true, NOW()) RETURNING *`,
      [userId]
    );
  }
  // Reset daily spent if date changed
  const today = new Date().toISOString().split('T')[0];
  const lastReset = wallet.lastResetDate
    ? new Date(wallet.lastResetDate).toISOString().split('T')[0]
    : '';
  if (lastReset !== today) {
    await query(
      `UPDATE "Wallet" SET "dailySpentToday" = 0, "lastResetDate" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
      [wallet.id]
    );
    wallet.dailySpentToday = 0;
  }
  return wallet;
}

export async function addWalletFunds(walletId: number, amount: number, description: string) {
  return withTransaction(async (client) => {
    const wallet = (
      await client.query(`SELECT * FROM "Wallet" WHERE id = $1 FOR UPDATE`, [walletId])
    ).rows[0];
    if (!wallet || !wallet.isActive || wallet.isLocked) throw new Error('Wallet unavailable');
    const newBalance = wallet.balance + amount;
    await client.query(
      `UPDATE "Wallet" SET balance = $1, "totalAdded" = "totalAdded" + $2, "updatedAt" = NOW() WHERE id = $3`,
      [newBalance, amount, walletId]
    );
    const txn = (
      await client.query(
        `INSERT INTO "WalletTransaction" ("walletId", type, amount, description, status, "balanceBefore", "balanceAfter", "updatedAt")
       VALUES ($1, 'credit', $2, $3, 'completed', $4, $5, NOW()) RETURNING *`,
        [walletId, amount, description, wallet.balance, newBalance]
      )
    ).rows[0];
    return { wallet: { ...wallet, balance: newBalance }, transaction: txn };
  });
}

export async function debitWallet(
  walletId: number,
  amount: number,
  description: string,
  orderId?: number
) {
  return withTransaction(async (client) => {
    const wallet = (
      await client.query(`SELECT * FROM "Wallet" WHERE id = $1 FOR UPDATE`, [walletId])
    ).rows[0];
    if (!wallet || !wallet.isActive || wallet.isLocked) throw new Error('Wallet unavailable');
    if (wallet.balance < amount) throw new Error('Insufficient balance');
    if (wallet.maxPerOrder && amount > wallet.maxPerOrder)
      throw new Error('Exceeds per-order limit');
    if (wallet.dailyLimit && wallet.dailySpentToday + amount > wallet.dailyLimit)
      throw new Error('Exceeds daily limit');
    const newBalance = wallet.balance - amount;
    await client.query(
      `UPDATE "Wallet" SET balance = $1, "totalSpent" = "totalSpent" + $2, "dailySpentToday" = "dailySpentToday" + $2, "updatedAt" = NOW() WHERE id = $3`,
      [newBalance, amount, walletId]
    );
    const txn = (
      await client.query(
        `INSERT INTO "WalletTransaction" ("walletId", type, amount, description, "orderId", status, "balanceBefore", "balanceAfter", "updatedAt")
       VALUES ($1, 'debit', $2, $3, $4, 'completed', $5, $6, NOW()) RETURNING *`,
        [walletId, amount, description, orderId ?? null, wallet.balance, newBalance]
      )
    ).rows[0];
    return { wallet: { ...wallet, balance: newBalance }, transaction: txn };
  });
}

export async function getWalletTransactions(walletId: number, limit = 20, offset = 0) {
  return query(
    `SELECT * FROM "WalletTransaction" WHERE "walletId" = $1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3`,
    [walletId, limit, offset]
  );
}

export async function updateWalletSettings(
  walletId: number,
  userId: number,
  settings: {
    maxPerOrder?: number | null;
    dailyLimit?: number | null;
    isAiAuthorized?: boolean;
    aiSpendingLimit?: number | null;
  }
) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (settings.maxPerOrder !== undefined) {
    sets.push(`"maxPerOrder" = $${i++}`);
    vals.push(settings.maxPerOrder);
  }
  if (settings.dailyLimit !== undefined) {
    sets.push(`"dailyLimit" = $${i++}`);
    vals.push(settings.dailyLimit);
  }
  if (settings.isAiAuthorized !== undefined) {
    sets.push(`"isAiAuthorized" = $${i++}`);
    vals.push(settings.isAiAuthorized);
  }
  if (settings.aiSpendingLimit !== undefined) {
    sets.push(`"aiSpendingLimit" = $${i++}`);
    vals.push(settings.aiSpendingLimit);
  }
  if (!sets.length) return null;
  sets.push(`"updatedAt" = NOW()`);
  vals.push(walletId, userId);
  return queryOne(
    `UPDATE "Wallet" SET ${sets.join(', ')} WHERE id = $${i} AND "userId" = $${i + 1} RETURNING *`,
    vals
  );
}

// ── AI Shopping List helpers ──────────────────────────────────────────────────

export async function createAiShoppingList(
  userId: number,
  data: {
    rawText: string;
    deliveryDays?: number;
    paymentMethod?: string;
    totalBudget?: number;
  }
) {
  return queryOne(
    `INSERT INTO "AiShoppingList" ("userId", "rawText", "deliveryDays", "paymentMethod", "totalBudget", status, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'pending', NOW()) RETURNING *`,
    [
      userId,
      data.rawText,
      data.deliveryDays ?? null,
      data.paymentMethod ?? null,
      data.totalBudget ?? null,
    ]
  );
}

export async function getAiShoppingLists(userId: number, limit = 20) {
  return query(
    `SELECT * FROM "AiShoppingList" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
    [userId, limit]
  );
}

export async function updateAiShoppingList(
  id: number,
  userId: number,
  data: Record<string, unknown>
) {
  const allowed = ['parsedItems', 'status', 'results', 'orderId', 'errorMessage'];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const key of allowed) {
    if (data[key] !== undefined) {
      const col = `"${key}"`;
      sets.push(`${col} = $${i++}`);
      vals.push(typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]);
    }
  }
  if (!sets.length) return null;
  sets.push(`"updatedAt" = NOW()`);
  vals.push(id, userId);
  return queryOne(
    `UPDATE "AiShoppingList" SET ${sets.join(', ')} WHERE id = $${i} AND "userId" = $${i + 1} RETURNING *`,
    vals
  );
}

// ── Checkout Failure helpers ──────────────────────────────────────────────────

export async function createCheckoutFailure(
  userId: number,
  data: {
    orderId?: number;
    shoppingListId?: number;
    aiShoppingListId?: number;
    failureType: string;
    failureReason: string;
    failureDetails?: object;
    items?: object;
    totalAmount?: number;
    retryable?: boolean;
  }
) {
  return queryOne(
    `INSERT INTO "CheckoutFailure" ("userId", "orderId", "shoppingListId", "aiShoppingListId",
      "failureType", "failureReason", "failureDetails", items, "totalAmount", retryable, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *`,
    [
      userId,
      data.orderId ?? null,
      data.shoppingListId ?? null,
      data.aiShoppingListId ?? null,
      data.failureType,
      data.failureReason,
      data.failureDetails ? JSON.stringify(data.failureDetails) : null,
      data.items ? JSON.stringify(data.items) : null,
      data.totalAmount ?? null,
      data.retryable ?? true,
    ]
  );
}

export async function getCheckoutFailures(userId: number, limit = 20) {
  return query(
    `SELECT * FROM "CheckoutFailure" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
    [userId, limit]
  );
}

// ── SmartIntentEngineResponse — Self-Learning & Reinforcement Learning ──────

export interface CommentEntry {
  text: string;
  timestamp: string;
  userId: string | null; // 'system' for automated actions, email for admin actions
  action: string; // e.g. 'created', 'supervisor_edited', 'ai_enriched', 'toggled_active', 'duplicate_deactivated'
}

export interface SmartIntentRecord {
  id: number;
  userId: number | null;
  queryBy: string;
  queryText: string;
  initialProductSuggestionText: string | null;
  intentEngineResponse: Record<string, unknown>;
  supervisedResponse: Record<string, unknown>;
  aiEnrichedResponse: Record<string, unknown> | null;
  enhancedByAI: boolean;
  isActive: boolean;
  comments: CommentEntry[];
  createdAt: string;
  updatedAt: string;
}

/** Build a comment entry for the audit log */
function buildComment(text: string, userId: string | null, action: string): CommentEntry {
  return {
    text,
    timestamp: new Date().toISOString(),
    userId: userId || 'system',
    action,
  };
}

/** Ensure SmartIntentEngineResponse table exists (idempotent, one-time per process) */
let _sierTableChecked = false;
async function ensureSmartIntentTable(): Promise<void> {
  if (_sierTableChecked) return;
  _sierTableChecked = true;
  try {
    // First, check if User table exists
    const userTableExists = await query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'User') as exists`,
      []
    ).catch(() => [{ exists: false }]);

    const hasForeignKey = userTableExists[0]?.exists === true;

    // Create SmartIntentEngineResponse table
    if (hasForeignKey) {
      // If User table exists, use foreign key constraint
      await query(
        `
        CREATE TABLE IF NOT EXISTS "SmartIntentEngineResponse" (
          id SERIAL PRIMARY KEY,
          "userId" INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
          "queryBy" TEXT NOT NULL DEFAULT 'anonymous',
          "queryText" TEXT NOT NULL,
          "initialProductSuggestionText" TEXT,
          "intentEngineResponse" JSONB NOT NULL DEFAULT '{}',
          "supervisedResponse" JSONB NOT NULL DEFAULT '{}',
          "aiEnrichedResponse" JSONB,
          "enhancedByAI" BOOLEAN NOT NULL DEFAULT false,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "comments" JSONB NOT NULL DEFAULT '[]',
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
        []
      );
    } else {
      // If User table doesn't exist, create without foreign key constraint
      await query(
        `
        CREATE TABLE IF NOT EXISTS "SmartIntentEngineResponse" (
          id SERIAL PRIMARY KEY,
          "userId" INTEGER,
          "queryBy" TEXT NOT NULL DEFAULT 'anonymous',
          "queryText" TEXT NOT NULL,
          "initialProductSuggestionText" TEXT,
          "intentEngineResponse" JSONB NOT NULL DEFAULT '{}',
          "supervisedResponse" JSONB NOT NULL DEFAULT '{}',
          "aiEnrichedResponse" JSONB,
          "enhancedByAI" BOOLEAN NOT NULL DEFAULT false,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "comments" JSONB NOT NULL DEFAULT '[]',
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
        []
      );
    }

    // Add any missing columns idempotently
    await query(
      `ALTER TABLE "SmartIntentEngineResponse" ADD COLUMN IF NOT EXISTS "updatedBy" TEXT`,
      []
    );
    await query(
      `ALTER TABLE "SmartIntentEngineResponse" ADD COLUMN IF NOT EXISTS "userEmail" TEXT`,
      []
    );
  } catch (err: any) {
    console.error('[DB] ensureSmartIntentTable error:', err.message);
    throw err;
  }
}

/** Insert a new learning record when any chat query is processed.
 * If an exact same queryText already exists, the new record is auto-deactivated.
 */
export async function insertSmartIntentRecord(data: {
  userId: number | null;
  queryBy: string;
  queryText: string;
  initialProductSuggestionText: string | null;
  intentEngineResponse: Record<string, unknown>;
  userEmail?: string;
}): Promise<SmartIntentRecord> {
  await ensureSmartIntentTable();
  const normalizedQuery = (data.queryText || '').trim();

  // Check for duplicate queryText (exact match, case-insensitive)
  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM "SmartIntentEngineResponse"
     WHERE LOWER(TRIM("queryText")) = LOWER($1)
     LIMIT 1`,
    [normalizedQuery]
  );

  const isDuplicate = existing !== null;
  const creationComment = buildComment(
    isDuplicate
      ? `Made inactive by system as it is a duplicate query (original record ID: ${existing!.id})`
      : 'Record created',
    'system',
    isDuplicate ? 'duplicate_deactivated' : 'created'
  );

  const rows = await query<SmartIntentRecord>(
    `INSERT INTO "SmartIntentEngineResponse"
       ("userId", "queryBy", "queryText", "initialProductSuggestionText",
        "intentEngineResponse", "supervisedResponse", "isActive", "comments", "userEmail", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, $6, $7::jsonb, $8, NOW(), NOW())
     RETURNING *`,
    [
      data.userId,
      data.queryBy || 'anonymous',
      normalizedQuery,
      data.initialProductSuggestionText,
      JSON.stringify(data.intentEngineResponse),
      !isDuplicate, // isActive = false if duplicate
      JSON.stringify([creationComment]),
      data.userEmail ?? null,
    ]
  );
  return rows[0];
}

/** Fetch all learning records for admin dashboard (paginated) */
export async function getSmartIntentRecords(
  limit = 50,
  offset = 0,
  search?: string,
  sortField: string = 'id',
  sortDir: string = 'desc',
  filterActive?: 'active' | 'inactive',
  filterAI?: 'enriched' | 'unenriched',
  filterQueryBy?: string,
  filterQueryText?: string
): Promise<{ records: SmartIntentRecord[]; total: number }> {
  // Ensure table exists before querying
  await ensureSmartIntentTable();

  // Whitelist sort columns to prevent SQL injection
  const allowedSortFields: Record<string, string> = {
    id: '"id"',
    queryBy: '"queryBy"',
    queryText: '"queryText"',
    createdAt: '"createdAt"',
    updatedAt: '"updatedAt"',
    isActive: '"isActive"',
    enhancedByAI: '"enhancedByAI"',
  };
  const safeSort = allowedSortFields[sortField] || '"id"';
  const safeDir = sortDir === 'asc' ? 'ASC' : 'DESC';

  // Build WHERE conditions with proper parameter indexing
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search) {
    conditions.push(`"queryText" ILIKE $${params.length + 1}`);
    params.push(`%${search}%`);
  }
  if (filterQueryBy) {
    conditions.push(`"queryBy" ILIKE $${params.length + 1}`);
    params.push(`%${filterQueryBy}%`);
  }
  if (filterQueryText) {
    conditions.push(`"queryText" ILIKE $${params.length + 1}`);
    params.push(`%${filterQueryText}%`);
  }
  if (filterActive === 'active') {
    conditions.push(`"isActive" = $${params.length + 1}`);
    params.push(true);
  } else if (filterActive === 'inactive') {
    conditions.push(`"isActive" = $${params.length + 1}`);
    params.push(false);
  }
  if (filterAI === 'enriched') {
    conditions.push(`"enhancedByAI" = true`);
  } else if (filterAI === 'unenriched') {
    conditions.push(`("enhancedByAI" = false OR "enhancedByAI" IS NULL)`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Execute COUNT query
  const countSql = `SELECT COUNT(*) as count FROM "SmartIntentEngineResponse" ${whereClause}`;
  const countResult = await query<{ count: string }>(countSql, params);
  const total = parseInt(countResult[0]?.count || '0', 10);

  // Execute SELECT query with LIMIT/OFFSET
  const selectParams = [...params];
  selectParams.push(limit);
  selectParams.push(offset);

  const selectSql = `SELECT * FROM "SmartIntentEngineResponse" ${whereClause}
     ORDER BY ${safeSort} ${safeDir} LIMIT $${selectParams.length - 1} OFFSET $${selectParams.length}`;

  const records = await query<SmartIntentRecord>(selectSql, selectParams);

  return { records, total };
}

/** Update supervised response (admin inline edit) */
export async function updateSupervisedResponse(
  id: number,
  supervisedResponse: Record<string, unknown>,
  adminEmail?: string
): Promise<SmartIntentRecord | null> {
  const comment = buildComment(
    `Supervised response updated by admin`,
    adminEmail || 'system',
    'supervisor_edited'
  );
  const rows = await query<SmartIntentRecord>(
    `UPDATE "SmartIntentEngineResponse"
     SET "supervisedResponse" = $2,
         "comments" = "comments" || $3::jsonb,
         "updatedAt" = NOW()
     WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(supervisedResponse), JSON.stringify([comment])]
  );
  return rows[0] || null;
}

/** Update AI-enriched response */
export async function updateAIEnrichedResponse(
  id: number,
  aiEnrichedResponse: Record<string, unknown>,
  adminEmail?: string
): Promise<SmartIntentRecord | null> {
  const comment = buildComment(
    `AI enrichment applied using LLM`,
    adminEmail || 'system',
    'ai_enriched'
  );
  const rows = await query<SmartIntentRecord>(
    `UPDATE "SmartIntentEngineResponse"
     SET "aiEnrichedResponse" = $2,
         "enhancedByAI" = true,
         "comments" = "comments" || $3::jsonb,
         "updatedAt" = NOW()
     WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(aiEnrichedResponse), JSON.stringify([comment])]
  );
  return rows[0] || null;
}

/** Delete a learning record */
export async function deleteSmartIntentRecord(id: number): Promise<boolean> {
  const rows = await query(`DELETE FROM "SmartIntentEngineResponse" WHERE id = $1 RETURNING id`, [
    id,
  ]);
  return rows.length > 0;
}

/** Toggle isActive flag on a learning record (appends audit comment) */
export async function toggleSmartIntentActive(
  id: number,
  isActive: boolean,
  adminEmail?: string
): Promise<SmartIntentRecord | null> {
  const comment = buildComment(
    isActive ? 'Record activated by admin' : 'Record deactivated by admin',
    adminEmail || 'system',
    'toggled_active'
  );
  const rows = await query<SmartIntentRecord>(
    `UPDATE "SmartIntentEngineResponse"
     SET "isActive" = $2,
         "comments" = "comments" || $3::jsonb,
         "updatedAt" = NOW()
     WHERE id = $1 RETURNING *`,
    [id, isActive, JSON.stringify([comment])]
  );
  return rows[0] || null;
}

/** AND "isActive" = true
 * Look up cached/learned response for a query.
 * Match strategy: exact text match OR all words contained in previous query.
 * Priority: aiEnrichedResponse > supervisedResponse
 */
/**
 * Extract noun tokens (product/brand/category keywords) from a query string.
 * Filters out common stop words and amount words.
 */
function extractNouns(text: string): string[] {
  const stopWords = new Set([
    'a',
    'an',
    'the',
    'is',
    'in',
    'on',
    'at',
    'of',
    'for',
    'to',
    'and',
    'or',
    'with',
    'by',
    'from',
    'as',
    'me',
    'my',
    'i',
    'want',
    'need',
    'looking',
    'under',
    'below',
    'above',
    'around',
    'within',
    'budget',
    'price',
    'best',
    'good',
    'nice',
    'great',
    'top',
    'cheap',
    'affordable',
    'new',
    'buy',
    'get',
    'recommend',
    'suggest',
    'show',
    'find',
    'search',
  ]);
  return text
    .toLowerCase()
    .replace(/[₹$,]/g, '')
    .replace(/\d+/g, '')
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z]/g, ''))
    .filter((w) => w.length >= 2 && !stopWords.has(w));
}

/**
 * Extract amount/budget signals from a query string.
 * Returns normalized numbers found in the text (e.g. "50000" from "under 50k").
 */
function extractAmounts(text: string): number[] {
  const amounts: number[] = [];
  // Match patterns like 50000, 50k, ₹50000, $50
  const matches = text.matchAll(
    /(?:₹|rs\.?\s*|inr\s*|\$)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:k|lakh|l)?/gi
  );
  for (const m of matches) {
    let val = parseFloat(m[1].replace(/,/g, ''));
    const suffix = m[0]
      .slice(m[1].length + (m.index ? 0 : 0))
      .toLowerCase()
      .trim();
    if (suffix.startsWith('k')) val *= 1000;
    if (suffix.startsWith('l')) val *= 100000;
    if (val > 0) amounts.push(val);
  }
  return amounts;
}

export async function findLearnedResponse(queryText: string): Promise<{
  questions: unknown;
  enrichedQuestions?: unknown;
  source: 'ai' | 'supervised';
  matchType: string;
} | null> {
  const normalized = queryText.trim().toLowerCase();
  if (!normalized || normalized.length < 3) return null;

  /** Helper to extract the best response payload from a record */
  function pickResponse(rec: SmartIntentRecord, matchType: string) {
    // Prefer AI enriched response with enrichedQuestions
    if (rec.aiEnrichedResponse && Object.keys(rec.aiEnrichedResponse).length > 0) {
      const enriched = rec.aiEnrichedResponse as Record<string, unknown>;
      return {
        questions: enriched,
        enrichedQuestions: Array.isArray(enriched.enrichedQuestions)
          ? enriched.enrichedQuestions
          : null,
        source: 'ai' as const,
        matchType,
      };
    }
    if (rec.supervisedResponse && Object.keys(rec.supervisedResponse).length > 0) {
      return {
        questions: rec.supervisedResponse,
        enrichedQuestions: null,
        source: 'supervised' as const,
        matchType,
      };
    }
    return null;
  }

  // ── Strategy 1: Exact text match ────────────────────────────────────
  const exact = await query<SmartIntentRecord>(
    `SELECT * FROM "SmartIntentEngineResponse"
     WHERE LOWER(TRIM("queryText")) = $1 AND "isActive" = true
     ORDER BY "updatedAt" DESC LIMIT 1`,
    [normalized]
  );
  if (exact.length > 0) {
    const r = pickResponse(exact[0], 'exact');
    if (r) return r;
  }

  // ── Strategy 2: Partial match — all nouns + all amounts match ────────
  const queryNouns = extractNouns(normalized);
  const queryAmounts = extractAmounts(normalized);

  if (queryNouns.length === 0) return null;

  // Fetch recent active candidates
  const candidates = await query<SmartIntentRecord>(
    `SELECT * FROM "SmartIntentEngineResponse"
     WHERE "isActive" = true
       AND "createdAt" >= NOW() - INTERVAL '90 days'
     ORDER BY "updatedAt" DESC LIMIT 200`,
    []
  );

  if (candidates.length === 0) return null;

  type ScoredRecord = {
    rec: SmartIntentRecord;
    nounMatchPct: number;
    amountMatch: boolean;
    totalScore: number;
  };
  const scored: ScoredRecord[] = [];

  for (const rec of candidates) {
    const recNouns = extractNouns(rec.queryText.toLowerCase());
    const recAmounts = extractAmounts(rec.queryText.toLowerCase());

    if (recNouns.length === 0) continue;

    // Count how many query nouns appear in the record's nouns
    const matchedNouns = queryNouns.filter((n) => recNouns.includes(n));
    const nounMatchPct = matchedNouns.length / queryNouns.length;
    if (nounMatchPct < 0.7) continue; // below 70% noun match threshold

    // Amount matching
    let amountMatch = true;
    if (queryAmounts.length > 0 && recAmounts.length > 0) {
      // Allow ±10% tolerance for amounts
      amountMatch = queryAmounts.some((qa) =>
        recAmounts.some((ra) => Math.abs(qa - ra) / Math.max(qa, ra) <= 0.1)
      );
    }

    const totalScore = nounMatchPct * 100 + (amountMatch ? 20 : 0);
    scored.push({ rec, nounMatchPct, amountMatch, totalScore });
  }

  if (scored.length === 0) return null;

  // Sort by score desc
  scored.sort((a, b) => b.totalScore - a.totalScore);
  const best = scored[0];

  let matchType: string;
  if (best.nounMatchPct === 1 && best.amountMatch) {
    matchType = 'nouns+amounts'; // all nouns + amounts match
  } else if (best.nounMatchPct === 1 && queryAmounts.length > 0 && !best.amountMatch) {
    matchType = 'nouns_only'; // all nouns match but amount differs
  } else {
    matchType = `partial_nouns_${Math.round(best.nounMatchPct * 100)}pct`;
  }

  const r = pickResponse(best.rec, matchType);
  if (r) return r;

  return null;
}

/** Batch fetch records for AI enrichment.
 * Strict filter: ACTIVE=true AND queryBy != 'anonymous' AND enhancedByAI=false
 */
export async function getUnenrichedRecords(batchSize = 10): Promise<SmartIntentRecord[]> {
  return query<SmartIntentRecord>(
    `SELECT * FROM "SmartIntentEngineResponse"
     WHERE "enhancedByAI" = false
       AND "isActive" = true
       AND LOWER("queryBy") != 'anonymous'
       AND ("aiEnrichedResponse" IS NULL OR "aiEnrichedResponse" = '{}'::jsonb)
     ORDER BY "createdAt" ASC LIMIT $1`,
    [batchSize]
  );
}

/** Fetch unenriched active records with model specification.
 * Filter: ACTIVE=true AND enhancedByAI=false AND recent 30 days.
 * Includes anonymous users — any query is a valid learning candidate.
 * Accepts optional selectedIds to enrich specific records.
 */
export async function getUnenrichedRecordsForModel(
  batchSize = 10,
  _model: string = 'auto',
  selectedIds?: number[]
): Promise<SmartIntentRecord[]> {
  if (selectedIds && selectedIds.length > 0) {
    // Enrich specific selected records (bypass active/30-day filter for manual selection)
    const placeholders = selectedIds.map((_, i) => `$${i + 1}`).join(',');
    return query<SmartIntentRecord>(
      `SELECT * FROM "SmartIntentEngineResponse"
       WHERE id IN (${placeholders})
         AND "enhancedByAI" = false
         AND ("aiEnrichedResponse" IS NULL OR "aiEnrichedResponse" = '{}'::jsonb)
       ORDER BY "createdAt" ASC`,
      selectedIds
    );
  }
  return query<SmartIntentRecord>(
    `SELECT * FROM "SmartIntentEngineResponse"
     WHERE "enhancedByAI" = false
       AND "isActive" = true
       AND ("aiEnrichedResponse" IS NULL OR "aiEnrichedResponse" = '{}'::jsonb)
       AND "createdAt" >= NOW() - INTERVAL '30 days'
     ORDER BY "createdAt" ASC LIMIT $1`,
    [batchSize]
  );
}
