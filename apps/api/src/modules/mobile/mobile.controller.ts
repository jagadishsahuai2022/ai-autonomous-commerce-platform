import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { CartService } from '../cart/cart.service';
import { PrismaService } from '../../services/prisma.service';

/**
 * Mobile-compatible REST controller.
 * Provides endpoints that match what the delegatecart-mobile app calls.
 *
 * Auth: The mobile sends a Bearer token that is base64(JSON.stringify({userId, email, iat})).
 * This controller decodes that token to extract the userId for all authenticated operations.
 */
@Controller()
export class MobileController {
  private readonly logger = new Logger(MobileController.name);

  // In-memory wishlist removed — replaced with DB-backed WishlistCollection endpoints below.

  constructor(
    private readonly cartService: CartService,
    private readonly prisma: PrismaService
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Token helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private decodeUserId(authorization: string | undefined): number {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    try {
      const token = authorization.slice(7);
      const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      const userId = payload?.userId;
      if (typeof userId !== 'number' || !Number.isInteger(userId) || userId <= 0) {
        throw new Error('invalid userId in token');
      }
      return userId;
    } catch {
      throw new UnauthorizedException('Invalid auth token');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Auth
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  logout() {
    return { ok: true };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Users / profile
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('users/me')
  async getProfile(@Headers('authorization') auth: string) {
    const userId = this.decodeUserId(auth);
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
      return {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        phone: null,
        dateOfBirth: null,
        gender: null,
        avatarUrl: null,
        subscriptionPlan: (user.subscriptionPlan as 'BASIC' | 'AI_PLUS') ?? 'BASIC',
        subscriptionExpiresAt: null,
        aiCreditsUsed: 0,
        aiCreditsTotal: 100,
        role: user.role,
      };
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof UnauthorizedException) throw err;
      // Fallback for dev when DB might not have the user yet (phone OTP stub users)
      return {
        id: userId,
        email: `user${userId}@delegatecart.local`,
        name: null,
        phone: null,
        dateOfBirth: null,
        gender: null,
        avatarUrl: null,
        subscriptionPlan: 'BASIC',
        subscriptionExpiresAt: null,
        aiCreditsUsed: 0,
        aiCreditsTotal: 100,
        role: 'customer',
      };
    }
  }

  @Patch('users/me')
  async updateProfile(
    @Headers('authorization') auth: string,
    @Body() body: { name?: string; phone?: string; dateOfBirth?: string; gender?: string }
  ) {
    const userId = this.decodeUserId(auth);
    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: body.name,
        },
      });
      return { id: updated.id, email: updated.email, name: updated.name };
    } catch {
      return { id: userId, ...body };
    }
  }

  @Get('users/me/devices')
  getDevices(@Headers('authorization') auth: string) {
    this.decodeUserId(auth);
    return [];
  }

  @Post('users/me/change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(@Headers('authorization') auth: string, @Body() _body: any) {
    this.decodeUserId(auth);
    return { ok: true };
  }

  @Get('users/me/sessions')
  getSessions(@Headers('authorization') auth: string) {
    this.decodeUserId(auth);
    return [];
  }

  @Delete('users/me/sessions/:id')
  @HttpCode(HttpStatus.OK)
  revokeSession(@Headers('authorization') auth: string, @Param('id') _id: string) {
    this.decodeUserId(auth);
    return { ok: true };
  }

  @Delete('users/me/sessions')
  @HttpCode(HttpStatus.OK)
  revokeAllSessions(@Headers('authorization') auth: string) {
    this.decodeUserId(auth);
    return { ok: true };
  }

  @Post('users/me/2fa/enable')
  @HttpCode(HttpStatus.OK)
  enable2fa(@Headers('authorization') auth: string) {
    this.decodeUserId(auth);
    return { secret: 'dev-secret-stub', qrCodeUrl: '' };
  }

  @Post('users/me/2fa/disable')
  @HttpCode(HttpStatus.OK)
  disable2fa(@Headers('authorization') auth: string, @Body() _body: any) {
    this.decodeUserId(auth);
    return { ok: true };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Payments (stubs)
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('payments/intent')
  @HttpCode(HttpStatus.CREATED)
  createPaymentIntent(@Headers('authorization') auth: string, @Body() body: { orderId?: number }) {
    this.decodeUserId(auth);
    return {
      clientSecret: `dev_secret_${body.orderId ?? 0}_${Date.now()}`,
      amount: 0,
      currency: 'INR',
    };
  }

  @Get('payments/methods')
  getPaymentMethods(@Headers('authorization') auth: string) {
    this.decodeUserId(auth);
    return [];
  }

  @Post('payments/confirm/:intentId')
  @HttpCode(HttpStatus.OK)
  confirmPayment(@Headers('authorization') auth: string, @Param('intentId') _id: string) {
    this.decodeUserId(auth);
    return { ok: true };
  }

  @Get('payments/cards')
  listCards(@Headers('authorization') auth: string) {
    this.decodeUserId(auth);
    return [];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Cart  — matches delegatecart-mobile cartService routes
  // ─────────────────────────────────────────────────────────────────────────────

  /** Reshape flat in-memory cart items into the nested CartItem shape expected by the mobile app. */
  private reshapeCartItems(rawItems: any[]): any[] {
    return rawItems.map((i) => ({
      id: i.id ?? i.productId,
      productId: i.productId,
      quantity: i.quantity ?? 1,
      product: {
        id: i.productId,
        name: i.name ?? i.productName ?? `Product #${i.productId}`,
        price: i.price ?? 0,
        originalPrice: i.originalPrice ?? null,
        imageUrl: i.imageUrl ?? i.image ?? null,
        image: i.imageUrl ?? i.image ?? null,
        category: i.category ?? '',
        brand: i.brand ?? null,
        description: i.description ?? null,
        rating: i.rating ?? 0,
        reviewCount: i.reviewCount ?? 0,
        inStock: typeof i.inStock === 'boolean' ? i.inStock : true,
        inventoryCount: i.inventoryCount ?? null,
      },
    }));
  }

  @Get('cart')
  getCart(@Headers('authorization') auth: string) {
    const userId = this.decodeUserId(auth);
    const result = this.cartService.getCart(userId) as any;
    const rawCart = result?.cart ?? result;
    const rawItems: any[] = rawCart?.items ?? [];
    const items = this.reshapeCartItems(rawItems);
    const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
    return { id: userId, items, subtotal, total: subtotal, itemCount: items.length };
  }

  @Post('cart/items')
  async addToCart(
    @Headers('authorization') auth: string,
    @Body() body: { productId: number; quantity?: number }
  ) {
    const userId = this.decodeUserId(auth);
    if (!body?.productId) throw new BadRequestException('productId required');

    // Fetch product details (name, price, image, inStock, inventory) from DB.
    let productData: {
      name: string;
      price: number;
      imageUrl: string | null;
      category: string;
      brand: string | null;
      rating: number | null;
      inStock: boolean;
      inventoryCount: number | null;
    } | null = null;
    try {
      const row = await this.prisma.product.findUnique({
        where: { id: body.productId },
        select: {
          name: true,
          price: true,
          imageUrl: true,
          category: true,
          inStock: true,
          businessMetrics: { select: { inventoryCount: true } },
        },
      });
      if (row) {
        productData = {
          name: row.name,
          price: row.price,
          imageUrl: row.imageUrl ?? null,
          category: row.category,
          brand: null,
          rating: null,
          inStock: row.inStock,
          inventoryCount: row.businessMetrics?.inventoryCount ?? null,
        };
      }
    } catch {
      /* ignore DB errors in dev */
    }

    const qty = body.quantity ?? 1;
    const item = {
      id: body.productId,
      productId: body.productId,
      name: productData?.name ?? `Product #${body.productId}`,
      price: productData?.price ?? 0,
      imageUrl: productData?.imageUrl ?? null,
      category: productData?.category ?? '',
      brand: productData?.brand ?? null,
      rating: productData?.rating ?? 0,
      inStock: productData?.inStock ?? true,
      inventoryCount: productData?.inventoryCount ?? null,
      quantity: qty,
    };
    const result = (await this.cartService.addItem(userId, item)) as any;
    const rawCart = result?.cart ?? result;
    const rawItems: any[] = rawCart?.items ?? [];
    const items = this.reshapeCartItems(rawItems);
    const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
    return { id: userId, items, subtotal, total: subtotal, itemCount: items.length };
  }

  @Patch('cart/items/:itemId')
  async updateCartItem(
    @Headers('authorization') auth: string,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: { quantity: number }
  ) {
    const userId = this.decodeUserId(auth);
    const cartResult = this.cartService.getCart(userId) as any;
    const cart = cartResult?.cart ?? cartResult;
    const rawItems: any[] = cart?.items ?? [];
    const item = rawItems.find((i: any) => i.id === itemId || i.productId === itemId);
    if (!item) throw new NotFoundException('Cart item not found');

    if (body.quantity <= 0) {
      await this.cartService.removeItem(userId, itemId);
    } else {
      item.quantity = body.quantity;
    }
    const updated = this.cartService.getCart(userId) as any;
    const updatedCart = updated?.cart ?? updated;
    const updatedRaw: any[] = updatedCart?.items ?? [];
    const items = this.reshapeCartItems(updatedRaw);
    const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
    return { id: userId, items, subtotal, total: subtotal, itemCount: items.length };
  }

  @Delete('cart/items/:itemId')
  async removeCartItem(
    @Headers('authorization') auth: string,
    @Param('itemId', ParseIntPipe) itemId: number
  ) {
    const userId = this.decodeUserId(auth);
    await this.cartService.removeItem(userId, itemId);
    const result = this.cartService.getCart(userId) as any;
    const cart = result?.cart ?? result;
    const rawItems: any[] = cart?.items ?? [];
    const items = this.reshapeCartItems(rawItems);
    const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
    return { id: userId, items, subtotal, total: subtotal, itemCount: items.length };
  }

  @Post('cart/clear')
  @HttpCode(HttpStatus.OK)
  clearCart(@Headers('authorization') auth: string) {
    const userId = this.decodeUserId(auth);
    const cartResult = this.cartService.getCart(userId) as any;
    const cart = cartResult?.cart ?? cartResult;
    if (cart) {
      cart.items = [];
      cart.total = 0;
    }
    return { ok: true };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Wishlist Collections — DB-persisted, multi-collection per user
  // ─────────────────────────────────────────────────────────────────────────────

  /** Ensure the user has a default collection and return all their collections. */
  private async getOrCreateDefaultCollection(userId: number) {
    const existing = await this.prisma.wishlistCollection.findFirst({
      where: { userId, isDefault: true },
    });
    if (existing) return existing;
    return this.prisma.wishlistCollection.create({
      data: { userId, name: 'DC Favorite', isDefault: true },
    });
  }

  /** Fetch productIds for a collection (separate query avoids stale Prisma include types). */
  private async getProductIds(collectionId: number): Promise<number[]> {
    const items: { productId: number }[] = await this.prisma.wishlistCollectionProduct.findMany({
      where: { collectionId },
      select: { productId: true },
    });
    return items.map((i) => i.productId);
  }

  /** Shape a WishlistCollection into the mobile API response. */
  private shapeCollection(
    c: { id: number; name: string; isDefault: boolean; createdAt: Date },
    productIds: number[]
  ) {
    return {
      id: c.id,
      name: c.name,
      isDefault: c.isDefault,
      createdAt: c.createdAt.toISOString(),
      productIds,
    };
  }

  @Get('wishlist/collections')
  async listCollections(@Headers('authorization') auth: string) {
    const userId = this.decodeUserId(auth);
    await this.getOrCreateDefaultCollection(userId);
    const collections = await this.prisma.wishlistCollection.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    const shaped = await Promise.all(
      collections.map(async (c) => this.shapeCollection(c, await this.getProductIds(c.id)))
    );
    return shaped;
  }

  @Post('wishlist/collections')
  @HttpCode(HttpStatus.CREATED)
  async createCollection(@Headers('authorization') auth: string, @Body() body: { name: string }) {
    const userId = this.decodeUserId(auth);
    const name = body?.name?.trim();
    if (!name) throw new BadRequestException('name is required');
    try {
      const c = await this.prisma.wishlistCollection.upsert({
        where: { userId_name: { userId, name } },
        update: {},
        create: { userId, name, isDefault: false },
      });
      return this.shapeCollection(c, await this.getProductIds(c.id));
    } catch {
      throw new BadRequestException('Could not create collection');
    }
  }

  @Patch('wishlist/collections/:id')
  async renameCollection(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name: string }
  ) {
    const userId = this.decodeUserId(auth);
    const name = body?.name?.trim();
    if (!name) throw new BadRequestException('name is required');
    const existing = await this.prisma.wishlistCollection.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Collection not found');
    const updated = await this.prisma.wishlistCollection.update({
      where: { id },
      data: { name },
    });
    return this.shapeCollection(updated, await this.getProductIds(id));
  }

  @Delete('wishlist/collections/:id')
  @HttpCode(HttpStatus.OK)
  async deleteCollection(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number
  ) {
    const userId = this.decodeUserId(auth);
    const c = await this.prisma.wishlistCollection.findFirst({ where: { id, userId } });
    if (!c) throw new NotFoundException('Collection not found');
    if (c.isDefault) throw new BadRequestException('Cannot delete the default collection');
    await this.prisma.wishlistCollection.delete({ where: { id } });
    return { ok: true };
  }

  @Post('wishlist/collections/:id/items')
  @HttpCode(HttpStatus.OK)
  async addItemToCollection(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) collectionId: number,
    @Body() body: { productId: number }
  ) {
    const userId = this.decodeUserId(auth);
    if (!body?.productId || !Number.isInteger(body.productId) || body.productId <= 0)
      throw new BadRequestException('productId (positive integer) required');
    const c = await this.prisma.wishlistCollection.findFirst({
      where: { id: collectionId, userId },
    });
    if (!c) throw new NotFoundException('Collection not found');
    // Verify the product exists
    const product = await this.prisma.product.findUnique({ where: { id: body.productId } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.wishlistCollectionProduct.upsert({
      where: { collectionId_productId: { collectionId, productId: body.productId } },
      update: {},
      create: { collectionId, productId: body.productId },
    });
    return { ok: true };
  }

  @Delete('wishlist/collections/:id/items/:productId')
  @HttpCode(HttpStatus.OK)
  async removeItemFromCollection(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) collectionId: number,
    @Param('productId', ParseIntPipe) productId: number
  ) {
    const userId = this.decodeUserId(auth);
    const c = await this.prisma.wishlistCollection.findFirst({
      where: { id: collectionId, userId },
    });
    if (!c) throw new NotFoundException('Collection not found');
    await this.prisma.wishlistCollectionProduct.deleteMany({
      where: { collectionId, productId },
    });
    return { ok: true };
  }

  // Legacy flat wishlist endpoints — kept for backwards compatibility
  @Get('wishlist')
  async getWishlist(@Headers('authorization') auth: string) {
    const userId = this.decodeUserId(auth);
    await this.getOrCreateDefaultCollection(userId);
    const def = await this.prisma.wishlistCollection.findFirst({
      where: { userId, isDefault: true },
    });
    const ids = def ? await this.getProductIds(def.id) : [];
    if (ids.length === 0) return [];
    return this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        category: true,
        description: true,
        inStock: true,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Addresses (stub - returns empty list, create is accepted but not persisted)
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('addresses')
  getAddresses(@Headers('authorization') auth: string) {
    this.decodeUserId(auth);
    return [];
  }

  @Post('addresses')
  @HttpCode(HttpStatus.CREATED)
  createAddress(@Headers('authorization') auth: string, @Body() body: any) {
    const userId = this.decodeUserId(auth);
    return { id: Date.now(), ...body, isDefault: false };
  }

  @Patch('addresses/:id')
  updateAddress(
    @Headers('authorization') auth: string,
    @Param('id') id: string,
    @Body() body: any
  ) {
    this.decodeUserId(auth);
    return { id: Number(id), ...body };
  }

  @Delete('addresses/:id')
  @HttpCode(HttpStatus.OK)
  deleteAddress(@Headers('authorization') auth: string, @Param('id') id: string) {
    this.decodeUserId(auth);
    return { ok: true };
  }

  @Patch('addresses/:id/default')
  @HttpCode(HttpStatus.OK)
  setDefaultAddress(@Headers('authorization') auth: string, @Param('id') id: string) {
    this.decodeUserId(auth);
    return { ok: true };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Notifications (stub)
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('notifications')
  getNotifications(@Headers('authorization') auth: string) {
    this.decodeUserId(auth);
    return { items: [], total: 0 };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Recommendations (stub — returns featured products)
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('recommendations')
  async getRecommendations(@Headers('authorization') auth: string) {
    this.decodeUserId(auth);
    try {
      const products = await this.prisma.product.findMany({
        where: { featured: true },
        take: 10,
        select: { id: true, name: true, price: true, imageUrl: true, category: true },
      });
      return { items: products, total: products.length };
    } catch {
      return { items: [], total: 0 };
    }
  }
}
