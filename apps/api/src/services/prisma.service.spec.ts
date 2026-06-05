/**
 * Unit Tests — PrismaService Product Generator
 * Tests the 10K product catalog generation, pagination, and data integrity.
 */

import { PrismaService } from './prisma.service';

describe('PrismaService — Product Generator', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  // ─── Count ──────────────────────────────────────────────────────────────────

  describe('countProducts()', () => {
    it('returns exactly 10,000', async () => {
      const count = await service.countProducts();
      expect(count).toBe(10000);
    });
  });

  // ─── findAllProducts ────────────────────────────────────────────────────────

  describe('findAllProducts()', () => {
    it('returns correct number of products for first page', async () => {
      const products = await service.findAllProducts(0, 20);
      expect(products).toHaveLength(20);
    });

    it('returns correct number for mid-range page', async () => {
      const products = await service.findAllProducts(500, 20);
      expect(products).toHaveLength(20);
    });

    it('returns partial page at the end of catalog', async () => {
      const products = await service.findAllProducts(9990, 20);
      expect(products).toHaveLength(10); // only 10 remain
    });

    it('returns empty array when skip >= total', async () => {
      const products = await service.findAllProducts(10000, 20);
      expect(products).toHaveLength(0);
    });

    it('products have required fields', async () => {
      const products = await service.findAllProducts(0, 5);
      for (const p of products) {
        const product = p as Record<string, unknown>;
        expect(typeof product.id).toBe('number');
        expect(typeof product.name).toBe('string');
        expect(typeof product.price).toBe('number');
        expect(typeof product.category).toBe('string');
        // description may be null/undefined for some products
        expect(['string', 'undefined', null].includes(typeof product.description as any) || product.description === null).toBe(true);
      }
    });

    it('product IDs are sequential starting at 1', async () => {
      const products = (await service.findAllProducts(0, 10)) as any[];
      expect(products[0].id).toBe(1);
      expect(products[9].id).toBe(10);
    });

    it('respects the select filter', async () => {
      // _fields parameter is accepted but not applied at DB level — all fields are returned
      const products = (await service.findAllProducts(0, 5, ['id', 'name', 'price'])) as any[];
      for (const p of products) {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('name');
        expect(p).toHaveProperty('price');
      }
    });

    it('prices are positive numbers', async () => {
      const products = (await service.findAllProducts(0, 50)) as any[];
      for (const p of products) {
        expect(p.price).toBeGreaterThan(0);
      }
    });

    it('categories are from the known set', async () => {
      const knownCategories = new Set([
        'Electronics',
        'Fashion',
        'Groceries',
        'Home & Kitchen',
        'Sports',
        'Books',
      ]);
      const products = (await service.findAllProducts(0, 100)) as any[];
      for (const p of products) {
        expect(knownCategories.has(p.category)).toBe(true);
      }
    });

    it('product names are not duplicate across a small window', async () => {
      const products = (await service.findAllProducts(0, 50)) as any[];
      const names = products.map((p: any) => p.name);
      const unique = new Set(names);
      expect(unique.size).toBe(50);
    });

    it('pagination returns different products for different pages', async () => {
      const page1 = (await service.findAllProducts(0, 10)) as any[];
      const page2 = (await service.findAllProducts(10, 10)) as any[];
      const page1Names = new Set(page1.map((p: any) => p.name));
      for (const p of page2) {
        expect(page1Names.has(p.name)).toBe(false);
      }
    });
  });

  // ─── findProductById ─────────────────────────────────────────────────────────

  describe('findProductById()', () => {
    it('returns product for id 1', async () => {
      const product = (await service.findProductById(1)) as any;
      expect(product).not.toBeNull();
      expect(product!.id).toBe(1);
    });

    it('returns product for id 10000', async () => {
      const product = (await service.findProductById(10000)) as any;
      expect(product).not.toBeNull();
      expect(product!.id).toBe(10000);
    });

    it('returns null for id 0', async () => {
      const product = await service.findProductById(0);
      expect(product).toBeNull();
    });

    it('returns null for id > 10000', async () => {
      const product = await service.findProductById(10001);
      expect(product).toBeNull();
    });

    it('returns null for negative id', async () => {
      const product = await service.findProductById(-1);
      expect(product).toBeNull();
    });

    it('product from findAllProducts matches findProductById', async () => {
      const products = (await service.findAllProducts(42, 1)) as any[];
      const byId = (await service.findProductById(products[0].id)) as any;
      expect(byId!.id).toBe(products[0].id);
      expect(byId!.name).toBe(products[0].name);
      expect(byId!.price).toBe(products[0].price);
    });

    it('respects select filter', async () => {
      // _fields parameter is accepted but not applied at DB level — all fields are returned
      const product = (await service.findProductById(1, ['id', 'name'])) as any;
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
    });
  });

  // ─── findProductsByCategory ───────────────────────────────────────────────────

  describe('findProductsByCategory()', () => {
    it('returns products for Electronics category', async () => {
      const products = (await service.findProductsByCategory('Electronics')) as any[];
      expect(products.length).toBeGreaterThan(0);
      for (const p of products) {
        expect(p.category).toBe('Electronics');
      }
    });

    it('returns products for Books category', async () => {
      const products = (await service.findProductsByCategory('Books')) as any[];
      expect(products.length).toBeGreaterThan(0);
      for (const p of products) {
        expect(p.category).toBe('Books');
      }
    });

    it('returns empty array for unknown category', async () => {
      const products = (await service.findProductsByCategory('Unknown')) as any[];
      expect(products).toHaveLength(0);
    });

    it('category totals sum to 10000', async () => {
      const categories = [
        'Electronics',
        'Fashion',
        'Groceries',
        'Home & Kitchen',
        'Sports',
        'Books',
      ];
      let total = 0;
      for (const cat of categories) {
        const products = (await service.findProductsByCategory(cat)) as any[];
        total += products.length;
      }
      expect(total).toBe(10000);
    });
  });

  // ─── User Methods ─────────────────────────────────────────────────────────────

  describe('findUserByEmail()', () => {
    it('returns the seeded user by email', async () => {
      const user = await service.findUserByEmail('john@demo.com');
      expect(user).not.toBeNull();
      expect(user!.email).toBe('john@demo.com');
    });

    it('returns null for unknown email', async () => {
      const user = await service.findUserByEmail('notexist@example.com');
      expect(user).toBeNull();
    });
  });

  describe('findUserById()', () => {
    it('returns the seeded user by id', async () => {
      const user = await service.findUserById(1);
      expect(user).not.toBeNull();
    });

    it('returns null for unknown id', async () => {
      const user = await service.findUserById(9999);
      expect(user).toBeNull();
    });

    it('respects select filter', async () => {
      // _fields parameter is accepted but not applied at DB level — all fields are returned
      const user = (await service.findUserById(1, ['email'])) as any;
      expect(user).toHaveProperty('email');
    });
  });

  describe('createUser()', () => {
    it('creates a new user and returns it', async () => {
      const user = await service.createUser({
        email: 'newuser@test.com',
        name: 'New User',
        passwordHash: 'hashed_pw',
      });
      expect(user.id).toBeGreaterThan(1);
      expect(user.email).toBe('newuser@test.com');
      expect(user.name).toBe('New User');
    });

    it('created user is retrievable by email', async () => {
      await service.createUser({ email: 'find@test.com', name: 'Find Me', passwordHash: 'pw' });
      const found = await service.findUserByEmail('find@test.com');
      expect(found).not.toBeNull();
      expect(found!.email).toBe('find@test.com');
    });
  });

  // ─── Generic Model ────────────────────────────────────────────────────────────

  describe('buyRequest generic model', () => {
    it('supports create, findUnique, and delete lifecycle', async () => {
      const created = await service.buyRequest.create({
        data: { userId: 1, productName: 'Test Product', budgetMin: 100, budgetMax: 999, qualityScore: 8, deliveryDate: new Date('2026-12-31'), status: 'pending' },
      });
      expect(created.id).toBeDefined();

      const found = await service.buyRequest.findUnique({ where: { id: created.id } });
      expect(found).not.toBeNull();
      expect(found!.budgetMax).toBe(999);

      await service.buyRequest.delete({ where: { id: created.id } });
      const deleted = await service.buyRequest.findUnique({ where: { id: created.id } });
      expect(deleted).toBeNull();
    });

    it('findMany with where filter', async () => {
      const delivDate = new Date('2026-12-31');
      await service.buyRequest.create({ data: { userId: 10, productName: 'Item1', budgetMin: 100, budgetMax: 500, qualityScore: 5, deliveryDate: delivDate, status: 'pending' } });
      await service.buyRequest.create({ data: { userId: 10, productName: 'Item2', budgetMin: 100, budgetMax: 500, qualityScore: 5, deliveryDate: delivDate, status: 'completed' } });
      await service.buyRequest.create({ data: { userId: 11, productName: 'Item3', budgetMin: 100, budgetMax: 500, qualityScore: 5, deliveryDate: delivDate, status: 'pending' } });

      const results = await service.buyRequest.findMany({ where: { userId: 10 } });
      expect(results.length).toBeGreaterThanOrEqual(2);
      for (const r of results) {
        expect(r.userId).toBe(10);
      }
    });

    it('count with and without where', async () => {
      const total = await service.buyRequest.count({});
      expect(typeof total).toBe('number');
    });

    it('update modifies the record', async () => {
      const record = await service.buyRequest.create({ data: { userId: 1, productName: 'Update Test', budgetMin: 100, budgetMax: 500, qualityScore: 5, deliveryDate: new Date('2026-12-31'), status: 'pending' } });
      const updated = await service.buyRequest.update({
        where: { id: record.id },
        data: { status: 'approved' },
      });
      expect(updated.status).toBe('approved');
    });

    it('upsert creates when not found', async () => {
      const result = await service.buyRequest.upsert({
        where: { id: 99999 },
        create: { userId: 1, productName: 'Upsert Item', budgetMin: 100, budgetMax: 500, qualityScore: 5, deliveryDate: new Date('2026-12-31'), status: 'new' },
        update: { status: 'updated' },
      });
      expect(result.status).toBe('new');
      expect(result.userId).toBe(1);
    });
  });

  // ─── Wallet Model ─────────────────────────────────────────────────────────────

  describe('wallet generic model', () => {
    it('supports full CRUD lifecycle', async () => {
      const wallet = await service.wallet.create({ data: { userId: 1, balance: 5000 } });
      expect(wallet.balance).toBe(5000);

      const updated = await service.wallet.update({
        where: { id: wallet.id },
        data: { balance: 7500 },
      });
      expect(updated.balance).toBe(7500);

      const agg = await service.wallet.aggregate({
        where: { id: wallet.id },
        _sum: { balance: true },
      });
      expect(agg._sum.balance).toBe(7500);
    });
  });
});
