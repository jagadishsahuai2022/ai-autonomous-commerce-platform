/**
 * Buy Request Controller
 * REST API endpoints for buy request operations
 */

import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { BuyRequestService } from './buy-request.service';
import { LoggerService } from '../../common/logger.service';
import {
  CreateBuyRequestDto,
  UpdateBuyRequestDto,
  BuyRequestResponseDto,
  BuyRequestListResponseDto,
  SingleBuyRequestResponseDto,
  CreateBuyRequestResponseDto,
} from './dto/buy-request.dto';

@Controller('buy-request')
export class BuyRequestController {
  private readonly logger = new Logger('BuyRequestController');

  constructor(
    private buyRequestService: BuyRequestService,
    private appLogger: LoggerService
  ) {}

  /**
   * POST /buy-request
   * Create a new buy request
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateBuyRequestDto,
    @Request() req: any
  ): Promise<CreateBuyRequestResponseDto> {
    try {
      // Get userId from auth context (JWT payload)
      // In production, this would come from @UseGuards(JwtAuthGuard)
      const userId = req.userId || 1; // Default to 1 for demo

      this.appLogger.debug('Creating buy request', {
        userId,
        productName: dto.productName,
      });

      const data = await this.buyRequestService.create(userId, dto);

      return {
        success: true,
        data,
        message: 'Buy request created successfully',
      };
    } catch (error) {
      this.logger.error('Error creating buy request:', (error as any).message);
      return {
        success: false,
        error: (error as any).message || 'Failed to create buy request',
      };
    }
  }

  /**
   * GET /buy-request/:id
   * Get single buy request by ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findById(
    @Param('id') id: string,
    @Request() req: any
  ): Promise<SingleBuyRequestResponseDto> {
    try {
      const userId = req.userId || 1;
      const buyRequestId = parseInt(id, 10);

      if (isNaN(buyRequestId)) {
        return {
          success: false,
          error: 'Invalid buy request ID',
        };
      }

      this.appLogger.debug('Fetching buy request', {
        buyRequestId,
        userId,
      });

      const data = await this.buyRequestService.findById(buyRequestId, userId);

      return {
        success: true,
        data,
      };
    } catch (error) {
      this.logger.error('Error fetching buy request:', (error as any).message);
      const statusCode = (error as any).status || HttpStatus.INTERNAL_SERVER_ERROR;
      if (statusCode === HttpStatus.NOT_FOUND) {
        return {
          success: false,
          error: 'Buy request not found',
        };
      }
      if (statusCode === HttpStatus.FORBIDDEN) {
        return {
          success: false,
          error: 'Unauthorized access to this buy request',
        };
      }
      return {
        success: false,
        error: (error as any).message || 'Failed to fetch buy request',
      };
    }
  }

  /**
   * GET /buy-request
   * List all buy requests for authenticated user
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('status') status?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Request() req?: any
  ): Promise<BuyRequestListResponseDto> {
    try {
      const userId = req?.userId || 1;
      const skipNum = skip ? Math.max(0, parseInt(skip, 10)) : 0;
      const takeNum = take ? Math.min(Math.max(1, parseInt(take, 10)), 100) : 10;

      this.appLogger.debug('Listing buy requests', {
        userId,
        status,
        skip: skipNum,
        take: takeNum,
      });

      const { requests, total } = await this.buyRequestService.findAll(userId, {
        status,
        skip: skipNum,
        take: takeNum,
      });

      return {
        success: true,
        data: requests,
        count: total,
      };
    } catch (error) {
      this.logger.error('Error listing buy requests:', (error as any).message);
      return {
        success: false,
        data: [],
        count: 0,
        error: (error as any).message || 'Failed to list buy requests',
      };
    }
  }

  /**
   * PATCH /buy-request/:id
   * Update buy request
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBuyRequestDto,
    @Request() req: any
  ): Promise<SingleBuyRequestResponseDto> {
    try {
      const userId = req?.userId || 1;
      const buyRequestId = parseInt(id, 10);

      if (isNaN(buyRequestId)) {
        return {
          success: false,
          error: 'Invalid buy request ID',
        };
      }

      this.appLogger.debug('Updating buy request', {
        buyRequestId,
        userId,
      });

      const data = await this.buyRequestService.update(buyRequestId, userId, dto);

      return {
        success: true,
        data,
      };
    } catch (error) {
      this.logger.error('Error updating buy request:', (error as any).message);
      const statusCode = (error as any).status;
      if (statusCode === HttpStatus.NOT_FOUND) {
        return {
          success: false,
          error: 'Buy request not found',
        };
      }
      if (statusCode === HttpStatus.FORBIDDEN) {
        return {
          success: false,
          error: 'Unauthorized access to this buy request',
        };
      }
      return {
        success: false,
        error: (error as any).message || 'Failed to update buy request',
      };
    }
  }

  /**
   * DELETE /buy-request/:id
   * Cancel buy request
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @Request() req: any): Promise<SingleBuyRequestResponseDto> {
    try {
      const userId = req?.userId || 1;
      const buyRequestId = parseInt(id, 10);

      if (isNaN(buyRequestId)) {
        return {
          success: false,
          error: 'Invalid buy request ID',
        };
      }

      this.appLogger.debug('Cancelling buy request', {
        buyRequestId,
        userId,
      });

      const data = await this.buyRequestService.cancel(buyRequestId, userId);

      return {
        success: true,
        data,
      };
    } catch (error) {
      this.logger.error('Error cancelling buy request:', (error as any).message);
      const statusCode = (error as any).status;
      if (statusCode === HttpStatus.NOT_FOUND) {
        return {
          success: false,
          error: 'Buy request not found',
        };
      }
      if (statusCode === HttpStatus.FORBIDDEN) {
        return {
          success: false,
          error: 'Unauthorized access to this buy request',
        };
      }
      return {
        success: false,
        error: (error as any).message || 'Failed to cancel buy request',
      };
    }
  }
}
