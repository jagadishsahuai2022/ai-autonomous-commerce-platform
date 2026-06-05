/**
 * Smart Intent Engine v2 — Rule-based Entity Extractor
 *
 * Detects category, brand, budget, use_case, and features from tokens.
 * Returns a ParsedIntent with confidence score.
 */

import type { ParsedIntent, MatchedEntity } from './types';

// ── Category Detection ───────────────────────────────────────────────────────

const CATEGORY_PATTERNS: Record<string, string[]> = {
  phone: ['phone', 'smartphone', 'mobile', 'iphone', 'android', 'cellphone', 'handset', '5g phone'],
  laptop: ['laptop', 'notebook', 'macbook', 'chromebook', 'ultrabook', 'thinkpad'],
  headphones: [
    'headphones',
    'earphones',
    'earbuds',
    'airpods',
    'headset',
    'tws',
    'neckband',
    'over-ear',
  ],
  television: ['television', 'smart tv', 'oled', 'qled', 'led tv', '4k tv', 'tv', 'tvs', '4k', 'uhd tv'],
  appliances: [
    'washing machine',
    'refrigerator',
    'air conditioner',
    'microwave',
    'mixer',
    'grinder',
    'air purifier',
    'water purifier',
    'dishwasher',
    'induction',
    'oven',
    'cooler',
    'geyser',
    'iron',
    'vacuum cleaner',
  ],
  watch: ['smartwatch', 'fitness band', 'fitness tracker', 'wearable', 'smart band', 'smart watch'],
  tablet: ['tablet', 'ipad', 'tab'],
  camera: ['camera', 'dslr', 'mirrorless', 'action camera', 'gopro', 'webcam'],
  speaker: ['speaker', 'soundbar', 'bluetooth speaker', 'home theater', 'subwoofer'],
  stationery: [
    'pen',
    'pencil',
    'eraser',
    'notebook',
    'notepad',
    'diary',
    'ruler',
    'stapler',
    'marker',
    'highlighter',
    'stationery',
    'crayon',
    'sketch',
  ],
  // ── New 5 categories (Phase 1) ──
  fashion: [
    'fashion',
    'jeans',
    'shirt',
    'kurta',
    'dress',
    'top',
    'saree',
    't-shirt',
    'tshirt',
    'trouser',
    'pant',
    'skirt',
    'blouse',
    'leggings',
    'clothing',
    'clothes',
    'apparel',
    'outfit',
    'kurti',
    'ethnic wear',
    'western wear',
    'formal wear',
    'casual wear',
    'jacket',
    'hoodie',
    'sweatshirt',
    'shorts',
    'salwar',
    'dupatta',
    'tracksuit',
  ],
  footwear: [
    'shoes',
    'sneakers',
    'sandals',
    'boots',
    'heels',
    'slippers',
    'loafers',
    'chappal',
    'footwear',
    'running shoes',
    'sports shoes',
    'formal shoes',
    'casual shoes',
    'flip flops',
    'moccasins',
    'oxfords',
    'derby',
    'wedges',
    'pumps',
    'stilettos',
    'ankle boots',
    'bellies',
    'kohlapuri',
  ],
  watches: [
    'watch',
    'analog watch',
    'wristwatch',
    'timepiece',
    'chronograph',
    'luxury watch',
    'mechanical watch',
    'quartz watch',
    'digital watch',
    'dress watch',
    'sports watch',
    'diving watch',
    'wrist watch',
  ],
  furniture: [
    'sofa',
    'couch',
    'chair',
    'table',
    'bed',
    'wardrobe',
    'cupboard',
    'desk',
    'shelf',
    'bookshelf',
    'cabinet',
    'furniture',
    'almirah',
    'dining table',
    'coffee table',
    'dressing table',
    'study table',
    'recliner',
    'sectional',
    'bunk bed',
    'mattress',
    'ottoman',
    'sideboard',
    'tv unit',
  ],
  accessories: [
    'belt',
    'wallet',
    'bag',
    'handbag',
    'purse',
    'backpack',
    'sunglasses',
    'cap',
    'hat',
    'jewellery',
    'jewelry',
    'necklace',
    'bracelet',
    'earrings',
    'ring',
    'accessories',
    'scarf',
    'stole',
    'gloves',
    'tie',
    'cufflinks',
    'brooch',
    'keychain',
    'lanyard',
    'tote bag',
    'clutch',
    'sling bag',
    'laptop bag',
    'travel bag',
    'duffel',
  ],
};

// ── Brand Detection ──────────────────────────────────────────────────────────

