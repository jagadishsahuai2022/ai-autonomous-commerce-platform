/**
 * Buy Request DTOs
 * Data transfer objects with validation for buy request operations
 */

import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  IsDateString,
  Min,
  Max,
  ValidateIf,
  ArrayNotEmpty,
  MinLength,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
} from 'class-validator';

/**
 * Custom validator: Either autoExecute OR notifyChannels must be present
 */
@ValidatorConstraint({ name: 'exeOrNotify', async: false })
export class ExecuteOrNotifyConstraint {
  validate(obj: any, args: ValidationArguments) {
    const { autoExecute, notifyChannels } = obj as any;
    if (typeof autoExecute === 'boolean' && notifyChannels) {
      return autoExecute || (Array.isArray(notifyChannels) && notifyChannels.length > 0);
    }
    return true;
  }

  defaultMessage() {
    return 'Either autoExecute must be true OR notifyChannels must have at least one channel';
  }
}

/**
 * CREATE Buy Request DTO
 */
export class CreateBuyRequestDto {
  @IsString()
  @MinLength(3, { message: 'Product name must be at least 3 characters' })
  @MaxLength(200, { message: 'Product name must not exceed 200 characters' })
  productName: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsNumber()
  @Min(0, { message: 'Budget min must be at least 0' })
  budgetMin: number;

  @IsNumber()
  @Min(0, { message: 'Budget max must be at least 0' })
  budgetMax: number;

  @IsNumber()
  @Min(1, { message: 'Quality score must be between 1 and 10' })
  @Max(10, { message: 'Quality score must be between 1 and 10' })
  qualityScore: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'Preferred brands array cannot be empty if provided' })
  @IsString({ each: true })
  preferredBrands?: string[];

  @IsDateString()
  deliveryDate: string;

  @IsBoolean()
  @IsOptional()
  autoExecute?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'Notify channels array cannot be empty if provided' })
  @IsString({ each: true })
  notifyChannels?: string[];
}

/**
 * UPDATE Buy Request DTO (partial)
 */
export class UpdateBuyRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  productName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  qualityScore?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredBrands?: string[];

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsBoolean()
  autoExecute?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notifyChannels?: string[];

  @IsOptional()
  @IsString()
  status?: string; // "pending", "matched", "purchased", "cancelled"
}

/**
 * Buy Request Response DTO
 */
export class BuyRequestResponseDto {
  id: number;
  userId: number;
  productName: string;
  description?: string;
  budgetMin: number;
  budgetMax: number;
  qualityScore: number;
  preferredBrands?: string[];
  deliveryDate: string;
  autoExecute: boolean;
  notifyChannels?: string[];
  status: string;
  matchedProducts?: any;
  createdAt: string;
  updatedAt: string;
}

/**
 * Buy Request List Response DTO
 */
export class BuyRequestListResponseDto {
  success: boolean;
  data: BuyRequestResponseDto[];
  count: number;
  error?: string;
}

/**
 * Single Buy Request Response DTO
 */
export class SingleBuyRequestResponseDto {
  success: boolean;
  data?: BuyRequestResponseDto;
  error?: string;
}

/**
 * Create Buy Request Response DTO
 */
export class CreateBuyRequestResponseDto {
  success: boolean;
  data?: BuyRequestResponseDto;
  error?: string;
  message?: string;
}
