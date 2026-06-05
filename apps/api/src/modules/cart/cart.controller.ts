import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CartService } from './cart.service';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get(':userId')
  getCart(@Param('userId') userId: string) {
    return this.cartService.getCart(parseInt(userId));
  }

  @Post(':userId/add')
  addItem(@Param('userId') userId: string, @Body() item: any) {
    return this.cartService.addItem(parseInt(userId), item);
  }
}
