/**
 * AI Execution Agent Controller
 * REST endpoints for order execution management
 */

import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';
import { AiExecutionAgentService } from './ai-execution-agent.service';
import {
  ExecuteOrderDto,
  ValidateExecutionDto,
  ApproveOrderDto,
  ExecutionRequestResponseDto,
  ValidationResultDto,
  ApprovalResponseDto,
  ExecutionStatsDto,
} from './dto/execution.dto';

@ApiTags('AI Execution Agent')
@Controller('execution')
@UseGuards(JwtGuard)
@ApiBearerAuth('access-token')
export class AiExecutionAgentController {
  constructor(private readonly executionService: AiExecutionAgentService) {}

  /**
   * Execute order with AI Agent
   * Supports 3 modes: suggestion, approval, autonomous
   *
   * @example
   * {
   *   "productIds": [1, 2, 3],
   *   "mode": "autonomous",
   *   "intent": {
   *     "category": "electronics",
   *     "budget": { "min": 5000, "max": 50000 },
   *     "preferences": ["best-rating", "fast-delivery"]
   *   },
   *   "maxProducts": 1,
   *   "metadata": {
   *     "sessionId": "chat-123",
   *     "userQuery": "Find me a good laptop under 50k"
   *   }
   * }
   */
  @Post('execute')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Execute order placement',
    description:
      'Place an order using AI agent with specified mode (suggestion, approval, or autonomous)',
  })
  @ApiResponse({
    status: 201,
    description: 'Execution request created successfully',
    type: ExecutionRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or execution validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async executeOrder(
    @User() user: any,
    @Body() executeDto: ExecuteOrderDto
  ): Promise<ExecutionRequestResponseDto> {
    if (!user?.id) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.executionService.executeOrder(user.id, executeDto);
  }

  /**
   * Validate if execution is possible
   * Check wallet balance, limits, AI authorization
   *
   * @example
   * {
   *   "productId": 1,
   *   "amount": 25000,
   *   "isAiAuthorized": true
   * }
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate execution possibility',
    description: 'Check if order execution is possible given wallet limits and AI authorization',
  })
  @ApiResponse({
    status: 200,
    description: 'Validation result',
    type: ValidationResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request',
  })
  async validateExecution(
    @User() user: any,
    @Body() validationDto: ValidateExecutionDto
  ): Promise<ValidationResultDto> {
    if (!user?.id) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.executionService.validateExecution(user.id, validationDto.productId, validationDto);
  }

  /**
   * Approve a pending execution request
   * Used in 'approval' mode when user approves/rejects the AI suggestion
   *
   * @example
   * {
   *   "executionRequestId": "exec-1234567890-abc123def",
   *   "approved": true
   * }
   *
   * @example
   * {
   *   "executionRequestId": "exec-1234567890-abc123def",
   *   "approved": false,
   *   "rejectionReason": "Product is out of stock"
   * }
   */
  @Post('approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve or reject execution request',
    description: 'Approve pending execution request (in approval mode) or reject it with reason',
  })
  @ApiResponse({
    status: 200,
    description: 'Approval decision processed',
    type: ApprovalResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or request expired',
  })
  @ApiResponse({
    status: 404,
    description: 'Execution request not found',
  })
  async approveExecution(
    @User() user: any,
    @Body() approveDto: ApproveOrderDto
  ): Promise<ApprovalResponseDto> {
    if (!user?.id) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.executionService.approveExecution(user.id, approveDto);
  }

  /**
   * Get execution statistics for user
   * Returns aggregated data on purchases made by AI agent
   *
   * Statistics include:
   * - Total execution requests
   * - Successful purchases
   * - Failed attempts
   * - Success rate percentage
   * - Total amount spent
   * - Average order value
   * - Average retry count
   *
   * @example response
   * {
   *   "totalRequests": 15,
   *   "successfulPurchases": 12,
   *   "failedAttempts": 3,
   *   "suggestionsProvided": 5,
   *   "totalSpent": 450000,
   *   "averageOrderValue": 37500,
   *   "successRate": 80,
   *   "averageRetries": 0.5
   * }
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get AI execution statistics',
    description: 'Retrieve aggregated statistics for AI-triggered purchases and suggestions',
  })
  @ApiResponse({
    status: 200,
    description: 'Execution statistics',
    type: ExecutionStatsDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getExecutionStats(@User() user: any): Promise<ExecutionStatsDto> {
    if (!user?.id) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.executionService.getExecutionStats(user.id);
  }
}
