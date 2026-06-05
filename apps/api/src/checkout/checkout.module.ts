import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import { AddressModule } from '../addresses/address.module';
import { CartModule } from '../modules/cart/cart.module';
import { OrderModule } from '../modules/order/order.module';
import { ProductModule } from '../modules/product/product.module';

@Module({
  imports: [AddressModule, CartModule, OrderModule, ProductModule],
  providers: [CheckoutService],
  controllers: [CheckoutController],
  exports: [CheckoutService],
})
export class CheckoutModule {}
