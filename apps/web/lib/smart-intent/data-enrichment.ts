/**
 * Smart Intent Engine v2 — Data Enrichment & Normalization
 *
 * Phase 1: Provides category maps, budget buckets, feature criteria,
 * and runtime search index builder. No external API calls.
 */

import type { PriceBand, ProductSpecifications, SearchableProduct } from './types';

// ── Category Normalization Map ────────────────────────────────────────────────

/**
 * Maps user-facing category words to canonical internal names.
 * Canonical names align with SellerProduct.specifications.category.
 */
export const CATEGORY_ALIASES: Record<string, string> = {
  // Phone aliases
  phone: 'smartphone',
  mobile: 'smartphone',
  smartphone: 'smartphone',
  cellphone: 'smartphone',
  handset: 'smartphone',
  android: 'smartphone',
  iphone: 'smartphone',
  '5g phone': 'smartphone',
  // Laptop aliases
  laptop: 'laptop',
  notebook: 'laptop',
  chromebook: 'laptop',
  ultrabook: 'laptop',
  macbook: 'laptop',
  thinkpad: 'laptop',
  // Headphone aliases
  headphones: 'audio',
  earphones: 'audio',
  earbuds: 'audio',
  airpods: 'audio',
  headset: 'audio',
  tws: 'audio',
  neckband: 'audio',
  // TV aliases
  television: 'television',
  'smart tv': 'television',
  tv: 'television',
  // Appliance aliases
  'washing machine': 'appliances',
  refrigerator: 'appliances',
  fridge: 'appliances',
  'air conditioner': 'appliances',
  ac: 'appliances',
  microwave: 'appliances',
};

// ── Budget Buckets (Indian market, INR) ───────────────────────────────────────

export interface BudgetBucket {
  min: number;
  max: number;
  label: string;
  priceBand: PriceBand;
}

export const BUDGET_BUCKETS: BudgetBucket[] = [
  { min: 0, max: 10000, label: 'Ultra Budget (Under ₹10K)', priceBand: 'ultra_budget' },
  { min: 10000, max: 20000, label: 'Budget (₹10K–₹20K)', priceBand: 'budget' },
  { min: 20000, max: 40000, label: 'Mid-Range (₹20K–₹40K)', priceBand: 'midrange' },
  { min: 40000, max: 80000, label: 'Upper Mid-Range (₹40K–₹80K)', priceBand: 'upper_mid' },
  { min: 80000, max: Infinity, label: 'Premium (₹80K+)', priceBand: 'premium' },
];

/**
 * Get the price band label for a given price.
 */
export function getPriceBand(price: number): PriceBand {
  for (const bucket of BUDGET_BUCKETS) {
    if (price >= bucket.min && price < bucket.max) {
      return bucket.priceBand;
    }
  }
  return 'premium';
}

/**
 * Get the budget bucket boundaries for the given price band name.
 */
export function getBucketRange(band: PriceBand): { min: number; max: number } {
  return BUDGET_BUCKETS.find((b) => b.priceBand === band) || { min: 0, max: 200000 };
}

// ── Feature Mapping Criteria ──────────────────────────────────────────────────

/**
 * Maps feature intent (from user query) to attribute-based validation.
 * Returns true if the product attributes satisfy the feature.
 */