const BRAND_PATTERNS: Record<string, string[]> = {
  // Phones
  Apple: ['apple', 'iphone', 'ios'],
  Samsung: ['samsung', 'galaxy'],
  OnePlus: ['oneplus', 'one plus'],
  Xiaomi: ['xiaomi', 'redmi', 'poco', 'mi '],
  Realme: ['realme'],
  Vivo: ['vivo'],
  Oppo: ['oppo', 'reno'],
  Google: ['google', 'pixel'],
  Nothing: ['nothing phone', 'nothing ear'],
  Motorola: ['motorola', 'moto'],
  iQOO: ['iqoo'],
  Tecno: ['tecno'],
  Infinix: ['infinix'],
  // Laptops
  Dell: ['dell', 'xps', 'inspiron', 'latitude'],
  HP: ['hp', 'spectre', 'pavilion', 'omen'],
  Lenovo: ['lenovo', 'thinkpad', 'ideapad', 'legion'],
  ASUS: ['asus', 'rog', 'zenbook', 'vivobook'],
  Acer: ['acer', 'nitro', 'swift', 'aspire'],
  MSI: ['msi', 'prestige', 'stealth'],
  // Audio + Phones (Sony is both)
  Sony: ['sony', 'xperia', 'xm5', 'xm4', 'wh-1000'],
  JBL: ['jbl'],
  Bose: ['bose', 'quietcomfort'],
  Sennheiser: ['sennheiser'],
  boAt: ['boat', 'airdopes'],
  Noise: ['noise'],
  // Appliances
  LG: ['lg'],
  Whirlpool: ['whirlpool'],
  Haier: ['haier'],
  Bosch: ['bosch'],
  Daikin: ['daikin'],
  Voltas: ['voltas'],
  IFB: ['ifb'],
  Godrej: ['godrej', 'godrej interio', 'godrej furniture'],
  Philips: ['philips'],
  // TV
  TCL: ['tcl'],
  Hisense: ['hisense'],
  // Fashion & Footwear brands
  "Levi's": ["levi's", 'levis', 'levi'],
  'H&M': ['h&m', 'h and m'],
  Zara: ['zara'],
  Mango: ['mango'],
  'Allen Solly': ['allen solly'],
  'Peter England': ['peter england'],
  'Louis Philippe': ['louis philippe'],
  'Van Heusen': ['van heusen'],
  Adidas: ['adidas'],
  Nike: ['nike'],
  Puma: ['puma'],
  Reebok: ['reebok'],
  Bata: ['bata'],
  'Red Tape': ['red tape'],
  Metro: ['metro shoes'],
  Woodland: ['woodland'],
  Crocs: ['crocs'],
  Skechers: ['skechers'],
  // Watches brands
  Rolex: ['rolex'],
  Omega: ['omega'],
  Titan: ['titan'],
  Fossil: ['fossil'],
  Casio: ['casio'],
  Seiko: ['seiko'],
  Citizen: ['citizen'],
  // Furniture brands
  Ikea: ['ikea'],
  Durian: ['durian'],
  Nilkamal: ['nilkamal'],

  Pepperfry: ['pepperfry'],
  // Accessories brands
  Hidesign: ['hidesign'],
  Baggit: ['baggit'],
  Lavie: ['lavie'],
  'Tommy Hilfiger': ['tommy hilfiger', 'tommy'],
  'Calvin Klein': ['calvin klein', 'ck'],
};

// ── Use Case Detection ───────────────────────────────────────────────────────

interface UseCaseRule {
  use_case: string;
  keywords: string[];
  categories: string[]; // which categories this use_case is relevant for ('*' = all)
}

const USE_CASE_RULES: UseCaseRule[] = [
  {
    use_case: 'gaming',
    keywords: ['gaming', 'game', 'gamer', 'fps', 'esports', 'pubg', 'fortnite'],
    categories: ['laptop', 'phone', 'headphones', 'television'],
  },
  {
    use_case: 'office',
    keywords: ['office', 'work', 'business', 'professional', 'corporate', 'productivity'],
    categories: ['laptop', 'phone', 'headphones', 'tablet'],
  },
  {
    use_case: 'student',
    keywords: ['student', 'college', 'school', 'education', 'study', 'learning'],
    categories: ['laptop', 'phone', 'tablet', 'stationery'],
  },
  {
    use_case: 'travel',
    keywords: ['travel', 'portable', 'lightweight', 'compact', 'on-the-go'],
    categories: ['laptop', 'headphones', 'speaker', 'camera'],
  },
  {
    use_case: 'photography',
    keywords: ['photography', 'camera', 'photo', 'selfie', 'portrait', 'vlogging', 'vlog'],
    categories: ['phone', 'camera'],
  },
  {
    use_case: 'music',
    keywords: ['music', 'audiophile', 'bass', 'dj', 'studio', 'mixing'],
    categories: ['headphones', 'speaker'],
  },
  {
    use_case: 'fitness',
    keywords: ['fitness', 'gym', 'workout', 'exercise', 'running', 'health', 'sports'],
    categories: ['watch', 'headphones'],
  },
  {
    use_case: 'coding',
    keywords: ['coding', 'programming', 'developer', 'dev', 'software', 'web development'],
    categories: ['laptop'],
  },
  {
    use_case: 'entertainment',
    keywords: ['entertainment', 'movies', 'streaming', 'netflix', 'youtube'],
    categories: ['television', 'tablet', 'speaker'],
  },
  {
    use_case: 'home',
    keywords: ['home', 'family', 'kitchen', 'household', 'daily use'],
    categories: ['appliances', 'television'],
  },
];

