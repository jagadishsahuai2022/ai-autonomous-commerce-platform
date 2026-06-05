import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
// import { AddressService } from './address.service'; // TODO: Use modules service
import { CreateAddressDto, UpdateAddressDto, AddressResponseDto } from './address.dto';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // TODO: Create auth guard

/**
 * DEPRECATED: This controller is no longer used.
 * Use Prisma services from modules instead.
 */
@Controller('addresses')
// @UseGuards(JwtAuthGuard) // TODO: Add auth guard
export class AddressController {
  constructor() {
    // Stub - no dependencies
  }

  @Post()
  async create(
    @Req() req: any,
    @Body() createAddressDto: CreateAddressDto
  ): Promise<AddressResponseDto> {
    throw new Error('AddressController.create - Not implemented, use Prisma service');
  }

  @Get()
  async findAll(@Req() req: any): Promise<AddressResponseDto[]> {
    throw new Error('AddressController.findAll - Not implemented, use Prisma service');
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any): Promise<AddressResponseDto> {
    throw new Error('AddressController.findOne - Not implemented, use Prisma service');
  }

  @Get('user/default')
  async findDefault(@Req() req: any): Promise<AddressResponseDto> {
    throw new Error('AddressController.findDefault - Not implemented, use Prisma service');
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateAddressDto: UpdateAddressDto
  ): Promise<AddressResponseDto> {
    throw new Error('AddressController.update - Not implemented, use Prisma service');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Req() req: any): Promise<void> {
    throw new Error('AddressController.delete - Not implemented, use Prisma service');
  }

  @Post(':id/default')
  async setDefault(@Param('id') id: string, @Req() req: any): Promise<AddressResponseDto> {
    throw new Error('AddressController.setDefault - Not implemented, use Prisma service');
  }
}
