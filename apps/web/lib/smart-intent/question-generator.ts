/**
 * Smart Intent Engine v2 — Dynamic Question Generator
 *
 * Generates 0–3 clarifying questions based on what's missing from the parsed intent.
 * Questions are contextual to the detected category.
 */

import type { ParsedIntent, ClarifyingQuestion } from './types';
import type { DBPriceRange } from './db-catalog-helpers';

/**
 * Pre-fetched DB data for brand and price range questions.
 * When provided, DB data is used; if absent, generic defaults are used instead
 * of falling back to the synthetic catalog.
 */
export interface QuestionDBData {
  /** Real brands from ProductBrand table for the category. */
  brands?: string[];
  /** Real price stats from Product table for the category. */
  priceRange?: DBPriceRange;
}

const MAX_QUESTIONS = 3;

// ── Category-specific use-case options ────────────────────────────────────────

const USE_CASE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  phone: [
    { value: 'photography', label: '📷 Camera / Photography' },
    { value: 'gaming', label: '🎮 Gaming' },
    { value: 'battery', label: '🔋 Long Battery Life' },
    { value: 'office', label: '💼 Work / Productivity' },
    { value: 'student', label: '🎓 Student / Budget' },
  ],
  laptop: [
    { value: 'gaming', label: '🎮 Gaming' },
    { value: 'office', label: '💼 Office / Business' },
    { value: 'coding', label: '💻 Programming / Dev' },
    { value: 'student', label: '🎓 Student / College' },
    { value: 'entertainment', label: '🎬 Entertainment / Media' },
  ],
  headphones: [
    { value: 'music', label: '🎵 Music Listening' },
    { value: 'gaming', label: '🎮 Gaming' },
    { value: 'travel', label: '✈️ Travel / Commute' },
    { value: 'fitness', label: '🏃 Fitness / Gym' },
    { value: 'office', label: '💼 Work Calls' },
  ],
  television: [
    { value: 'entertainment', label: '🎬 Movies & Streaming' },
    { value: 'gaming', label: '🎮 Console Gaming' },
    { value: 'home', label: '🏠 Family / Daily Use' },
    { value: 'sports', label: '⚽ Sports Viewing' },
  ],
  appliances: [
    { value: 'home', label: '🏠 Family / Daily Use' },
    { value: 'energy_efficient', label: '⚡ Energy Saving' },
    { value: 'smart', label: '📱 Smart / App Control' },
  ],
  watch: [
    { value: 'fitness', label: '🏃 Fitness Tracking' },
    { value: 'office', label: '💼 Professional' },
    { value: 'fashion', label: '✨ Style / Fashion' },
  ],
  tablet: [
    { value: 'student', label: '🎓 Studies / Notes' },
    { value: 'entertainment', label: '🎬 Entertainment' },
    { value: 'office', label: '💼 Work / Productivity' },
    { value: 'creative', label: '🎨 Drawing / Creative' },
  ],
  camera: [
    { value: 'photography', label: '📷 Photography' },
    { value: 'vlogging', label: '🎥 Vlogging / YouTube' },
    { value: 'travel', label: '✈️ Travel' },
    { value: 'professional', label: '👔 Professional' },
  ],
  speaker: [
    { value: 'music', label: '🎵 Music' },
    { value: 'travel', label: '🏖️ Outdoor / Portable' },
    { value: 'home', label: '🏠 Home Theater' },
    { value: 'party', label: '🎉 Party' },
  ],
  stationery: [
    { value: 'student', label: '🎓 School / College' },
    { value: 'office', label: '💼 Office' },
    { value: 'creative', label: '🎨 Art / Drawing' },
  ],
};

// ── Category-specific feature options ────────────────────────────────────────

const FEATURE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  phone: [
    { value: '5g', label: '5G Connectivity' },
    { value: 'fast_charging', label: 'Fast Charging' },
    { value: 'display', label: 'Great Display (AMOLED/120Hz)' },
    { value: 'waterproof', label: 'Waterproof' },
    { value: 'storage', label: 'Large Storage' },
  ],
  laptop: [
    { value: 'lightweight', label: 'Lightweight & Portable' },
    { value: 'gpu', label: 'Dedicated GPU' },
    { value: 'battery', label: 'Long Battery Life' },
    { value: 'display', label: 'Great Display' },
    { value: 'storage', label: 'Fast SSD Storage' },
  ],
  headphones: [
    { value: 'anc', label: 'Noise Cancellation (ANC)' },
    { value: 'wireless', label: 'Wireless / Bluetooth' },
    { value: 'battery', label: 'Long Battery' },
    { value: 'waterproof', label: 'Sweat / Water Resistant' },
  ],
  television: [
    { value: '4k', label: '4K Ultra HD' },
    { value: 'smart', label: 'Smart TV Features' },
    { value: 'display', label: 'OLED / QLED Panel' },
    { value: 'large_screen', label: 'Large Screen (55"+)' },
  ],
  appliances: [
    { value: 'inverter', label: 'Inverter Technology' },
    { value: 'energy_efficient', label: '5-Star Energy Rating' },
    { value: 'smart', label: 'Smart / App Control' },
  ],
};

