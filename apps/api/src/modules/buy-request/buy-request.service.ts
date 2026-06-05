/**
 * Buy Request Service
 * Business logic for managing buy requests
 */

import { Injectable, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { LoggerService } from '../../common/logger.service';
import {
  CreateBuyRequestDto,
  UpdateBuyRequestDto,
  BuyRequestResponseDto,
} from './dto/buy-request.dto';

@Injectable()
export class BuyRequestService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService
  ) {}

  /**
   * Create a new buy request
   */
  async create(userId: number, dto: CreateBuyRequestDto): Promise<BuyRequestResponseDto> {
    try {
      // Validations
      this.validateBudget(dto.budgetMin, dto.budgetMax);
      this.validateExecutionSettings(dto.autoExecute, dto.notifyChannels);

      this.logger.debug('Creating buy request', {
        userId,
        productName: dto.productName,
      });

      const buyRequest = await this.prisma.buyRequest.create({
        data: {
          userId,
          productName: dto.productName,
          description: dto.description,
          budgetMin: dto.budgetMin,
          budgetMax: dto.budgetMax,
          qualityScore: dto.qualityScore,
          preferredBrands: dto.preferredBrands ? JSON.stringify(dto.preferredBrands) : null,
          deliveryDate: new Date(dto.deliveryDate),
          autoExecute: dto.autoExecute ?? false,
          notifyChannels: dto.notifyChannels ? JSON.stringify(dto.notifyChannels) : null,
          status: 'pending',
        },
      });

      this.logger.log('Buy request created successfully', {
        buyRequestId: buyRequest.id,
        userId,
      });

      return this.mapToResponseDto(buyRequest);
    } catch (error) {
      this.logger.error('Error creating buy request', undefined, {
        error: (error as any).message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get single buy request by ID
   */
  async findById(id: number, userId: number): Promise<BuyRequestResponseDto> {
    try {
      const buyRequest = await this.prisma.buyRequest.findUnique({
        where: { id },
      });

      if (!buyRequest) {
        throw new HttpException('Buy request not found', HttpStatus.NOT_FOUND);
      }

      // Ensure user can only access their own requests
      if (buyRequest.userId !== userId) {
        throw new HttpException('Unauthorized access to this buy request', HttpStatus.FORBIDDEN);
      }

      this.logger.debug('Buy request retrieved', { buyRequestId: id, userId });
      return this.mapToResponseDto(buyRequest);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Error fetching buy request', undefined, {
        error: (error as any).message,
        id,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get all buy requests for a user
   */
  async findAll(
    userId: number,
    filters?: {
      status?: string;
      skip?: number;
      take?: number;
    }
  ): Promise<{ requests: BuyRequestResponseDto[]; total: number }> {
    try {
      const skip = filters?.skip ?? 0;
      const take = Math.min(filters?.take ?? 10, 100); // Max 100 per request

      const where: any = { userId };
      if (filters?.status) {
        where.status = filters.status;
      }

      const [buyRequests, total] = await Promise.all([
        this.prisma.buyRequest.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.buyRequest.count({ where }),
      ]);

      this.logger.debug('Buy requests retrieved', {
        userId,
        count: buyRequests.length,
        total,
      });

      return {
        requests: buyRequests.map((br) => this.mapToResponseDto(br)),
        total,
      };
    } catch (error) {
      this.logger.error('Error fetching buy requests', undefined, {
        error: (error as any).message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update buy request
   */
  async update(
    id: number,
    userId: number,
    dto: UpdateBuyRequestDto
  ): Promise<BuyRequestResponseDto> {
    try {
      // Check if buy request exists and belongs to user
      const existing = await this.prisma.buyRequest.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new HttpException('Buy request not found', HttpStatus.NOT_FOUND);
      }

      if (existing.userId !== userId) {
        throw new HttpException('Unauthorized access to this buy request', HttpStatus.FORBIDDEN);
      }

      // Validations if budget changed
      if (dto.budgetMin !== undefined || dto.budgetMax !== undefined) {
        const budgetMin = dto.budgetMin ?? existing.budgetMin;
        const budgetMax = dto.budgetMax ?? existing.budgetMax;
        this.validateBudget(budgetMin, budgetMax);
      }

      // Validations if execution settings changed
      if (dto.autoExecute !== undefined || dto.notifyChannels !== undefined) {
        const autoExecute = dto.autoExecute ?? existing.autoExecute;
        const notifyChannels =
          dto.notifyChannels ??
          (existing.notifyChannels ? JSON.parse(existing.notifyChannels as string) : null);
        this.validateExecutionSettings(autoExecute, notifyChannels);
      }

      this.logger.debug('Updating buy request', {
        buyRequestId: id,
        userId,
      });

      const updated = await this.prisma.buyRequest.update({
        where: { id },
        data: {
          productName: dto.productName,
          description: dto.description,
          budgetMin: dto.budgetMin,
          budgetMax: dto.budgetMax,
          qualityScore: dto.qualityScore,
          preferredBrands: dto.preferredBrands ? JSON.stringify(dto.preferredBrands) : undefined,
          deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : undefined,
          autoExecute: dto.autoExecute,
          notifyChannels: dto.notifyChannels ? JSON.stringify(dto.notifyChannels) : undefined,
          status: dto.status,
        },
      });

      this.logger.log('Buy request updated successfully', {
        buyRequestId: id,
        userId,
      });

      return this.mapToResponseDto(updated);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Error updating buy request', undefined, {
        error: (error as any).message,
        id,
        userId,
      });
      throw error;
    }
  }

  /**
   * Cancel buy request (soft delete)
   */
  async cancel(id: number, userId: number): Promise<BuyRequestResponseDto> {
    try {
      const existing = await this.prisma.buyRequest.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new HttpException('Buy request not found', HttpStatus.NOT_FOUND);
      }

      if (existing.userId !== userId) {
        throw new HttpException('Unauthorized access to this buy request', HttpStatus.FORBIDDEN);
      }

      this.logger.debug('Cancelling buy request', {
        buyRequestId: id,
        userId,
      });

      const cancelled = await this.prisma.buyRequest.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      this.logger.log('Buy request cancelled', {
        buyRequestId: id,
        userId,
      });

      return this.mapToResponseDto(cancelled);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Error cancelling buy request', undefined, {
        error: (error as any).message,
        id,
        userId,
      });
      throw error;
    }
  }

  /**
   * Validate budget constraints
   */
  private validateBudget(min: number, max: number): void {
    if (min < 0 || max < 0) {
      throw new BadRequestException('Budget values must be non-negative');
    }
    if (min > max) {
      throw new BadRequestException('Budget minimum cannot exceed budget maximum');
    }
  }

  /**
   * Validate execution settings: either autoExecute OR notifyChannels required
   */
  private validateExecutionSettings(autoExecute?: boolean, notifyChannels?: string[]): void {
    const hasAutoExecute = autoExecute === true;
    const hasNotifyChannels = Array.isArray(notifyChannels) && notifyChannels.length > 0;

    if (!hasAutoExecute && !hasNotifyChannels) {
      throw new BadRequestException(
        'Either autoExecute must be true or notifyChannels must have at least one channel'
      );
    }

    // Validate notify channels if provided
    if (notifyChannels) {
      const validChannels = ['email', 'whatsapp', 'sms', 'push'];
      const invalidChannels = notifyChannels.filter(
        (channel) => !validChannels.includes(channel.toLowerCase())
      );
      if (invalidChannels.length > 0) {
        throw new BadRequestException(
          `Invalid notify channels: ${invalidChannels.join(', ')}. Valid channels: ${validChannels.join(', ')}`
        );
      }
    }
  }

  /**
   * Map database model to response DTO
   */
  private mapToResponseDto(buyRequest: any): BuyRequestResponseDto {
    return {
      id: buyRequest.id,
      userId: buyRequest.userId,
      productName: buyRequest.productName,
      description: buyRequest.description,
      budgetMin: buyRequest.budgetMin,
      budgetMax: buyRequest.budgetMax,
      qualityScore: buyRequest.qualityScore,
      preferredBrands: buyRequest.preferredBrands
        ? JSON.parse(buyRequest.preferredBrands)
        : undefined,
      deliveryDate: buyRequest.deliveryDate.toISOString(),
      autoExecute: buyRequest.autoExecute,
      notifyChannels: buyRequest.notifyChannels ? JSON.parse(buyRequest.notifyChannels) : undefined,
      status: buyRequest.status,
      matchedProducts: buyRequest.matchedProducts
        ? JSON.parse(buyRequest.matchedProducts)
        : undefined,
      createdAt: buyRequest.createdAt.toISOString(),
      updatedAt: buyRequest.updatedAt.toISOString(),
    };
  }
}