// ── Feature Detection ────────────────────────────────────────────────────────

interface FeatureRule {
  feature: string;
  keywords: string[];
  categories: string[];
}

const FEATURE_RULES: FeatureRule[] = [
  // Phone / Laptop
  {
    feature: 'battery',
    keywords: ['battery', 'long battery', 'battery life', 'endurance', 'all-day battery'],
    categories: ['phone', 'laptop', 'headphones', 'watch'],
  },
  {
    feature: 'camera',
    keywords: ['camera', 'megapixel', 'mp', 'lens', 'photo quality', 'night mode'],
    categories: ['phone', 'camera'],
  },
  { feature: '5g', keywords: ['5g', 'fifth generation'], categories: ['phone'] },
  {
    feature: 'fast_charging',
    keywords: ['fast charging', 'quick charge', 'warp charge', 'dart charge', 'turbo charge'],
    categories: ['phone'],
  },
  {
    feature: 'display',
    keywords: ['amoled', 'oled', 'display', 'screen', '120hz', '144hz', 'hdr', 'retina'],
    categories: ['phone', 'laptop', 'television', 'tablet'],
  },
  {
    feature: 'lightweight',
    keywords: ['lightweight', 'light', 'thin', 'slim', 'ultraslim', 'portable'],
    categories: ['laptop', 'phone', 'headphones'],
  },
  {
    feature: 'storage',
    keywords: ['storage', '128gb', '256gb', '512gb', '1tb', 'ssd', 'nvme'],
    categories: ['phone', 'laptop'],
  },
  {
    feature: 'ram',
    keywords: ['ram', '8gb', '16gb', '32gb', '64gb', 'memory'],
    categories: ['phone', 'laptop', 'tablet'],
  },
  {
    feature: 'gpu',
    keywords: ['gpu', 'graphics', 'rtx', 'gtx', 'dedicated graphics', 'nvidia', 'amd radeon'],
    categories: ['laptop'],
  },
  {
    feature: 'processor',
    keywords: [
      'processor',
      'cpu',
      'i5',
      'i7',
      'i9',
      'ryzen',
      'snapdragon',
      'dimensity',
      'apple m1',
      'apple m2',
      'apple m3',
      'apple m4',
    ],
    categories: ['phone', 'laptop'],
  },
  // Audio
  {
    feature: 'anc',
    keywords: ['anc', 'noise cancelling', 'noise cancellation', 'active noise'],
    categories: ['headphones'],
  },
  {
    feature: 'wireless',
    keywords: ['wireless', 'bluetooth', 'bt'],
    categories: ['headphones', 'speaker'],
  },
  {
    feature: 'waterproof',
    keywords: ['waterproof', 'water resistant', 'ip67', 'ip68', 'ipx4', 'ipx7'],
    categories: ['phone', 'headphones', 'watch', 'speaker'],
  },
  // Appliances
  {
    feature: 'inverter',
    keywords: ['inverter', 'inverter technology'],
    categories: ['appliances'],
  },
  {
    feature: 'energy_efficient',
    keywords: ['energy efficient', '5 star', '5-star', 'energy saving', 'star rating'],
    categories: ['appliances', 'television'],
  },
  {
    feature: 'smart',
    keywords: ['smart', 'wifi', 'app control', 'voice control', 'alexa', 'google assistant'],
    categories: ['television', 'appliances', 'watch', 'speaker'],
  },
  // TV
  { feature: '4k', keywords: ['4k', 'ultra hd', 'uhd'], categories: ['television'] },
  {
    feature: 'large_screen',
    keywords: ['large', 'big screen', '55 inch', '65 inch', '75 inch', '55"', '65"', '75"'],
    categories: ['television'],
  },
];