/**
 * Contextual feature question — varies based on category and already-known intent.
 * Phase 6: simulates LLM-like awareness of what was already said.
 */
const CONTEXTUAL_FEATURE_QUESTIONS: Array<{
  match: (intent: ParsedIntent) => boolean;
  question: string;
  options: { value: string; label: string }[];
}> = [
  // Phone: no use-case detected — ask what matters most (camera vs battery)
  {
    match: (i) => i.category === 'phone' && !i.use_case && i.features.length === 0,
    question: "What's your top priority for the phone?",
    options: [
      { value: 'photography', label: '📷 Camera Quality' },
      { value: 'battery', label: '🔋 Long Battery Life' },
      { value: 'gaming', label: '🎮 Gaming Performance' },
      { value: 'display', label: '✨ Great Display' },
      { value: 'general', label: '🤷 Balanced / General Use' },
    ],
  },
  // Phone: camera identified — selfie vs rear camera
  {
    match: (i) =>
      i.category === 'phone' && (i.use_case === 'photography' || i.features.includes('camera')),
    question: 'Which camera matters more to you?',
    options: [
      { value: 'camera', label: '📷 Rear Camera (48MP+, OIS)' },
      { value: 'selfie', label: '🤳 Front / Selfie Camera' },
      { value: 'video', label: '🎥 Video Quality (4K/Stabilization)' },
      { value: 'all_round', label: '⚖️ All-round Camera System' },
    ],
  },
  // Laptop: no use-case — portability vs performance
  {
    match: (i) => i.category === 'laptop' && !i.use_case && i.features.length === 0,
    question: "What's most important in your laptop?",
    options: [
      { value: 'gaming', label: '🎮 Gaming / High Performance' },
      { value: 'travel', label: '🏋️ Thin & Light / Portability' },
      { value: 'coding', label: '💻 Programming / Development' },
      { value: 'student', label: '🎓 Study / Everyday Use' },
      { value: 'office', label: '💼 Office / Business Work' },
    ],
  },
  // Laptops: gaming detected — resolution vs refresh rate
  {
    match: (i) => i.category === 'laptop' && i.use_case === 'gaming',
    question: 'For gaming, what do you prioritize?',
    options: [
      { value: 'gpu', label: '🖥️ Powerful GPU (RTX 4060+)' },
      { value: 'display', label: '⚡ High Refresh Rate (144Hz+)' },
      { value: 'battery', label: '🔋 Longer Battery Life' },
      { value: 'lightweight', label: '🏋️ Lighter Weight' },
    ],
  },
  // Headphones: no use-case — ask ANC vs sound quality
  {
    match: (i) => i.category === 'headphones' && !i.use_case && i.features.length === 0,
    question: 'Which headphone feature matters most?',
    options: [
      { value: 'anc', label: '🔇 Active Noise Cancellation' },
      { value: 'music', label: '🎵 Sound Quality (Bass / LDAC)' },
      { value: 'battery', label: '🔋 Long Battery (30hrs+)' },
      { value: 'fitness', label: '🏃 Sweat-Proof / Sports' },
      { value: 'calls', label: '📞 Call Quality / Mic' },
    ],
  },
];

// ── Question Generator ───────────────────────────────────────────────────────

