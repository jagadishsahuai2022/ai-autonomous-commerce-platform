/**
 * Smart Intent Engine v2 — AI-Like Response Generator
 *
 * Produces human-sounding template responses based on intent confidence and context.
 * No external LLM calls — pure deterministic template logic.
 */

import type { ParsedIntent, RankedProduct, GeneratedResponse } from './types';

// ── Format helpers ───────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatCategory(cat: string): string {
  const names: Record<string, string> = {
    phone: 'smartphones',
    laptop: 'laptops',
    headphones: 'headphones',
    television: 'TVs',
    appliances: 'appliances',
    watch: 'smartwatches',
    tablet: 'tablets',
    camera: 'cameras',
    speaker: 'speakers',
    stationery: 'stationery items',
    fashion: 'clothing & fashion',
    footwear: 'footwear',
    watches: 'watches',
    furniture: 'furniture',
    accessories: 'accessories',
  };
  return names[cat] || cat;
}

function formatUseCase(uc: string): string {
  const names: Record<string, string> = {
    gaming: 'gaming',
    office: 'work and productivity',
    student: 'students',
    travel: 'travel',
    photography: 'photography',
    music: 'music',
    fitness: 'fitness',
    coding: 'programming',
    entertainment: 'entertainment',
    home: 'home use',
  };
  return names[uc] || uc;
}

// ── Template Engine ──────────────────────────────────────────────────────────

export function generateResponse(
  intent: ParsedIntent,
  products: RankedProduct[]
): GeneratedResponse {
  const confidence = intent.confidence;
  const cat = intent.category || 'product';
  const catName = formatCategory(cat);
  const topProducts = products.slice(0, 5);

  // ── High confidence (≥70) — full recommendation ──────────────────────────
  if (confidence >= 70 && topProducts.length > 0) {
    const parts: string[] = [];

    // Opening line (context-aware)
    if (intent.use_case && intent.budget) {
      parts.push(
        `Based on your need for **${formatUseCase(intent.use_case)}**, here are the best ${catName} under ${formatPrice(intent.budget.max)}:`
      );
    } else if (intent.use_case) {
      parts.push(
        `Great choice! Here are the top ${catName} for **${formatUseCase(intent.use_case)}**:`
      );
    } else if (intent.budget) {
      parts.push(
        `Here are the best ${catName} within your budget of ${formatPrice(intent.budget.max)}:`
      );
    } else if (intent.brand) {
      parts.push(`Here are the top **${intent.brand}** ${catName} available right now:`);
    } else {
      parts.push(`Here are the best ${catName} I recommend for you:`);
    }

    // Product list
    parts.push('');
    for (let i = 0; i < topProducts.length; i++) {
      const p = topProducts[i];
      const badge = i === 0 ? ' 🏆' : i === 1 ? ' ⭐' : '';
      const discount =
        p.originalPrice > p.price ? ` ~~₹${p.originalPrice.toLocaleString('en-IN')}~~` : '';
      parts.push(
        `${i + 1}. **${p.name}** — ₹${p.price.toLocaleString('en-IN')}${discount}${badge}`
      );
      // Key attributes (pick top 2-3)
      const highlights = getProductHighlights(p, intent);
      if (highlights.length > 0) {
        parts.push(`   ${highlights.join(' | ')}`);
      }
    }

    // Pro tip
    const tip = getProTip(cat, intent);
    if (tip) {
      parts.push('');
      parts.push(`💡 **Pro Tip:** ${tip}`);
    }

    // Follow-up
    const followUp = getFollowUp(intent);

    return {
      text: parts.join('\n'),
      confidence_level: 'high',
      follow_up_prompt: followUp,
    };
  }

  // ── Medium confidence (40–69) — partial info ─────────────────────────────
  if (confidence >= 40 && topProducts.length > 0) {
    const parts: string[] = [];

    parts.push(
      `I found some ${catName} options that might work for you. Let me know if you'd like me to narrow it down further!`
    );

    parts.push('');
    for (let i = 0; i < Math.min(topProducts.length, 4); i++) {
      const p = topProducts[i];
      parts.push(`${i + 1}. **${p.name}** — ₹${p.price.toLocaleString('en-IN')} (⭐ ${p.rating})`);
    }

    return {
      text: parts.join('\n'),
      confidence_level: 'medium',
      follow_up_prompt:
        'Can you tell me your budget range or preferred brand? That would help me find better matches.',
    };
  }

  // ── Low confidence (<40) — ask for clarification ─────────────────────────
  if (topProducts.length > 0) {
    return {
      text: `I found some options, but I can refine better. Can you tell me your budget or preferred brand?`,
      confidence_level: 'low',
      follow_up_prompt:
        'Try being more specific — e.g., "gaming laptop under 80000" or "Samsung phone with good camera".',
    };
  }

  // ── No results ───────────────────────────────────────────────────────────
  if (cat !== 'product') {
    return {
      text: `I refined your search to **${catName}** but couldn't find exact matches. Try removing brand or budget constraints, or check for a different product type.`,
      confidence_level: 'low',
      follow_up_prompt: `Try: "${catName} under ₹50000" or specify a brand like "Nike ${catName}" to get better results.`,
    };
  }
  return {
    text: `I couldn't find products matching your exact criteria. Try broadening your search — adjust the budget or remove brand preference.`,
    confidence_level: 'low',
    follow_up_prompt:
      'What product category are you interested in? I can help you find the best options.',
  };
}

