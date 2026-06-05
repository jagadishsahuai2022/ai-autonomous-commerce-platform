import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  NotFoundException,
  ParseIntPipe,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CartService } from '../cart/cart.service';

function decodeUserId(authorization: string | undefined): number {
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

@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly cartService: CartService
  ) {}

  /** Web/admin: list orders for an explicit userId (no auth token required) */
  @Get('user/:userId')
  getUserOrders(@Param('userId') userId: string) {
    return this.orderService.getUserOrders(parseInt(userId));
  }

  /** Mobile: list authenticated user's orders */
  @Get()
  getMyOrders(@Headers('authorization') auth: string) {
    const userId = decodeUserId(auth);
    const result = this.orderService.getUserOrders(userId) as any;
    return result?.orders ?? result ?? [];
  }

  /** Mobile: get a single order by ID */
  @Get(':id')
  getOrder(@Headers('authorization') auth: string, @Param('id', ParseIntPipe) id: number) {
    decodeUserId(auth);
    const allOrders = (this.orderService as any).orders as any[];
    const order = allOrders?.find((o: any) => o.id === id);
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  /** Mobile/Web: checkout — builds order from the user's current cart */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Headers('authorization') auth: string,
    @Body() body: { addressId?: number; address?: string; paymentMethod?: string }
  ) {
    const userId = decodeUserId(auth);
    const cartResult = this.cartService.getCart(userId) as any;
    const cart = cartResult?.cart ?? cartResult;
    const items: any[] = cart?.items ?? [];
    const total =
      cart?.total ?? items.reduce((s: number, i: any) => s + (i.price ?? 0) * (i.quantity ?? 1), 0);

    const result = (await this.orderService.createOrder({
      userId,
      items,
      total,
      address: body.address ?? '',
      addressId: body.addressId,
      paymentMethod: body.paymentMethod ?? 'COD',
    })) as any;

    // Clear cart after successful checkout
    if (cart) {
      cart.items = [];
      cart.total = 0;
    }

    return result?.order ?? result;
  }

  /** Cancel an order */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelOrder(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() _body: { reason?: string }
  ) {
    decodeUserId(auth);
    return this.orderService.updateOrderStatus(id, 'cancelled');
  }

  /** Request a return */
  @Post(':id/returns')
  @HttpCode(HttpStatus.OK)
  requestReturn(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() _body: { reason?: string }
  ) {
    decodeUserId(auth);
    return this.orderService.updateOrderStatus(id, 'return_requested');
  }
}
