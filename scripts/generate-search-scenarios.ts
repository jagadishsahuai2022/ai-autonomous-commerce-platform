/**
 * Search Scenario Generator — 1000+ Real-World Queries
 *
 * Generates a comprehensive set of search scenarios covering:
 * - Budget queries (phone under 20000)
 * - Brand queries (allen solly jeans)
 * - Feature queries (good camera phone)
 * - Use-case queries (gaming laptop for coding)
 * - Category queries (running shoes)
 * - Mixed queries (nike shoes under 5000)
 *
 * Usage: npx tsx scripts/generate-search-scenarios.ts
 * Output: scripts/search-scenarios.json
 */

import * as fs from 'fs';
import * as path from 'path';

interface SearchScenario {
  id: number;
  query: string;
  expectedCategory: string;
  expectedBrand?: string;
  expectedPriceMax?: number;
  expectedPriceMin?: number;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'budget' | 'brand' | 'feature' | 'use_case' | 'category' | 'mixed' | 'natural';
}

// ── Templates ────────────────────────────────────────────────────────────────

const BUDGET_TEMPLATES = [
  { q: '{category} under {price}', type: 'budget' as const },
  { q: '{category} below {price}', type: 'budget' as const },
  { q: 'best {category} under {price}', type: 'budget' as const },
  { q: 'cheap {category}', type: 'budget' as const },
  { q: 'affordable {category}', type: 'budget' as const },
  { q: '{category} price range {minPrice} to {maxPrice}', type: 'budget' as const },
  { q: 'budget {category} for daily use', type: 'budget' as const },
];

const BRAND_TEMPLATES = [
  { q: '{brand} {category}', type: 'brand' as const },
  { q: '{brand} {subcategory}', type: 'brand' as const },
  { q: 'best {brand} {category}', type: 'brand' as const },
  { q: '{brand} latest {category}', type: 'brand' as const },
  { q: 'new {brand} {subcategory}', type: 'brand' as const },
];

const FEATURE_TEMPLATES = [
  { q: 'good {feature} {category}', type: 'feature' as const },
  { q: '{category} with {feature}', type: 'feature' as const },
  { q: 'best {feature} {category}', type: 'feature' as const },
  { q: '{category} for {use_case}', type: 'use_case' as const },
  { q: '{use_case} {category}', type: 'use_case' as const },
];

const NATURAL_TEMPLATES = [
  { q: 'i need a {category} for {use_case}', type: 'natural' as const },
  { q: 'looking for {brand} {category}', type: 'natural' as const },
  { q: 'suggest me a good {category}', type: 'natural' as const },
  { q: 'which {category} is best for {use_case}', type: 'natural' as const },
  { q: 'show me {category} under {price}', type: 'natural' as const },
];

// ── Data ──────────────────────────────────────────────────────────────────────

const CATEGORIES: Record<
  string,
  {
    terms: string[];
    brands: string[];
    features: string[];
    useCases: string[];
    pricePoints: number[];
    subcategories: string[];
  }
