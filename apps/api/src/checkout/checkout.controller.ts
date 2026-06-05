import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { ValidateCheckoutDto, CreateOrderDto, CheckoutPreviewDto } from './checkout.dto';
import { JwtGuard } from '../common/guards/jwt.guard';

@Controller('checkout')
@UseGuards(JwtGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  /**
   * Validate checkout data
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validate(@Req() req: any, @Body() validateCheckoutDto: ValidateCheckoutDto) {
    const result = await this.checkoutService.validateCheckout(req.user.id, validateCheckoutDto);
    return result;
  }

  /**
   * Generate checkout preview with pricing
   */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async preview(
    @Req() req: any,
    @Body() validateCheckoutDto: ValidateCheckoutDto
  ): Promise<CheckoutPreviewDto> {
    return this.checkoutService.generateCheckoutPreview(req.user.id, validateCheckoutDto);
  }

  /**
   * Create order from checkout
   */
  @Post('complete')
  @HttpCode(HttpStatus.CREATED)
  async complete(@Req() req: any, @Body() createOrderDto: CreateOrderDto) {
    return this.checkoutService.createOrderFromCheckout(req.user.id, createOrderDto);
  }
}
