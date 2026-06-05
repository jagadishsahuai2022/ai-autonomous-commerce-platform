import { Controller, Get, Param, Query, HttpCode, HttpStatus, Header } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductResponseDto, ProductListResponseDto, CategoryResponseDto } from './dto/product.dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  /**
   * GET /categories — distinct categories with product counts (cached).
   * Must be declared BEFORE ":id" to avoid route shadowing.
   */
  @Get('categories')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  async getCategories(): Promise<CategoryResponseDto[]> {
    return this.productService.getCategories();
  }

  /**
   * Get all products with pagination + server-side filters.
   * Supports: skip, take, search, category, minPrice, maxPrice, minRating,
   *           minDiscount, freeDelivery, expressDelivery, codAvailable, sortBy, brand
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('brand') brand?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('minRating') minRating?: string,
    @Query('minDiscount') minDiscount?: string,
    @Query('freeDelivery') freeDelivery?: string,
    @Query('expressDelivery') expressDelivery?: string,
    @Query('codAvailable') codAvailable?: string,
    @Query('sortBy') sortBy?: string
  ): Promise<ProductListResponseDto> {
    const skipNum = Math.max(0, parseInt(skip ?? '0', 10) || 0);
    const takeNum = Math.min(Math.max(1, parseInt(take ?? '20', 10) || 20), 100);

    const trimmedSearch = search?.trim() || undefined;
    const trimmedBrand = brand?.trim() || undefined;

    const hasFilters = !!(
      trimmedSearch ||
      category ||
      trimmedBrand ||
      minPrice ||
      maxPrice ||
      minRating ||
      minDiscount ||
      freeDelivery ||
      expressDelivery ||
      codAvailable ||
      (sortBy && sortBy !== 'relevance')
    );

    if (hasFilters) {
      return this.productService.findWithFilters({
        skip: skipNum,
        take: takeNum,
        search: trimmedSearch,
        category: category?.trim() || undefined,
        brand: trimmedBrand,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        minRating: minRating ? parseFloat(minRating) : undefined,
        minDiscount: minDiscount ? parseFloat(minDiscount) : undefined,
        freeDelivery: freeDelivery === 'true' || undefined,
        expressDelivery: expressDelivery === 'true' || undefined,
        codAvailable: codAvailable === 'true' || undefined,
        sortBy: sortBy || 'relevance',
      });
    }

    return this.productService.findAll(skipNum, takeNum);
  }

  /**
   * Get featured products with limit — aggressively cached
   */
  @Get('featured')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'public, max-age=120, stale-while-revalidate=600')
  async findFeatured(@Query('limit') limit?: string): Promise<ProductResponseDto[]> {
    const limitNum = limit ? parseInt(limit, 10) : 12;
    const validatedLimit = Math.min(Math.max(1, isNaN(limitNum) ? 12 : limitNum), 100);

    return this.productService.findFeatured(validatedLimit);
  }

  /**
   * Get products by category — cached per-category
   */
  @Get('category/:category')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'public, max-age=90, stale-while-revalidate=450')
  async findByCategory(@Param('category') category: string): Promise<ProductResponseDto[]> {
    return this.productService.findByCategory(category);
  }

  /**
   * Get single product by ID with caching
   * Optional userId query parameter for tracking product views
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=900')
  async findOne(
    @Param('id') id: string,
    @Query('userId') userId?: string
  ): Promise<ProductResponseDto> {
    const productId = parseInt(id, 10);
    const parsedUserId = userId ? parseInt(userId, 10) : undefined;

    return this.productService.findOne(productId, parsedUserId);
  }
}