> = {
  phone: {
    terms: ['phone', 'mobile', 'smartphone'],
    brands: [
      'Samsung',
      'Apple',
      'OnePlus',
      'Xiaomi',
      'Realme',
      'Vivo',
      'Oppo',
      'Google',
      'Nothing',
      'Motorola',
      'iQOO',
      'POCO',
    ],
    features: [
      'camera',
      'battery',
      '5G',
      'AMOLED',
      'fast charging',
      'gaming',
      'slim',
      'waterproof',
    ],
    useCases: ['gaming', 'photography', 'daily use', 'business', 'students', 'video calling'],
    pricePoints: [10000, 15000, 20000, 25000, 30000, 50000, 80000, 100000],
    subcategories: ['5G phone', 'camera phone', 'gaming phone', 'budget phone'],
  },
  laptop: {
    terms: ['laptop', 'notebook', 'ultrabook'],
    brands: ['Dell', 'HP', 'Lenovo', 'ASUS', 'Acer', 'MSI', 'Apple', 'Samsung'],
    features: ['lightweight', 'touchscreen', 'SSD', '16GB RAM', 'RTX GPU', 'backlit keyboard'],
    useCases: ['gaming', 'coding', 'office', 'students', 'video editing', 'graphic design'],
    pricePoints: [30000, 40000, 50000, 60000, 80000, 100000, 150000],
    subcategories: ['gaming laptop', 'ultrabook', 'chromebook', 'business laptop'],
  },
  headphones: {
    terms: ['headphones', 'earphones', 'earbuds', 'TWS', 'neckband'],
    brands: ['Sony', 'Bose', 'JBL', 'Sennheiser', 'boAt', 'Noise', 'Audio-Technica', 'Samsung'],
    features: ['ANC', 'wireless', 'noise cancelling', 'bass', 'long battery', 'waterproof'],
    useCases: ['music', 'gaming', 'workout', 'office calls', 'commute', 'running'],
    pricePoints: [500, 1000, 2000, 3000, 5000, 10000, 20000, 30000],
    subcategories: ['TWS earbuds', 'over-ear headphones', 'neckband', 'gaming headset'],
  },
  fashion: {
    terms: ['clothes', 'clothing', 'shirt', 'jeans', 't-shirt', 'kurta', 'dress'],
    brands: [
      'Allen Solly',
      'Van Heusen',
      'Peter England',
      'H&M',
      'Zara',
      "Levi's",
      'US Polo',
      'Tommy Hilfiger',
      'Raymond',
      'Arrow',
    ],
    features: ['cotton', 'slim fit', 'formal', 'casual', 'breathable', 'wrinkle-free'],
    useCases: ['office', 'casual', 'party', 'wedding', 'daily wear', 'fitness'],
    pricePoints: [500, 1000, 1500, 2000, 3000, 5000, 8000],
    subcategories: ['jeans', 'shirt', 't-shirt', 'kurta', 'jacket', 'trousers', 'dress'],
  },
  footwear: {
    terms: ['shoes', 'footwear', 'sneakers', 'sandals'],
    brands: ['Nike', 'Adidas', 'Puma', 'Reebok', 'Skechers', 'Bata', 'Woodland', 'New Balance'],
    features: ['cushioned', 'lightweight', 'waterproof', 'breathable', 'arch support'],
    useCases: ['running', 'walking', 'gym', 'formal', 'casual', 'hiking', 'trekking'],
    pricePoints: [1000, 2000, 3000, 5000, 8000, 15000],
    subcategories: [
      'running shoes',
      'formal shoes',
      'sneakers',
      'sandals',
      'boots',
      'sports shoes',
    ],
  },
  appliances: {
    terms: ['washing machine', 'refrigerator', 'AC', 'air conditioner', 'microwave'],
    brands: ['Samsung', 'LG', 'Whirlpool', 'Bosch', 'IFB', 'Haier', 'Godrej', 'Voltas', 'Daikin'],
    features: ['inverter', '5 star', 'smart', 'front load', 'energy efficient', 'frost free'],
    useCases: ['small family', 'large family', 'bachelor', 'office'],
    pricePoints: [10000, 15000, 20000, 25000, 30000, 50000, 80000],
    subcategories: [
      'washing machine',
      'refrigerator',
      'air conditioner',
      'microwave',
      'dishwasher',
    ],
  },
  watches: {
    terms: ['watch', 'wristwatch', 'smartwatch'],
    brands: ['Titan', 'Fossil', 'Casio', 'Seiko', 'Fastrack', 'Apple', 'Samsung', 'Noise'],
    features: ['analog', 'digital', 'smart', 'waterproof', 'chronograph', 'GPS'],
    useCases: ['daily wear', 'sports', 'formal', 'fitness tracking', 'diving'],
    pricePoints: [1000, 2000, 5000, 10000, 20000, 50000],
    subcategories: ['analog watch', 'smartwatch', 'digital watch', 'luxury watch'],
  },
  furniture: {
    terms: ['sofa', 'bed', 'table', 'chair', 'desk', 'wardrobe'],
    brands: ['Ikea', 'Durian', 'Nilkamal', 'Urban Ladder', 'Wakefit', 'Pepperfry'],
    features: ['wooden', 'metal', 'recliner', 'storage', 'foldable', 'ergonomic'],
    useCases: ['living room', 'bedroom', 'office', 'study room', 'small space'],
    pricePoints: [5000, 10000, 15000, 25000, 50000, 80000],
    subcategories: ['sofa', 'bed', 'dining table', 'office chair', 'bookshelf', 'tv unit'],
  },
  books: {
    terms: ['book', 'novel', 'textbook'],
    brands: ['Penguin', 'HarperCollins', 'Oxford', 'Pearson', 'Arihant', 'Scholastic'],
    features: ['bestseller', 'hardcover', 'illustrated', 'new release'],
    useCases: ['exam prep', 'fiction', 'self-help', 'reference', 'children'],
    pricePoints: [200, 500, 1000, 2000],
    subcategories: ['novel', 'textbook', 'self-help book', "children's book", 'cookbook'],
  },
  sports: {
    terms: ['sports equipment', 'fitness', 'gym equipment'],
    brands: ['Yonex', 'Cosco', 'Nivia', 'Adidas', 'Nike', 'Decathlon'],
    features: ['lightweight', 'professional', 'durable', 'adjustable'],
    useCases: ['home gym', 'professional', 'beginner', 'training', 'competition'],
    pricePoints: [500, 1000, 2000, 5000, 10000, 20000],
    subcategories: ['cricket bat', 'badminton racket', 'dumbbells', 'yoga mat', 'treadmill'],
  },
};