// ── Budget Extraction ────────────────────────────────────────────────────────

const BUDGET_PATTERNS: Array<{
  regex: RegExp;
  extract: (m: RegExpMatchArray) => { min: number; max: number };
}> = [
  // "under 20k", "below 50k", "less than 20000"
  {
    regex: /(?:under|below|less than|upto|up to|max|within|at most)\s+(\d+)\s*k/i,
    extract: (m) => ({ min: 0, max: parseInt(m[1], 10) * 1000 }),
  },
  {
    regex: /(?:under|below|less than|upto|up to|max|within|at most)\s+(?:rs\.?|₹|inr)?\s*(\d+)/i,
    extract: (m) => ({ min: 0, max: parseInt(m[1], 10) }),
  },
  // "between 20k and 40k", "20k to 40k", "20000 to 40000"
  {
    regex: /(\d+)\s*k\s*(?:to|-|–|and)\s*(\d+)\s*k/i,
    extract: (m) => ({ min: parseInt(m[1], 10) * 1000, max: parseInt(m[2], 10) * 1000 }),
  },
  {
    regex: /(\d+)\s*(?:to|-|–|and)\s*(\d+)/i,
    extract: (m) => ({ min: parseInt(m[1], 10), max: parseInt(m[2], 10) }),
  },
  // "above 50k", "over 30000", "more than 20000"
  {
    regex: /(?:above|over|more than|minimum|at least|from)\s+(\d+)\s*k/i,
    extract: (m) => ({ min: parseInt(m[1], 10) * 1000, max: parseInt(m[1], 10) * 3000 }),
  },
  {
    regex: /(?:above|over|more than|minimum|at least|from)\s+(?:rs\.?|₹|inr)?\s*(\d+)/i,
    extract: (m) => ({ min: parseInt(m[1], 10), max: parseInt(m[1], 10) * 3 }),
  },
  // "1 lakh", "1.5 lakh"
  {
    regex: /(\d+(?:\.\d+)?)\s*lakh/i,
    extract: (m) => {
      const v = Math.round(parseFloat(m[1]) * 100000);
      return { min: 0, max: v };
    },
  },
  // "around 30k", "about 25000"
  {
    regex: /(?:around|about|near|approx|approximately|roughly)\s+(\d+)\s*k/i,
    extract: (m) => {
      const v = parseInt(m[1], 10) * 1000;
      return { min: Math.round(v * 0.7), max: Math.round(v * 1.3) };
    },
  },
  {
    regex: /(?:around|about|near|approx|approximately|roughly)\s+(?:rs\.?|₹|inr)?\s*(\d+)/i,
    extract: (m) => {
      const v = parseInt(m[1], 10);
      return { min: Math.round(v * 0.7), max: Math.round(v * 1.3) };
    },
  },
  // Plain rupee amount: "₹15000 phone", "rs 20000"
  {
    regex: /(?:rs\.?|₹|inr)\s*(\d{4,6})\b/i,
    extract: (m) => {
      const v = parseInt(m[1], 10);
      return { min: Math.round(v * 0.85), max: Math.round(v * 1.15) };
    },
  },
  // Plain k-amount at start: "20k phone", "40k laptop"
  {
    regex: /\b(\d+)k\b/i,
    extract: (m) => ({ min: 0, max: parseInt(m[1], 10) * 1000 }),
  },
  // Modifiers: "cheap" / "budget" / "affordable"
  {
    regex: /\b(cheap|budget|affordable|sasta|value|economical|low.?price|low.?cost)\b/i,
    extract: () => ({ min: 0, max: -1 }),
  }, // -1 = "cheap marker" for post-processing
  // Modifiers: "premium" / "expensive" / "high end"
  {
    regex: /\b(premium|expensive|high.?end|luxury|flagship|top.?end|best)\b/i,
    extract: () => ({ min: -2, max: -2 }),
  }, // -2 = "premium marker"
];

// ── Main Extractor ───────────────────────────────────────────────────────────

