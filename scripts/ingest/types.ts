/**
 * Data Ingestion Pipeline — Type Definitions
 * DelegateCart Production Catalog System
 */

export interface RawProduct {
  // CSV / JSON source fields (heterogeneous input names)
  product_name?: string;
  name?: string;
  title?: string;
  category?: string;
  sub_category?: string;
  subcategory?: string;
  price?: string | number;
  actual_price?: string | number;
  discounted_price?: string | number;
  selling_price?: string | number;
  retail_price?: string | number;
  image_url?: string;
  img_link?: string;
  image?: string;
  description?: string;
  about_product?: string;
  specifications?: string;
  rating?: string | number;
  rating_count?: string | number;
  no_of_ratings?: string | number;
  brand?: string;
  manufacturer?: string;
  asin?: string;
  product_id?: string;
  product_link?: string;
  [key: string]: unknown;
}

export interface NormalizedProduct {
  name: string;
  category: string;
  subcategory: string | null;
  price: number;
  originalPrice: number;
  image: string;
  description: string;
  brand: string;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  sku: string;
  specifications: Record<string, string>;
  source: 'kaggle' | 'amazon' | 'flipkart' | 'synthetic';
  sourceId: string | null;
}

export interface BusinessMetrics {
  productId: number;
  marginPercentage: number;
  inventoryCount: number;
  salesVelocity: number;
  conversionRate: number;
  returnRate: number;
}

export interface IngestionReport {
  source: string;
  totalInput: number;
  passed: number;
  rejected: number;
  duplicates: number;
  inserted: number;
  errors: string[];
  durationMs: number;
}

export interface IngestionOptions {
  batchSize: number; // rows per DB transaction (default: 1000)
  maxWorkers: number; // parallel batch workers (default: 5)
  dryRun: boolean; // validate without inserting
  skipDuplicates: boolean; // deduplicate by name+brand
  imageStrategy: 'use_source' | 'unsplash_fallback' | 'force_unsplash';
}