export function generateQuestions(
  intent: ParsedIntent,
  dbData?: QuestionDBData
): ClarifyingQuestion[] {
  const questions: ClarifyingQuestion[] = [];
  const cat = intent.category || 'phone'; // default if no category detected

  // Phase 6: For phones, prioritize use_case question (drives product selection more)
  // For other categories, keep the original order: budget → brand → use_case
  const isPhone = cat === 'phone';

  // 1. Budget question — if budget not detected
  if (!intent.budget && questions.length < MAX_QUESTIONS) {
    // Use real DB price stats when available; fall back to category-aware generic range.
    // No synthetic catalog data used — generic defaults are preferable to hardcoded fake prices.
    const priceRange =
      dbData?.priceRange && dbData.priceRange.max > 0
        ? dbData.priceRange
        : getGenericPriceRange(cat);
    const budgetOpts = buildBudgetOptions(priceRange.min, priceRange.max, dbData?.priceRange);
    questions.push({
      id: 'q1',
      question: `What's your budget range for a ${formatCategoryName(cat)}?`,
      type: 'multiple_choice',
      options: budgetOpts,
      category: 'budget',
      required: false,
      reason: 'Budget not detected in query',
    });
  }

  // 2a. Use case question first for phones (before brand — more useful signal)
  if (isPhone && !intent.use_case && questions.length < MAX_QUESTIONS) {
    // Check if a contextual feature question already covers this
    const ctxQ = CONTEXTUAL_FEATURE_QUESTIONS.find((cq) => cq.match(intent));
    if (ctxQ) {
      questions.push({
        id: `q${questions.length + 1}`,
        question: ctxQ.question,
        type: 'multiple_choice',
        options: ctxQ.options,
        category: 'use_case',
        required: false,
        reason: 'Contextual priority question for phone category',
      });
    } else {
      const opts = USE_CASE_OPTIONS[cat] || USE_CASE_OPTIONS['phone'];
      questions.push({
        id: `q${questions.length + 1}`,
        question: `What will you primarily use this ${formatCategoryName(cat)} for?`,
        type: 'multiple_choice',
        options: [...opts, { value: 'general', label: '🤷 General / No specific use' }],
        category: 'use_case',
        required: false,
        reason: 'Use case not detected in query',
      });
    }
  }

  // 2b. Brand question — if brand not detected (skip for phones when we already asked use_case above)
  if (!intent.brand && questions.length < MAX_QUESTIONS && !isPhone) {
    // Use real DB brands when available; use generic options when DB data is absent.
    // No synthetic catalog fallback — show generic options rather than hardcoded fake brand lists.
    const topBrands = dbData?.brands && dbData.brands.length > 0 ? dbData.brands.slice(0, 8) : [];
    const brandOpts = [
      ...topBrands.map((b) => ({ value: b.toLowerCase().replace(/[\s&']+/g, '_'), label: b })),
      { value: 'other', label: 'Other (type below)' },
      { value: 'any', label: 'No preference' },
    ];
    questions.push({
      id: `q${questions.length + 1}`,
      question: `Do you prefer a specific ${formatCategoryName(cat)} brand?`,
      type: 'multiple_choice',
      options: brandOpts,
      category: 'brand',
      required: false,
      reason: 'Brand not detected in query',
    });
  }

  // 3. Use case question for non-phone categories
  if (!isPhone && !intent.use_case && questions.length < MAX_QUESTIONS) {
    const opts = USE_CASE_OPTIONS[cat] || USE_CASE_OPTIONS['phone'];
    questions.push({
      id: `q${questions.length + 1}`,
      question: `What will you primarily use this ${formatCategoryName(cat)} for?`,
      type: 'multiple_choice',
      options: [...opts, { value: 'general', label: '🤷 General / No specific use' }],
      category: 'use_case',
      required: false,
      reason: 'Use case not detected in query',
    });
  }

  // 4. Contextual feature question — smarter than plain feature list (Phase 6)
  if (intent.features.length === 0 && questions.length < MAX_QUESTIONS) {
    const ctxQ = CONTEXTUAL_FEATURE_QUESTIONS.find((cq) => cq.match(intent));
    if (ctxQ && !questions.some((q) => q.question === ctxQ.question)) {
      questions.push({
        id: `q${questions.length + 1}`,
        question: ctxQ.question,
        type: 'multiple_choice',
        options: ctxQ.options,
        category: 'feature',
        required: false,
        reason: 'Contextual feature question based on category + detected intent',
      });
    } else {
      const featureOpts = FEATURE_OPTIONS[cat];
      if (featureOpts) {
        questions.push({
          id: `q${questions.length + 1}`,
          question: `Which feature matters most to you?`,
          type: 'multiple_choice',
          options: [...featureOpts, { value: 'none', label: "Doesn't matter" }],
          category: 'feature',
          required: false,
          reason: 'No specific features detected in query',
        });
      }
    }
  }

  // 5. Safety net: when the intent is fully specified (budget + brand + use_case + features
  //    all detected), the generator would return 0 questions which leaves the pipeline with
  //    nothing to show when the DB is also empty.  Always ask at least one refinement question
  //    so the user can narrow results further OR so we have something to display.
  if (questions.length === 0) {
    questions.push({
      id: 'q1',
      question: `What matters most to you in this ${formatCategoryName(cat)}?`,
      type: 'multiple_choice',
      options: [
        { value: 'value_for_money', label: '💰 Best Value for Money' },
        { value: 'top_rated', label: '⭐ Top Rated / Most Reviewed' },
        { value: 'latest_model', label: '🆕 Latest Model' },
        { value: 'fast_delivery', label: '🚚 Fast Delivery' },
        { value: 'warranty', label: '🛡️ Good Warranty / After-Sales' },
      ],
      category: 'feature',
      required: false,
      reason:
        'Refinement question — intent fully specified, ensuring at least one question is shown',
    });
  }

  // Cap at MAX_QUESTIONS
  return questions.slice(0, MAX_QUESTIONS);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a sensible generic price range per category when no real DB data is
 * available.  Ranges are wide to avoid cutting out products; the DB-backed range
 * is always preferred when available.
 */
function getGenericPriceRange(cat: string): DBPriceRange {
  const ranges: Record<string, DBPriceRange> = {
    phone: { min: 5000, max: 200000, p25: 12000, p50: 25000, p75: 60000 },
    laptop: { min: 20000, max: 300000, p25: 40000, p50: 70000, p75: 130000 },
    headphones: { min: 500, max: 50000, p25: 1500, p50: 5000, p75: 18000 },
    television: { min: 15000, max: 200000, p25: 25000, p50: 45000, p75: 80000 },
    appliances: { min: 5000, max: 150000, p25: 12000, p50: 30000, p75: 60000 },
    watch: { min: 1000, max: 80000, p25: 2500, p50: 10000, p75: 30000 },
    tablet: { min: 8000, max: 120000, p25: 15000, p50: 30000, p75: 60000 },
    camera: { min: 15000, max: 400000, p25: 30000, p50: 70000, p75: 160000 },
    speaker: { min: 500, max: 30000, p25: 1000, p50: 3000, p75: 10000 },
    stationery: { min: 30, max: 1000, p25: 80, p50: 200, p75: 500 },
    groceries: { min: 30, max: 2000, p25: 80, p50: 250, p75: 600 },
    fashion: { min: 300, max: 20000, p25: 700, p50: 2000, p75: 6000 },
    sports: { min: 300, max: 50000, p25: 800, p50: 3000, p75: 12000 },
    books: { min: 100, max: 2000, p25: 200, p50: 400, p75: 800 },
    furniture: { min: 2000, max: 100000, p25: 5000, p50: 15000, p75: 40000 },
  };
  return ranges[cat] ?? { min: 500, max: 200000, p25: 5000, p50: 20000, p75: 60000 };
}

function formatCategoryName(cat: string): string {
  const names: Record<string, string> = {
    phone: 'phone',
    laptop: 'laptop',
    headphones: 'headphones',
    television: 'TV',
    appliances: 'appliance',
    watch: 'smartwatch',
    tablet: 'tablet',
    camera: 'camera',
    speaker: 'speaker',
    stationery: 'stationery item',
  };
  return names[cat] || cat;
}

function buildBudgetOptions(
  minPrice: number,
  maxPrice: number,
  percentiles?: DBPriceRange
): { value: string; label: string }[] {
  const fmt = (n: number) => {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
    return `₹${n}`;
  };

  if (maxPrice <= 500) {
    return [
      { value: `0_${Math.ceil(maxPrice * 0.3)}`, label: `Under ${fmt(Math.ceil(maxPrice * 0.3))}` },
      {
        value: `${Math.ceil(maxPrice * 0.3)}_${Math.ceil(maxPrice * 0.6)}`,
        label: `${fmt(Math.ceil(maxPrice * 0.3))} – ${fmt(Math.ceil(maxPrice * 0.6))}`,
      },
      {
        value: `${Math.ceil(maxPrice * 0.6)}_${maxPrice * 2}`,
        label: `${fmt(Math.ceil(maxPrice * 0.6))}+`,
      },
      { value: 'other', label: 'Other (type below)' },
    ];
  }

  // Quartile-based tiers — prefer real DB percentiles when available
  const q1 =
    percentiles?.p25 && percentiles.p25 > 0
      ? percentiles.p25
      : Math.round(minPrice + (maxPrice - minPrice) * 0.25);
  const q2 =
    percentiles?.p50 && percentiles.p50 > 0
      ? percentiles.p50
      : Math.round(minPrice + (maxPrice - minPrice) * 0.5);
  const q3 =
    percentiles?.p75 && percentiles.p75 > 0
      ? percentiles.p75
      : Math.round(minPrice + (maxPrice - minPrice) * 0.75);

  return [
    { value: `0_${q1}`, label: `Under ${fmt(q1)}` },
    { value: `${q1}_${q2}`, label: `${fmt(q1)} – ${fmt(q2)}` },
    { value: `${q2}_${q3}`, label: `${fmt(q2)} – ${fmt(q3)}` },
    { value: `${q3}_${Math.ceil(maxPrice * 1.5)}`, label: `${fmt(q3)}+` },
    { value: 'other', label: 'Other (type below)' },
  ];
}