// ── Product highlight extractor ──────────────────────────────────────────────

function getProductHighlights(product: RankedProduct, intent: ParsedIntent): string[] {
  const highlights: string[] = [];
  const attrs = product.attributes;

  // Always show rating if good
  if (product.rating >= 4.3) {
    highlights.push(
      `⭐ ${product.rating}/5 (${product.reviewCount.toLocaleString('en-IN')} reviews)`
    );
  }

  // Show attributes relevant to user's features/use_case
  const relevantKeys = getRelevantAttrKeys(product.category, intent);
  for (const key of relevantKeys) {
    if (attrs[key] && highlights.length < 3) {
      highlights.push(`${formatAttrLabel(key)}: ${attrs[key]}`);
    }
  }

  // Delivery info for appliances
  if (product.category === 'appliances' && product.delivery.free) {
    highlights.push('🚚 Free delivery');
  }

  return highlights.slice(0, 3);
}

function getRelevantAttrKeys(category: string, intent: ParsedIntent): string[] {
  // Prioritize based on use case
  if (intent.use_case === 'gaming') return ['gpu', 'processor', 'display', 'ram'];
  if (intent.use_case === 'photography') return ['camera', 'display'];
  if (intent.use_case === 'music') return ['driver', 'anc', 'codec'];
  if (intent.use_case === 'fitness') return ['waterproof', 'battery'];
  if (intent.use_case === 'travel') return ['weight', 'battery'];
  if (intent.use_case === 'coding') return ['processor', 'ram', 'display'];

  // Default by category
  const defaults: Record<string, string[]> = {
    phone: ['camera', 'battery', 'processor', 'display'],
    laptop: ['processor', 'ram', 'gpu', 'weight'],
    headphones: ['anc', 'battery', 'driver'],
    television: ['size', 'panel', 'resolution'],
    appliances: ['type', 'capacity', 'star_rating', 'technology'],
    fashion: ['type', 'material', 'fit', 'occasion'],
    footwear: ['material', 'sole', 'occasion', 'closure'],
    watches: ['movement', 'display', 'strap', 'water_resistance'],
    furniture: ['type', 'material', 'finish', 'assembly'],
    accessories: ['type', 'material', 'color', 'compartments'],
  };
  return defaults[category] || ['type', 'capacity'];
}

