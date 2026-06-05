/**
 * Data Transfer Objects (DTOs)
 * Type definitions for API requests and database operations
 */

import {
  IsString,
  IsNumber,
  IsArray,
  IsObject,
  IsOptional,
  IsEnum,
  Min,
  Max,
} from 'class-validator';

// Create Rule DTO
export class CreateRuleDto {
  @IsString()
  userId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  conditions: Array<{
    field: string;
    operator: string;
    value: any;
  }>;

  @IsObject()
  action: {
    type: string;
    parameters: Record<string, any>;
  };

  @IsNumber()
  @Min(0)
  maxSpendPerMonth: number;

  @IsNumber()
  @Min(0)
  maxOrderValue: number;
}

// Update Rule DTO
export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  conditions?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;

  @IsOptional()
  @IsObject()
  action?: {
    type: string;
    parameters: Record<string, any>;
  };

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSpendPerMonth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxOrderValue?: number;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'paused'])
  status?: string;
}

// Create Decision DTO
export class CreateDecisionDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  ruleId?: string;

  @IsString()
  productId: string;

  @IsObject()
  product: {
    id: string;
    name: string;
    price: number;
    category: string;
    brand: string;
    rating: number;
    stock: number;
    imageUrl: string;
  };

  @IsObject()
  userHistory: {
    userId: string;
    totalPurchases: number;
    totalSpent: number;
    returnRate: number;
    averageRating: number;
    purchasesByCategory?: Record<string, number>;
    lastPurchaseDate?: Date;
  };

  @IsNumber()
  @Min(0)
  @Max(1)
  minimumConfidenceThreshold: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rankingScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  intentScore?: number;

  @IsOptional()
  @IsObject()
  marketContext?: Record<string, any>;
}

// Approve Decision DTO
export class ApproveDecisionDto {
  @IsString()
  decisionId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// Reject Decision DTO
export class RejectDecisionDto {
  @IsString()
  decisionId: string;

  @IsString()
  reason: string;
}

// Create Approval Request DTO
export class CreateApprovalRequestDto {
  @IsString()
  userId: string;

  @IsString()
  decisionId: string;

  @IsString()
  reason: string;
}

// Query Params DTO
export class PaginationQueryDto {
  @IsOptional()
  @IsNumber()
  skip?: number;

  @IsOptional()
  @IsNumber()
  take?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
