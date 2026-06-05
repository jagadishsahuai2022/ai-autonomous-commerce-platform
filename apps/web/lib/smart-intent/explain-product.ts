/**
 * Smart Intent Engine — Product Explanation Generator (Phase 5)
 *
 * Generates deterministic, Amazon-style "Why this product" explanations.
 * No LLM calls — pure rule-based reasoning from product data + intent.
 *
 * Output is human-readable, trust-safe, and explainable.
 */

import type { ParsedIntent, RankedProduct } from './types';
import { isDBProductId } from './db-product-bridge';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProductExplanation {
  summary: string;
  reasons: string[];
  strengths: string[];
  weaknesses: string[];
  score_label: string; // "Best Match", "Great Value", "Top Rated", etc.
  confidence: 'high' | 'medium' | 'low';
}

// ── Main: Generate explanation for a ranked product ──────────────────────────

export function explainProduct(product: RankedProduct, intent: ParsedIntent): ProductExplanation {
  const reasons: string[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // 1. Budget fit
  if (intent.budget && intent.budget.max > 0) {
    if (product.price <= intent.budget.max) {
      const savings = intent.budget.max - product.price;
      if (savings > 0) {
        reasons.push(`Within your budget`);
        strengths.push(
          `₹${savings.toLocaleString('en-IN')} under your ₹${intent.budget.max.toLocaleString('en-IN')} budget`
        );
      } else {
        reasons.push('Right at your budget');
      }
    } else {
      const over = product.price - intent.budget.max;
      weaknesses.push(`₹${over.toLocaleString('en-IN')} over budget`);
    }
  }

  // 2. Rating
  if (product.rating >= 4.5) {
    reasons.push('Exceptional ratings');
    strengths.push(
      `${product.rating}★ from ${product.reviewCount.toLocaleString('en-IN')} reviews`
    );
  } else if (product.rating >= 4.0) {
    reasons.push('Highly rated');
    strengths.push(`${product.rating}★ rating`);
  } else if (product.rating < 3.5) {
    weaknesses.push(`Average rating: ${product.rating}★`);
  }

  // 3. Brand match
  if (intent.brand) {
    if (product.brand.toLowerCase() === intent.brand.toLowerCase()) {
      reasons.push(`Matches your brand preference: ${product.brand}`);
      strengths.push(`Your preferred brand`);
    }
  } else if (product.brand) {
    reasons.push(`Popular brand: ${product.brand}`);
  }

  // 4. Feature match
  if (intent.features && intent.features.length > 0) {
    const matched = intent.features.filter((f) => {
      const fl = f.toLowerCase();
      return (
        product.searchIndex.includes(fl) ||
        Object.values(product.attributes).some((v) => v.toLowerCase().includes(fl))
      );
    });
    if (matched.length > 0) {
      strengths.push(`Has: ${matched.join(', ')}`);
    }
    const missing = intent.features.filter(
      (f) =>
        !product.searchIndex.includes(f.toLowerCase()) &&
        !Object.values(product.attributes).some((v) => v.toLowerCase().includes(f.toLowerCase()))
    );
    if (missing.length > 0) {
      weaknesses.push(`May lack: ${missing.join(', ')}`);
    }
  }

  // 5. Use case match
  if (intent.use_case && product.specifications) {
    const ucLower = intent.use_case.toLowerCase();
    const useCases = product.specifications.use_cases || [];
    if (useCases.some((uc) => uc.toLowerCase().includes(ucLower))) {
      strengths.push(`Great for ${intent.use_case}`);
    }
  }

  // 6. Delivery
  if (product.delivery && product.delivery.daysMin <= 2) {
    strengths.push('Fast delivery available');
  }
  if (product.delivery && product.delivery.free) {
    strengths.push('Free delivery');
  }

  // 7. EMI
  if (product.hasEMI && product.price > 10000) {
    strengths.push('EMI available');
  }

  // 8. Popular product (high review count)
  if (product.reviewCount >= 5000) {
    strengths.push(`Bestseller: ${(product.reviewCount / 1000).toFixed(0)}K+ reviews`);
  }

  // 9. DB product trust badge
  if (isDBProductId(product.id)) {
    strengths.push('Verified product from our catalog');
  }

  // ── Score label ────────────────────────────────────────────────────────────

  const score = product.relevanceScore;
  const isOverBudget =
    intent.budget && intent.budget.max > 0 && product.price > intent.budget.max * 1.05;
  let score_label: string;
  if (isOverBudget) {
    // Never call an over-budget product "Best Match" or "Great Value"
    score_label = score >= 70 ? 'Good Option' : 'Worth Considering';
  } else if (score >= 90) {
    score_label = 'Best Match';
  } else if (score >= 80) {
    score_label = 'Great Value';
  } else if (product.rating >= 4.5) {
    score_label = 'Top Rated';
  } else if (intent.budget && product.price <= intent.budget.max * 0.7) {
    score_label = 'Budget Pick';
  } else if (score >= 60) {
    score_label = 'Good Option';
  } else {
    score_label = 'Worth Considering';
  }

  // ── Summary: one-line "Why this product" ───────────────────────────────────

  const nameWithoutBrand = removeBrandPrefix(product.name, product.brand);
  const summaryParts: string[] = [];

  if (reasons.length > 0) {
    summaryParts.push(reasons.slice(0, 2).join('. '));
  }

  const summary =
    summaryParts.length > 0
      ? `${product.brand} ${nameWithoutBrand} — ${summaryParts.join('. ')}.`
      : `${product.brand} ${nameWithoutBrand} — matches your budget and preferences.`;

  // ── Confidence ─────────────────────────────────────────────────────────────

  let confidence: 'high' | 'medium' | 'low';
  if (strengths.length >= 3 && weaknesses.length === 0) confidence = 'high';
  else if (strengths.length >= 2) confidence = 'medium';
  else confidence = 'low';

  return {
    summary,
    reasons,
    strengths,
    weaknesses,
    score_label,
    confidence,
  };
}

// ── Helper: Remove brand prefix from product name to avoid "Brand Brand Name" ─

export function removeBrandPrefix(name: string, brand: string): string {
  if (!brand) return name;
  const trimmedName = name.trim();
  const trimmedBrand = brand.trim();
  if (trimmedName.toLowerCase().startsWith(trimmedBrand.toLowerCase())) {
    const rest = trimmedName.slice(trimmedBrand.length).trim();
    return rest || trimmedName; // if name IS just the brand, keep it
  }
  return trimmedName;
}
