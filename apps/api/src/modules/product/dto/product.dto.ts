import { IsString, IsNumber, IsOptional, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsString()
  description?: string;

  @IsNumber()
  price: number;

  @IsString()
  category: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  category?: string;
}

export class ProductResponseDto {
  id: number;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  discountPct?: number;
  category: string;
  brand?: string;
  image?: string;    // legacy alias — populated from imageUrl by the service
  imageUrl?: string; // actual DB column (Prisma Product.imageUrl)
  rating?: number;
  reviewCount?: number;
  stock?: number;
  inStock?: boolean;
  delivery?: { daysMin: number; daysMax: number; free: boolean };
  codAvailable?: boolean;
  hasEMI?: boolean;
  createdAt: Date;
}

export class ProductListResponseDto {
  products: ProductResponseDto[];
  total: number;
  skip: number;
  take: number;
}

export class CategoryResponseDto {
  name: string;
  count: number;
}