export const FEATURE_CRITERIA: Record<string, (attrs: Record<string, string>) => boolean> = {
  'good camera': (a) => {
    const mp = parseInt(a.camera?.match(/(\d+)MP/i)?.[1] || '0', 10);
    return mp >= 48;
  },
  camera: (a) => {
    const mp = parseInt(a.camera?.match(/(\d+)MP/i)?.[1] || '0', 10);
    return mp >= 48;
  },
  gaming: (a) => {
    const gpuOk =
      a.gpu?.toLowerCase().includes('rtx') ||
      a.gpu?.toLowerCase().includes('dedicated') ||
      a.gpu?.toLowerCase().includes('4060');
    const ramOk = parseInt(a.ram?.match(/(\d+)/)?.[1] || '0', 10) >= 8;
    return !!(gpuOk || ramOk);
  },
  battery: (a) => {
    const mah = parseInt(a.battery?.match(/(\d+)mAh/i)?.[1] || '0', 10);
    return mah >= 5000;
  },
  '5g': (a) => a.connectivity?.toLowerCase().includes('5g') || false,
  anc: (a) => {
    const v = (a.anc || a.noise || '').toLowerCase();
    return v.includes('noise cancell') || v.includes('anc');
  },
  fast_charging: (a) => {
    const w = parseInt(a.charging?.match(/(\d+)W/i)?.[1] || '0', 10);
    return w >= 33;
  },
  waterproof: (a) => !!a.waterproof,
  lightweight: (a) => {
    const kg = parseFloat(a.weight?.match(/([\d.]+)\s*kg/i)?.[1] || '999');
    return kg <= 1.4;
  },
  gpu: (a) => a.gpu?.toLowerCase().includes('rtx') || false,
  amoled: (a) =>
    a.display?.toLowerCase().includes('amoled') ||
    a.display?.toLowerCase().includes('oled') ||
    false,
};

// ── Data Normalization Rules ──────────────────────────────────────────────────

export const DATA_NORMALIZATION = {
  // Category mapping for query → canonical name
  categoryMap: CATEGORY_ALIASES,

  // Budget bucket thresholds
  budgetBuckets: BUDGET_BUCKETS,

  // Feature → attribute criteria
  featureCriteria: FEATURE_CRITERIA,

  // Use-case → typical feature requirements
  useCaseRequirements: {
    gaming: { minRam: 8, minGpu: 'dedicated', minRefreshRate: 120 },
    photography: { minCamera: 48, preferOIS: true },
    battery: { minMah: 5000 },
    student: { maxWeight: 1.8, minBattery: 8 },
    coding: { minRam: 16, preferSSD: true },
    travel: { maxWeight: 1.4, minBattery: 10 },
    office: { maxWeight: 1.6, minBattery: 8 },
    music: { preferANC: true },
    fitness: { preferIPX: 4 },
  } as Record<string, Record<string, number | boolean | string>>,
};

// ── Search Index Builder ──────────────────────────────────────────────────────

/**
 * Phase 3: Build a flat text search index from a product's fields.
 * This enables full-text search across name, brand, category, features, use-cases, and tags.
 *
 * Format: "name brand category subcategory ...tags ...features ...use_cases ...attr_values"
 */
export function buildSearchIndex(product: SearchableProduct): string {
  const parts: string[] = [
    product.name,
    product.brand,
    product.category,
    product.subCategory,
    CATEGORY_ALIASES[product.category] || product.category, // canonical name
  ];

  // Specifications enrichment
  const spec = product.specifications;
  if (spec) {
    if (spec.search_tags?.length) parts.push(...spec.search_tags);
    if (spec.features?.length) parts.push(...spec.features);
    if (spec.use_cases?.length) parts.push(...spec.use_cases);
    if (spec.price_band) parts.push(spec.price_band.replace('_', ' '));
  }

  // Attribute values (flat)
  for (const val of Object.values(product.attributes || {})) {
    if (val && val.length < 60) parts.push(val);
  }

  return parts.filter(Boolean).join(' ').toLowerCase();
}

// ── Enrichment Helper: derive use_cases from attributes ────────────────────

/**
 * Infer use-cases from product attributes.
 * Returns a list like ["gaming", "camera", "battery"].
 */