export function extractEntities(tokens: string[], normalized: string): ParsedIntent {
  const entities: MatchedEntity[] = [];

  // 1. Category detection
  // Primary product categories take priority over feature-like categories
  // e.g. "camera phone" should detect phone (primary product) not camera
  const PRIMARY_CATEGORIES = new Set([
    'phone',
    'laptop',
    'headphones',
    'television',
    'appliances',
    'tablet',
    'watch',
    'fashion',
    'footwear',
    'watches',
    'furniture',
    'accessories',
  ]);
  const allCatMatches: { cat: string; pattern: string; score: number; isPrimary: boolean }[] = [];
  for (const [cat, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern)) {
        allCatMatches.push({
          cat,
          pattern,
          score: pattern.length,
          isPrimary: PRIMARY_CATEGORIES.has(cat),
        });
      }
    }
  }
  // If we have both primary and secondary category matches, prefer primary
  let detectedCategory: string | null = null;
  let bestCatScore = 0;
  const primaryMatches = allCatMatches.filter((m) => m.isPrimary);
  const matchPool = primaryMatches.length > 0 ? primaryMatches : allCatMatches;
  for (const m of matchPool) {
    if (m.score > bestCatScore) {
      bestCatScore = m.score;
      detectedCategory = m.cat;
    }
  }
  if (detectedCategory) {
    const bestMatch = matchPool.find((m) => m.cat === detectedCategory);
    entities.push({
      type: 'category',
      value: detectedCategory,
      source_token: bestMatch?.pattern || detectedCategory,
      score: 30,
    });
  }

  // 2. Brand detection
  let detectedBrand: string | null = null;
  for (const [brand, patterns] of Object.entries(BRAND_PATTERNS)) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern)) {
        detectedBrand = brand;
        entities.push({ type: 'brand', value: brand, source_token: pattern, score: 15 });
        break; // one match per brand is enough
      }
    }
    if (detectedBrand) break; // first matched brand wins
  }

  // 3. Budget detection
  let detectedBudget: { min: number; max: number } | null = null;
  for (const { regex, extract } of BUDGET_PATTERNS) {
    const match = normalized.match(regex);
    if (match) {
      detectedBudget = extract(match);
      entities.push({
        type: 'budget',
        value: JSON.stringify(detectedBudget),
        source_token: match[0],
        score: 20,
      });
      break;
    }
  }

  // 4. Use case detection
  let detectedUseCase: string | null = null;
  for (const rule of USE_CASE_RULES) {
    const relevant =
      !detectedCategory ||
      rule.categories.includes(detectedCategory) ||
      rule.categories.includes('*');
    if (!relevant) continue;
    for (const kw of rule.keywords) {
      if (normalized.includes(kw)) {
        detectedUseCase = rule.use_case;
        entities.push({ type: 'use_case', value: rule.use_case, source_token: kw, score: 20 });
        break;
      }
    }
    if (detectedUseCase) break;
  }

  // 5. Feature detection
  const detectedFeatures: string[] = [];
  for (const rule of FEATURE_RULES) {
    const relevant = !detectedCategory || rule.categories.includes(detectedCategory);
    if (!relevant) continue;
    for (const kw of rule.keywords) {
      if (normalized.includes(kw)) {
        if (!detectedFeatures.includes(rule.feature)) {
          detectedFeatures.push(rule.feature);
          entities.push({ type: 'feature', value: rule.feature, source_token: kw, score: 15 });
        }
        break;
      }
    }
  }

  // 6. Confidence scoring
  // Nouns (product category + brand) and amounts (budget) are the most important signals.
  // Rule: whenever we have BOTH a noun signal AND an amount signal, give a combined boost.
  //       A strong noun is when both category AND brand are identified.
  const nounSignals: string[] = [];
  if (detectedCategory) nounSignals.push(`category:${detectedCategory}`);
  if (detectedBrand) nounSignals.push(`brand:${detectedBrand}`);

  const amountSignals: string[] = [];
  if (detectedBudget) {
    // Capture the raw token(s) from matched budget entity
    const budgetEntity = entities.find((e) => e.type === 'budget');
    if (budgetEntity) amountSignals.push(budgetEntity.source_token);
  }

  let confidence = 0;
  // Base scores
  if (detectedCategory) confidence += 30; // primary noun signal
  if (detectedBudget) confidence += 20;   // primary amount signal
  if (detectedBrand) confidence += 15;    // secondary noun signal
  if (detectedUseCase) confidence += 20;
  if (detectedFeatures.length > 0) confidence += Math.min(15, detectedFeatures.length * 5);

  // NOUN + AMOUNT combined boost: both a product noun and a budget amount detected
  if (nounSignals.length > 0 && amountSignals.length > 0) confidence += 15;

  // STRONG NOUN boost: both product category AND brand identified
  if (detectedCategory && detectedBrand) confidence += 10;

  // Cap at 100
  confidence = Math.min(100, confidence);

  return {
    category: detectedCategory,
    brand: detectedBrand,
    budget: detectedBudget,
    use_case: detectedUseCase,
    features: detectedFeatures,
    confidence,
    raw_tokens: tokens,
    matched_entities: entities,
    noun_signals: nounSignals,
    amount_signals: amountSignals,
  };
}
