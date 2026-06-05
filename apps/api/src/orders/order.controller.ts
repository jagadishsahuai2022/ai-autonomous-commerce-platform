import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { CreateOrderDto, UpdateOrderStatusDto } from './order.dto';

@Controller('orders')
export class OrderController {
  constructor() {
    // DEPRECATED: Use modules/order/order.controller instead
  }

  private throwDeprecated(): never {
    throw new BadRequestException(
      'This controller is deprecated. Use modules/order/order.controller instead.'
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req, @Body() createOrderDto: CreateOrderDto): Promise<any> {
    return this.throwDeprecated();
  }

  @Get()
  async findAll(
    @Req() req,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number
  ) {
    return this.throwDeprecated();
  }

  @Get(':id')
  async findOne(@Req() req, @Param('id') id: string) {
    return this.throwDeprecated();
  }

  @Get('number/:orderNumber')
  async findByOrderNumber(@Req() req, @Param('orderNumber') orderNumber: string) {
    return this.throwDeprecated();
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() req,
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto
  ) {
    return this.throwDeprecated();
  }

  @Patch(':id/cancel')
  async cancelOrder(@Req() req, @Param('id') id: string) {
    return this.throwDeprecated();
  }

  @Get(':id/tracking')
  async getTracking(@Req() req, @Param('id') id: string) {
    return this.throwDeprecated();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Req() req, @Param('id') id: string) {
    return this.throwDeprecated();
  }
}