// ── Generator ─────────────────────────────────────────────────────────────────

function generateScenarios(): SearchScenario[] {
  const scenarios: SearchScenario[] = [];
  let id = 1;

  for (const [catKey, catData] of Object.entries(CATEGORIES)) {
    // Budget queries
    for (const price of catData.pricePoints) {
      for (const term of catData.terms.slice(0, 2)) {
        scenarios.push({
          id: id++,
          query: `${term} under ${price}`,
          expectedCategory: catKey,
          expectedPriceMax: price,
          difficulty: 'easy',
          type: 'budget',
        });
        scenarios.push({
          id: id++,
          query: `best ${term} under ${price}`,
          expectedCategory: catKey,
          expectedPriceMax: price,
          difficulty: 'easy',
          type: 'budget',
        });
      }
    }

    // Brand queries
    for (const brand of catData.brands) {
      for (const term of catData.terms.slice(0, 2)) {
        scenarios.push({
          id: id++,
          query: `${brand} ${term}`,
          expectedCategory: catKey,
          expectedBrand: brand,
          difficulty: 'easy',
          type: 'brand',
        });
      }
      // Brand + subcategory
      for (const sub of catData.subcategories.slice(0, 3)) {
        scenarios.push({
          id: id++,
          query: `${brand} ${sub}`,
          expectedCategory: catKey,
          expectedBrand: brand,
          difficulty: 'medium',
          type: 'brand',
        });
      }
    }

    // Feature queries
    for (const feature of catData.features) {
      for (const term of catData.terms.slice(0, 1)) {
        scenarios.push({
          id: id++,
          query: `${term} with ${feature}`,
          expectedCategory: catKey,
          difficulty: 'medium',
          type: 'feature',
        });
        scenarios.push({
          id: id++,
          query: `best ${feature} ${term}`,
          expectedCategory: catKey,
          difficulty: 'medium',
          type: 'feature',
        });
      }
    }

    // Use-case queries
    for (const useCase of catData.useCases) {
      for (const term of catData.terms.slice(0, 1)) {
        scenarios.push({
          id: id++,
          query: `${term} for ${useCase}`,
          expectedCategory: catKey,
          difficulty: 'medium',
          type: 'use_case',
        });
      }
    }

    // Mixed: brand + budget
    for (const brand of catData.brands.slice(0, 3)) {
      for (const price of catData.pricePoints.slice(0, 3)) {
        const term = catData.terms[0];
        scenarios.push({
          id: id++,
          query: `${brand} ${term} under ${price}`,
          expectedCategory: catKey,
          expectedBrand: brand,
          expectedPriceMax: price,
          difficulty: 'hard',
          type: 'mixed',
        });
      }
    }

    // Natural language
    for (const useCase of catData.useCases.slice(0, 2)) {
      scenarios.push({
        id: id++,
        query: `i need a ${catData.terms[0]} for ${useCase}`,
        expectedCategory: catKey,
        difficulty: 'hard',
        type: 'natural',
      });
      scenarios.push({
        id: id++,
        query: `suggest me a good ${catData.terms[0]}`,
        expectedCategory: catKey,
        difficulty: 'hard',
        type: 'natural',
      });
    }

    // Subcategory-only queries
    for (const sub of catData.subcategories) {
      scenarios.push({
        id: id++,
        query: sub,
        expectedCategory: catKey,
        difficulty: 'easy',
        type: 'category',
      });
    }
  }

  return scenarios;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const scenarios = generateScenarios();
const outPath = path.join(__dirname, 'search-scenarios.json');
fs.writeFileSync(outPath, JSON.stringify(scenarios, null, 2));

console.log(`✅ Generated ${scenarios.length} search scenarios`);
console.log(`📄 Output: ${outPath}\n`);

// Summary by type
const byType: Record<string, number> = {};
const byCat: Record<string, number> = {};
for (const s of scenarios) {
  byType[s.type] = (byType[s.type] || 0) + 1;
  byCat[s.expectedCategory] = (byCat[s.expectedCategory] || 0) + 1;
}
console.log('By type:', byType);
console.log('By category:', byCat);