function formatAttrLabel(key: string): string {
  const labels: Record<string, string> = {
    ram: 'RAM',
    gpu: 'GPU',
    processor: 'CPU',
    battery: 'Battery',
    camera: 'Camera',
    display: 'Display',
    storage: 'Storage',
    weight: 'Weight',
    anc: 'ANC',
    driver: 'Driver',
    codec: 'Codec',
    size: 'Size',
    panel: 'Panel',
    resolution: 'Resolution',
    star_rating: 'Rating',
    type: 'Type',
    capacity: 'Capacity',
    connectivity: 'Connectivity',
    charging: 'Charging',
    waterproof: 'Waterproof',
    technology: 'Tech',
    smart_platform: 'OS',
    hdr: 'HDR',
    audio: 'Audio',
    special: 'Feature',
    motor: 'Motor',
    wash_programs: 'Programs',
    rpm: 'Spin',
    power: 'Power',
    cooling: 'Cooling',
    // Fashion / Footwear / Watches / Furniture / Accessories
    material: 'Material',
    fit: 'Fit',
    occasion: 'Occasion',
    care: 'Care',
    sole: 'Sole',
    closure: 'Closure',
    movement: 'Movement',
    strap: 'Strap',
    water_resistance: 'Water Resistance',
    case_material: 'Case',
    frame: 'Frame',
    finish: 'Finish',
    assembly: 'Assembly',
    compartments: 'Compartments',
    color: 'Color',
    lens: 'Lens',
    frame_shape: 'Shape',
    uv_protection: 'UV',
    gender: 'Gender',
  };
  return labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

// ── Pro tips by category ─────────────────────────────────────────────────────

function getProTip(category: string, intent: ParsedIntent): string | null {
  const tips: Record<string, Record<string, string>> = {
    phone: {
      gaming: 'For mobile gaming, prioritize Snapdragon 8 Gen 3 and AMOLED 120Hz+ displays.',
      photography:
        'Look for OIS (Optical Image Stabilization) — it makes a huge difference in low-light photos.',
      student:
        'Mid-range phones between ₹15K-25K offer the best value with 5G, AMOLED, and 50MP+ cameras.',
      default: 'Compare camera samples and battery tests on YouTube before deciding.',
    },
    laptop: {
      gaming: 'RTX 4060 is the sweet spot for 1080p gaming. For 1440p, go RTX 4070+.',
      coding: '16GB RAM is the minimum for modern development. Go 32GB if working with Docker/VMs.',
      student: 'Battery life matters most for students — target 10+ hours for all-day use.',
      office: 'Lightweight ultrabooks under 1.5kg with long battery are ideal for office.',
      default: 'SSDs are a must — they make everything faster. Never buy a laptop without one.',
    },
    headphones: {
      music: 'For audiophile quality, look for LDAC codec support and 40mm+ drivers.',
      travel: 'Sony WH-1000XM5 and Bose QC Ultra lead ANC headphones for travel.',
      fitness: 'Sweat-resistant (IPX4+) earbuds with secure fit are essential for workouts.',
      default: 'Try before you buy if possible — comfort is subjective.',
    },
    television: {
      entertainment: 'OLED offers the best picture quality. For a bright room, QLED is better.',
      gaming: 'Look for HDMI 2.1 and 120Hz support for PS5/Xbox Series X gaming.',
      default: '55" is the ideal size for mid-size rooms (8-12 feet viewing distance).',
    },
    appliances: {
      default: 'Inverter technology saves 30-50% energy. Always check the star rating.',
    },
    fashion: {
      default: 'Check the size chart before buying — sizing varies by brand.',
      office: 'Opt for wrinkle-resistant fabrics for office wear that stays crisp all day.',
    },
    footwear: {
      default: 'Order your correct size — a half-size too small can cause discomfort.',
      fitness: 'Running shoes should be replaced every 500-800 km for proper cushioning.',
      office: 'Genuine leather shoes last much longer with proper care and polishing.',
    },
    watches: {
      default: 'Automatic watches last a lifetime with proper servicing every 3-5 years.',
    },
    furniture: {
      default:
        'Measure your space twice before ordering — most furniture cannot be returned after assembly.',
    },
    accessories: {
      default: 'Genuine leather accessories age beautifully and outlast synthetic ones.',
    },
  };

  const catTips = tips[category];
  if (!catTips) return null;
  return catTips[intent.use_case || ''] || catTips['default'] || null;
}

// ── Follow-up prompts ────────────────────────────────────────────────────────

function getFollowUp(intent: ParsedIntent): string {
  if (!intent.budget && !intent.brand) {
    return 'Would you like me to compare any of these, or filter by budget/brand?';
  }
  if (!intent.budget) {
    return 'Would you like me to narrow these down by budget?';
  }
  if (intent.features.length === 0) {
    return 'Any specific features you care about? (camera, battery, display, etc.)';
  }
  return 'Want me to compare the top 2 options in detail?';
}