export function deriveUseCases(category: string, attrs: Record<string, string>): string[] {
  const uses: string[] = [];

  if (category === 'phone') {
    const mp = parseInt(attrs.camera?.match(/(\d+)MP/i)?.[1] || '0', 10);
    if (mp >= 48) uses.push('photography', 'camera');
    const mah = parseInt(attrs.battery?.match(/(\d+)mAh/i)?.[1] || '0', 10);
    if (mah >= 5000) uses.push('battery');
    if (attrs.connectivity?.includes('5G')) uses.push('5g');
    const w = parseInt(attrs.charging?.match(/(\d+)W/i)?.[1] || '0', 10);
    if (w >= 33) uses.push('fast_charging');
    if (
      attrs.display?.toLowerCase().includes('120hz') ||
      attrs.display?.toLowerCase().includes('144hz')
    )
      uses.push('gaming');
    uses.push('student', 'general');
  }

  if (category === 'laptop') {
    const hasGpu =
      attrs.gpu?.toLowerCase().includes('rtx') || attrs.gpu?.toLowerCase().includes('dedicated');
    if (hasGpu) uses.push('gaming');
    const ram = parseInt(attrs.ram?.match(/(\d+)/)?.[1] || '0', 10);
    if (ram >= 16) uses.push('coding', 'professional');
    const weight = parseFloat(attrs.weight?.match(/([\d.]+)/)?.[1] || '99');
    if (weight <= 1.5) uses.push('travel', 'office');
    uses.push('student', 'general');
  }

  if (category === 'headphones') {
    if (attrs.anc?.toLowerCase().includes('noise cancell')) uses.push('travel', 'commute');
    const hours = parseInt(attrs.battery?.match(/(\d+)hrs/i)?.[1] || '0', 10);
    if (hours >= 30) uses.push('travel', 'long_use');
    if (attrs.waterproof) uses.push('fitness', 'gym');
    uses.push('music', 'general');
  }

  return [...new Set(uses)]; // deduplicate
}

/**
 * Derive feature tags from product attributes.
 */
export function deriveFeatures(category: string, attrs: Record<string, string>): string[] {
  const features: string[] = [];

  if (attrs.connectivity?.includes('5G')) features.push('5G');
  const w = parseInt(attrs.charging?.match(/(\d+)W/i)?.[1] || '0', 10);
  if (w >= 33) features.push('fast charging');
  const mp = parseInt(attrs.camera?.match(/(\d+)MP/i)?.[1] || '0', 10);
  if (mp >= 48) features.push('high-res camera');
  if (mp >= 100) features.push('200MP camera');
  const mah = parseInt(attrs.battery?.match(/(\d+)mAh/i)?.[1] || '0', 10);
  if (mah >= 5000) features.push('big battery');
  const display = attrs.display?.toLowerCase() || '';
  if (display.includes('amoled') || display.includes('oled')) features.push('amoled');
  if (display.includes('120hz') || display.includes('144hz') || display.includes('165hz'))
    features.push('high refresh rate');
  if (attrs.anc?.toLowerCase().includes('noise cancell'))
    features.push('anc', 'noise cancellation');
  if (attrs.waterproof) features.push('waterproof');
  if (attrs.gpu?.toLowerCase().includes('rtx')) features.push('rtx gpu', 'gaming gpu');
  const ram = parseInt(attrs.ram?.match(/(\d+)/)?.[1] || '0', 10);
  if (ram >= 16) features.push('high ram');

  return features;
}

/**
 * Build the specifications object for a product.
 */
export function buildSpecifications(
  category: string,
  subCategory: string,
  brand: string,
  price: number,
  attrs: Record<string, string>,
  extraSearchTags: string[] = []
): ProductSpecifications {
  const priceBand = getPriceBand(price);
  const bucket = getBucketRange(priceBand);
  const useCases = deriveUseCases(category, attrs);
  const features = deriveFeatures(category, attrs);

  // Build search tags
  const searchTags: string[] = [
    category,
    CATEGORY_ALIASES[category] || category,
    brand.toLowerCase(),
    subCategory.toLowerCase(),
    priceBand.replace('_', ' '),
    ...features.map((f) => f.toLowerCase()),
    ...useCases.map((u) => u.toLowerCase()),
    ...extraSearchTags,
  ];

  return {
    category: CATEGORY_ALIASES[category] || category,
    subcategory: subCategory.toLowerCase().replace(/\s+/g, '_'),
    brand,
    price_band: priceBand,
    use_cases: useCases,
    features,
    attributes: attrs,
    search_tags: [...new Set(searchTags)],
    price_bucket: { min: bucket.min, max: bucket.max === Infinity ? 9999999 : bucket.max },
  };
}
