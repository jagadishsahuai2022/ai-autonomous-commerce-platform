import { NextRequest, NextResponse } from 'next/server';
import { findLearnedResponse, insertSmartIntentRecord } from '@/lib/db';

// ── Product catalog index (mirrors MOCK_CATALOG from products API) ──────────
// Kept in sync so the AI assistant can do generic keyword search without AI inference costs
interface CatalogEntry {
  category: string;
  subCat: string;
  brands: string[];
  names: string[];
  prices: number[];
}

const CATALOG: CatalogEntry[] = [
  {
    category: 'Electronics',
    subCat: 'Smartphones',
    brands: [
      'Apple',
      'Samsung',
      'OnePlus',
      'Xiaomi',
      'Realme',
      'Vivo',
      'Oppo',
      'iQOO',
      'Nothing',
      'Motorola',
    ],
    names: [
      '15 Pro Max',
      'Galaxy S24 Ultra',
      '12 Pro',
      '14 Ultra',
      '12 Pro+',
      'V30',
      'Find X7',
      'Neo 9',
      'Phone 2',
      'Edge 50',
    ],
    prices: [139999, 129999, 79999, 59999, 34999, 36999, 59999, 29999, 34999, 29999],
  },
  {
    category: 'Electronics',
    subCat: 'Laptops',
    brands: ['Dell', 'HP', 'Lenovo', 'Apple', 'ASUS', 'Acer', 'MSI', 'LG', 'Razer', 'Surface'],
    names: [
      'XPS 15',
      'Spectre x360',
      'ThinkPad X1',
      'MacBook Pro 16"',
      'VivoBook 15',
      'Swift 5',
      'Prestige 16',
      'Gram 16',
      'Blade 16',
      'Pro 9',
    ],
    prices: [189999, 149999, 129999, 249999, 89999, 79999, 159999, 139999, 229999, 179999],
  },
  {
    category: 'Electronics',
    subCat: 'Headphones',
    brands: [
      'Sony',
      'boAt',
      'JBL',
      'Sennheiser',
      'Bose',
      'Noise',
      'Jabra',
      'Skullcandy',
      'Audio-Technica',
      'Beyerdynamic',
    ],
    names: [
      'WH-1000XM5',
      'Airdopes 141',
      'Tune 150',
      'HD 560S',
      'QuietComfort 45',
      'Buds Pro',
      'Elite 85t',
      'Crusher Evo',
      'M50xBT',
      'DT 770 Pro',
    ],
    prices: [24999, 1299, 1449, 7999, 24999, 2999, 14999, 7999, 9499, 12999],
  },
  {
    category: 'Electronics',
    subCat: 'Smart Watches',
    brands: [
      'Apple',
      'Samsung',
      'boAt',
      'Noise',
      'Amazfit',
      'Garmin',
      'Fossil',
      'Huawei',
      'Fitbit',
      'Oppo',
    ],
    names: [
      'Watch Series 9',
      'Galaxy Watch 6',
      'Wave Pro',
      'Colorfit Pro 4',
      'GTR 4',
      'Vivoactive 5',
      'Gen 6',
      'GT 4',
      'Sense 2',
      'Watch X',
    ],
    prices: [49999, 24999, 2499, 1999, 12999, 19999, 17999, 14999, 14999, 9999],
  },
  {
    category: 'Electronics',
    subCat: 'Tablets',
    brands: [
      'Apple',
      'Samsung',
      'Lenovo',
      'Realme',
      'OnePlus',
      'Xiaomi',
      'Motorola',
      'TCL',
      'Amazon',
      'Nokia',
    ],
    names: [
      'iPad Pro 12.9"',
      'Galaxy Tab S9',
      'Tab P12 Pro',
      'Pad X',
      'Pad Pro',
      'Pad 6',
      'Tab G62',
      'NXTPAPER 10s',
      'Fire HD 10',
      'T20',
    ],
    prices: [89999, 74999, 34999, 24999, 29999, 22999, 14999, 12999, 9999, 8999],
  },
  {
    category: 'Electronics',
    subCat: 'Cameras',
    brands: [
      'Canon',
      'Nikon',
      'Sony',
      'Fujifilm',
      'GoPro',
      'Panasonic',
      'OM System',
      'Leica',
      'DJI',
      'Ricoh',
    ],
    names: [
      'EOS R50',
      'Z5 II',
      'Alpha a7 IV',
      'X-T5',
      'Hero 12',
      'Lumix G9',
      'OM-5',
      'Q3',
      'Osmo Pocket 3',
      'GR III',
    ],
    prices: [59999, 79999, 179999, 149999, 36999, 74999, 74999, 349999, 44999, 89999],
  },
  {
    category: 'Electronics',
    subCat: 'Televisions',
    brands: [
      'Samsung',
      'LG',
      'Sony',
      'OnePlus',
      'Mi',
      'TCL',
      'Hisense',
      'Vu',
      'Panasonic',
      'Philips',
    ],
    names: [
      '55" QLED 4K Smart TV',
      'OLED C3 55" 4K',
      'Bravia XR 55" OLED',
      'Q2 Pro 55" QLED',
      'TV 5X 55" 4K',
      '55P745 4K QLED',
      '55U6K 4K UHD',
      '65" 4K Smart TV',
      'TX-55JX740B 4K',
      '55PUS8518 4K',
    ],
    prices: [55990, 109990, 89990, 44999, 39999, 42999, 38999, 49999, 59999, 47999],
  },
  {
    category: 'Electronics',
    subCat: 'Air Purifiers',
    brands: [
      'Dyson',
      'Philips',
      'Mi',
      'Honeywell',
      'BlueAir',
      'Sharp',
      'Coway',
      'Eureka Forbes',
      'Havells',
      'IFB',
    ],
    names: [
      'Pure Cool Link',
      'AC2887',
      'Air Purifier 3C',
      'Air Touch i8',
      'Blue Pure 211+',
      'FP-J80M',
      'Mighty 200M',
      'DRE Series',
      'Freshia',
      'Aroma',
    ],
    prices: [44999, 14999, 10999, 17999, 22999, 19999, 15999, 12999, 8999, 9999],
  },
  {
    category: 'Electronics',
    subCat: 'Refrigerators',
    brands: [
      'Samsung',
      'LG',
      'Whirlpool',
      'Haier',
      'Godrej',
      'Bosch',
      'Panasonic',
      'Siemens',
      'Hitachi',
      'Liebherr',
    ],
    names: [
      '256L 3 Star',
      '470L Frost Free',
      '338L MultiDoor',
      '320L Side by Side',
      '190L Single Door',
      '559L French Door',
      '300L Double Door',
      '630L Multi Door',
      '415L 3 Star',
      '509L BioCool',
    ],
    prices: [22999, 49999, 34999, 44999, 14999, 74999, 29999, 99999, 39999, 84999],
  },
  {
    category: 'Groceries',
    subCat: 'Staples',
    brands: [
      'India Gate',
      'Daawat',
      'Tata Sampann',
      'Fortune',
      'Aashirvaad',
      'Saffola',
      'Patanjali',
      'Organic India',
      'ITC',
      'Vedaka',
    ],
    names: [
      'Basmati Rice 5kg',
      'Toor Dal 1kg',
      'Maida 1kg',
      'Sunflower Oil 1L',
      'Whole Wheat Atta 5kg',
      'Masala Oats 500g',
      'Desi Ghee 500g',
      'Green Tea 25 bags',
      'Eno 100g',
      'Brown Rice 1kg',
    ],
    prices: [249, 119, 60, 149, 249, 99, 399, 149, 79, 149],
  },
  {
    category: 'Groceries',
    subCat: 'Packaged Foods',
    brands: [
      'Maggi',
      "Haldiram's",
      "Lay's",
      'Britannia',
      'Parle',
      'ITC Sunfeast',
      'Amul',
      'Mother Dairy',
      'Nestle',
      "Kellogg's",
    ],
    names: [
      'Noodles 4-Pack',
      'Bhujia 400g',
      'Chips 52g',
      'Good Day 200g',
      'Monaco 100g',
      'Dark Fantasy 300g',
      'Butter 500g',
      'Milk 1L',
      'KitKat Box',
      'Corn Flakes 875g',
    ],
    prices: [70, 99, 30, 55, 35, 115, 270, 70, 199, 299],
  },
  {
    category: 'Groceries',
    subCat: 'Personal Care',
    brands: [
      'Dove',
      'Himalaya',
      'Lotus Herbals',
      'Biotique',
      'Lakme',
      'Olay',
      'Garnier',
      'Pantene',
      'Head & Shoulders',
      'Clinic Plus',
    ],
    names: [
      'Moisturizing Bar 3-Pack',
      'Face Wash 150ml',
      'Sunscreen SPF50',
      'Day Cream 50g',
      'Day Cream',
      'Total Effects',
      'Micellar Water',
      'Shampoo 1L',
      'Anti Dandruff 400ml',
      'Shampoo 340ml',
    ],
    prices: [120, 159, 199, 299, 349, 799, 449, 399, 349, 199],
  },
  {
    category: 'Fashion',
    subCat: "Men's Clothing",
    brands: [
      "Levi's",
      'H&M',
      'Zara',
      'Allen Solly',
      'Peter England',
      'Louis Philippe',
      'Van Heusen',
      'Arrow',
      'Raymond',
      'Wrangler',
    ],
    names: [
      'Slim Fit Jeans',
      'Polo T-Shirt',
      'Casual Shirt',
      'Chinos',
      'Formal Trousers',
      'Blazer',
      'Suit Set',
      'Kurta',
      'Sweatshirt',
      'Hoodie',
    ],
    prices: [2999, 799, 1499, 1999, 2499, 4999, 9999, 1299, 1799, 2499],
  },
  {
    category: 'Fashion',
    subCat: "Women's Clothing",
    brands: [
      'Biba',
      'W',
      'Fabindia',
      'Libas',
      'Aurelia',
      'Zara',
      'H&M',
      'AND',
      'Label Life',
      'Nykaa Fashion',
    ],
    names: [
      'Anarkali Kurta',
      'Straight Kurta Set',
      'Palazzo Set',
      'Maxi Dress',
      'Floral Top',
      'Ethnic Saree',
      'Co-ord Set',
      'Jumpsuit',
      'Wrap Dress',
      'Formal Blazer',
    ],
    prices: [999, 1299, 1799, 1499, 799, 1999, 2499, 2999, 1999, 3499],
  },
  {
    category: 'Fashion',
    subCat: 'Footwear',
    brands: [
      'Nike',
      'Adidas',
      'Puma',
      'Reebok',
      'New Balance',
      'Skechers',
      'Bata',
      'Woodland',
      'Sparx',
      'Liberty',
    ],
    names: [
      'Air Max 270',
      'Ultraboost 23',
      'Velocity Nitro',
      'Nano X3',
      '574',
      "D'Lites",
      'Power Shoes',
      'Camel Boots',
      'Glider',
      'Force 10',
    ],
    prices: [8999, 9999, 7999, 7499, 8499, 5999, 2499, 3999, 1899, 2499],
  },
  {
    category: 'Home & Kitchen',
    subCat: 'Cookware',
    brands: [
      'Prestige',
      'Hawkins',
      'Meyer',
      'Pigeon',
      'Wonderchef',
      'Vinod',
      'TTK',
      'Butterfly',
      'Tefal',
      'Cello',
    ],
    names: [
      'Pressure Cooker 3L',
      'Kadai 28cm',
      'Non-Stick Pan Set',
      'Tawa 28cm',
      'Sauce Pan 16cm',
      'Casserole 2.5L',
      'Induction Cooktop',
      'Idli Maker 4 Plate',
      'Wok 28cm',
      'Dosa Tawa 30cm',
    ],
    prices: [1299, 1499, 3999, 899, 699, 1299, 2499, 699, 2499, 799],
  },
  {
    category: 'Home & Kitchen',
    subCat: 'Appliances',
    brands: [
      'Philips',
      'Bajaj',
      'Preethi',
      'Pigeon',
      'Inalsa',
      'Usha',
      'Havells',
      'Crompton',
      'Orient',
      'Bosch',
    ],
    names: [
      'Mixer Grinder 750W',
      'Juicer 500W',
      'Electric Kettle 1.5L',
      'Air Fryer 4.5L',
      'OTG 42L',
      'Hand Blender',
      'Room Heater',
      'Fan 1200mm',
      'Ceiling Fan White',
      'Dishwasher 12 Place',
    ],
    prices: [3499, 1499, 899, 5999, 6999, 1299, 3499, 1799, 2999, 29999],
  },
  {
    category: 'Home & Kitchen',
    subCat: 'Furniture',
    brands: [
      'Nilkamal',
      'Godrej',
      'Pepperfry',
      'IKEA',
      'Durian',
      'Zuari',
      'HomeTown',
      'Urban Ladder',
      'Evok',
      'Amazon Basics',
    ],
    names: [
      '3-Seater Sofa',
      'Dining Table 6-Seater',
      'King Bed Frame',
      'Wardrobe 3-Door',
      'Office Chair',
      'Bookshelf 5-Shelf',
      'Study Table',
      'Coffee Table',
      'TV Unit',
      'Shoe Rack',
    ],
    prices: [19999, 16999, 22999, 18999, 8999, 6999, 7999, 8999, 9999, 3999],
  },
  {
    category: 'Sports',
    subCat: 'Cricket',
    brands: [
      'SG',
      'SS',
      'MRF',
      'Kookaburra',
      'Gray-Nicolls',
      'GM',
      'Adidas',
      'Nike',
      'Puma',
      'Spartan',
    ],
    names: [
      'English Willow Bat',
      'Kashmir Willow Bat',
      'Tennis Ball 6-Pack',
      'Batting Gloves',
      'Helmet',
      'Batting Pads',
      'WK Gloves',
      'Cricket Shoes',
      'Kit Bag',
      'Player Kit',
    ],
    prices: [2999, 899, 299, 1499, 3499, 2499, 2499, 2999, 3999, 7999],
  },
  {
    category: 'Sports',
    subCat: 'Fitness',
    brands: [
      'Powermax',
      'Kore',
      'Cockatoo',
      'Welcare',
      'Viva Fitness',
      'Reach',
      'Lifeline',
      'Body Maxx',
      'Kamachi',
      'Gold Gym',
    ],
    names: [
      'Dumbbell Set 20kg',
      'Resistance Bands',
      'Yoga Mat 6mm',
      'Exercise Cycle',
      'Treadmill 3HP',
      'Pull-Up Bar',
      'Kettlebell 16kg',
      'Foam Roller',
      'Weight Bench',
      'Barbell Set',
    ],
    prices: [4999, 699, 799, 9999, 34999, 999, 3999, 1299, 7999, 5999],
  },
  {
    category: 'Books',
    subCat: 'Self Help & Business',
    brands: [
      'Penguin',
      'HarperCollins',
      'Westland',
      'Rupa',
      'Jaico',
      'Simon & Schuster',
      'Bloomsbury',
      'Pan Macmillan',
      'Hachette',
      'PRH India',
    ],
    names: [
      'Atomic Habits',
      'Zero to One',
      'The Lean Startup',
      'Rich Dad Poor Dad',
      'Deep Work',
      'Psychology of Money',
      'Think Like a Monk',
      'Ikigai',
      'The Alchemist',
      'Mindset',
    ],
    prices: [299, 399, 449, 299, 499, 349, 399, 299, 175, 349],
  },
  {
    category: 'Books',
    subCat: 'Academic & Competitive',
    brands: [
      'Arihant',
      'Disha',
      'MTG',
      'Cengage',
      'S Chand',
      'RD Sharma',
      'RS Aggarwal',
      'Allen',
      'Aakash',
      'PW',
    ],
    names: [
      'JEE Mains Guide',
      'NEET Complete',
      'GATE ECE',
      'CAT Prep',
      'SSC CGL Tier 1',
      'Class 12 Maths',
      'Class 12 Physics',
      'UPSC GS',
      'IBPS PO',
      'RRB NTPC',
    ],
    prices: [499, 549, 599, 649, 299, 349, 349, 799, 299, 249],
  },
];

// ── Keyword aliases to expand search accuracy ────────────────────────────────
const KEYWORD_ALIASES: Record<string, string[]> = {
  phone: ['phone', 'mobile', 'smartphone', 'iphone', 'android phone', 'cellphone', 'handset'],
  laptop: ['laptop', 'macbook', 'chromebook', 'ultrabook'],
  headphone: [
    'headphone',
    'earphone',
    'earbuds',
    'speaker',
    'soundbar',
    'audio',
    'headset',
    'tws',
    'bluetooth speaker',
  ],
  watch: ['watch', 'smartwatch', 'fitness band', 'fitness tracker', 'wearable'],
  tablet: ['tablet', 'ipad', 'tab'],
  camera: ['camera', 'dslr', 'mirrorless', 'gopro', 'action camera'],
  ac: ['ac', 'air conditioner', 'air cooler', 'cooling'],
  fridge: ['refrigerator', 'fridge', 'freezer'],
  washing: ['washing machine', 'washer', 'dryer', 'laundry'],
  purifier: ['air purifier', 'purifier'],
  pen: [
    'pen',
    'ball pen',
    'bal pen',
    'gel pen',
    'ballpoint',
    'fountain pen',
    'sketch pen',
    'marker',
    'highlighter',
  ],
  pencil: ['pencil', 'colour pencil', 'mechanical pencil'],
  notebook_paper: [
    'notebook',
    'notepad',
    'diary',
    'register',
    'copy',
    'exercise book',
    'long book',
  ],
  stationery: [
    'stationery',
    'stationary',
    'eraser',
    'ruler',
    'stapler',
    'sharpener',
    'crayon',
    'folder',
    'binder',
    'paper',
  ],
  rice: ['rice', 'basmati', 'biryani rice'],
  dal: ['dal', 'toor dal', 'moong dal', 'lentil'],
  oil: ['oil', 'cooking oil', 'sunflower oil', 'mustard oil', 'olive oil'],
  atta: ['atta', 'flour', 'wheat', 'maida'],
  noodle: ['noodles', 'maggi', 'instant noodle', 'pasta'],
  shampoo: ['shampoo', 'conditioner', 'hair care'],
  soap: ['soap', 'body wash', 'moisturizer', 'bar'],
  cream: ['cream', 'face cream', 'moisturizer', 'lotion', 'sunscreen'],
  jeans: ['jeans', 'denim', 'trousers', 'pants'],
  shirt: ['shirt', 't-shirt', 'tshirt', 'polo', 'top', 'kurta'],
  dress: ['dress', 'kurti', 'saree', 'gown', 'ethnic wear'],
  shoes: ['shoes', 'sneakers', 'boots', 'sandals', 'footwear', 'slippers'],
  sofa: ['sofa', 'couch', 'settee'],
  bed: ['bed', 'mattress', 'cot', 'divan'],
  table_furniture: ['dining table', 'study table', 'computer table', 'desk'],
  chair: ['chair', 'office chair', 'gaming chair'],
  cooker: ['cooker', 'pressure cooker', 'rice cooker'],
  pan: ['pan', 'tawa', 'kadai', 'frying pan', 'wok', 'non-stick'],
  mixer: ['mixer', 'grinder', 'blender', 'juicer', 'mixer grinder'],
  microwave: ['microwave', 'oven', 'otg', 'convection'],
  kettle: ['kettle', 'electric kettle', 'tea maker'],
  bat: ['bat', 'cricket bat', 'willow bat'],
  ball: ['cricket ball', 'tennis ball'],
  dumbbell: ['dumbbell', 'weight', 'barbell', 'kettlebell'],
  treadmill: ['treadmill', 'exercise cycle', 'elliptical', 'gym equipment'],
  yoga: ['yoga mat', 'resistance band', 'foam roller'],
  book: ['book', 'novel', 'guide', 'textbook'],
  tv: [
    'tv',
    'tvs',
    'television',
    'televisions',
    'smart tv',
    'led tv',
    'oled',
    'qled',
    '4k tv',
    'uhd',
  ],
};

// ── Disambiguation rules: when a keyword matches multiple categories ────────
// Maps ambiguous words to the exact subCat they should resolve to,
// preventing "notebook" from matching "Laptops" when user means paper notebooks
const DISAMBIGUATION: Record<string, string> = {
  notebook: 'Books', // "notebook" alone → stationery/books, NOT laptops
  'note book': 'Books',
  copy: 'Books',
  register: 'Books',
  pen: 'Stationery', // reserved aliases that override generic matching
  'bal pen': 'Stationery',
  'ball pen': 'Stationery',
  'gel pen': 'Stationery',
  pencil: 'Stationery',
};

// ── Stationery virtual catalog (not in MOCK_CATALOG but available via FALLBACK) ──
const STATIONERY_CATALOG: CatalogEntry = {
  category: 'Stationery',
  subCat: 'Stationery',
  brands: [
    'Cello',
    'Reynolds',
    'Classmate',
    'Faber-Castell',
    'Doms',
    'Navneet',
    'Apsara',
    'Camlin',
    'Luxor',
    'Parker',
  ],
  names: [
    'Butterflow Ball Pen Pack of 10',
    'Trimax Gel Pen Pack of 5',
    'Notebook 180 Pages Pack of 6',
    'Connector Sketch Pens Set of 25',
    'Colour Pencils Pack of 24',
    'Long Book A4 172 Pages',
    'Platinum Pencils Pack of 10',
    'Kokuyo Brush Pens Set of 12',
    'SlimZ Ball Pen Pack of 6',
    'Vector Standard Ball Pen',
  ],
  prices: [100, 150, 270, 199, 99, 65, 50, 299, 120, 350],
};

// ── Search catalog by keyword ────────────────────────────────────────────────
interface SearchResult {
  entry: CatalogEntry;
  matchScore: number;
}

function searchCatalog(query: string): SearchResult[] {
  const queryLower = query.toLowerCase().trim();
  const words = queryLower.split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];

  // Check disambiguation first — if the query matches a disambiguated term, force that category
  for (const [term, targetCat] of Object.entries(DISAMBIGUATION)) {
    if (queryLower.includes(term)) {
      // If it maps to stationery, use the virtual stationery catalog
      if (targetCat === 'Stationery') {
        return [{ entry: STATIONERY_CATALOG, matchScore: 100 }];
      }
      // Otherwise find the matching catalog entry
      const forced = CATALOG.filter((e) => e.category === targetCat || e.subCat === targetCat);
      if (forced.length > 0) {
        return forced.map((e) => ({ entry: e, matchScore: 100 }));
      }
    }
  }

  // Also check STATIONERY_CATALOG for stationery keywords
  const stationeryKeywords = [
    'stationery',
    'stationary',
    'eraser',
    'ruler',
    'stapler',
    'sharpener',
    'crayon',
    'folder',
    'binder',
    'marker',
    'highlighter',
  ];
  if (stationeryKeywords.some((k) => queryLower.includes(k))) {
    return [{ entry: STATIONERY_CATALOG, matchScore: 90 }];
  }

  // General catalog search
  const allEntries = [...CATALOG, STATIONERY_CATALOG];

  for (const entry of allEntries) {
    let matchScore = 0;
    const subCatLower = entry.subCat.toLowerCase();
    const catLower = entry.category.toLowerCase();

    // Direct subCat/category match
    for (const w of words) {
      if (subCatLower.includes(w) && w.length >= 2) matchScore += 10;
      if (catLower.includes(w) && w.length >= 2) matchScore += 5;
    }

    // Brand name match
    for (const brand of entry.brands) {
      const brandLower = brand.toLowerCase();
      for (const w of words) {
        if (brandLower === w || (w.length >= 3 && brandLower.includes(w))) matchScore += 8;
      }
    }

    // Product name match
    for (const name of entry.names) {
      const nameLower = name.toLowerCase();
      for (const w of words) {
        if (w.length >= 3 && nameLower.includes(w)) matchScore += 6;
      }
    }

    // Keyword alias expansion
    for (const [, aliases] of Object.entries(KEYWORD_ALIASES)) {
      const queryMatchesAlias = aliases.some((a) => queryLower.includes(a));
      if (!queryMatchesAlias) continue;
      // Check if this entry relates to these aliases
      const entryText = `${subCatLower} ${entry.brands.join(' ').toLowerCase()} ${entry.names.join(' ').toLowerCase()}`;
      for (const alias of aliases) {
        for (const aliasWord of alias.split(/\s+/)) {
          if (aliasWord.length >= 2 && entryText.includes(aliasWord)) {
            matchScore += 3;
          }
        }
      }
    }

    if (matchScore > 0) {
      results.push({ entry, matchScore });
    }
  }

  results.sort((a, b) => b.matchScore - a.matchScore);

  // Only return results with meaningful match scores; filter low-confidence noise
  const topScore = results[0]?.matchScore || 0;
  return results.filter((r) => r.matchScore >= topScore * 0.3);
}

// ── Generate budget options from prices ──────────────────────────────────────
function generateBudgetOptions(prices: number[]): { value: string; label: string }[] {
  if (prices.length === 0) return [{ value: 'any', label: 'Any budget' }];

  const sorted = [...new Set(prices)].sort((a, b) => a - b);
  const minP = sorted[0];
  const maxP = sorted[sorted.length - 1];

  const fmt = (n: number) => {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
    return `₹${n}`;
  };

  if (maxP <= 500) {
    // Very cheap items (stationery, small groceries)
    return [
      { value: `0_${Math.ceil(maxP * 0.3)}`, label: `Under ${fmt(Math.ceil(maxP * 0.3))}` },
      {
        value: `${Math.ceil(maxP * 0.3)}_${Math.ceil(maxP * 0.6)}`,
        label: `${fmt(Math.ceil(maxP * 0.3))}-${fmt(Math.ceil(maxP * 0.6))}`,
      },
      { value: `${Math.ceil(maxP * 0.6)}_${maxP * 2}`, label: `${fmt(Math.ceil(maxP * 0.6))}+` },
      { value: 'other', label: 'Other (type below)' },
    ];
  }

  // Standard: create 4 quartile-based tiers
  const q1 = sorted[Math.floor(sorted.length * 0.25)] || minP;
  const q2 = sorted[Math.floor(sorted.length * 0.5)] || q1;
  const q3 = sorted[Math.floor(sorted.length * 0.75)] || q2;

  const opts: { value: string; label: string }[] = [];
  opts.push({ value: `0_${q1}`, label: `Under ${fmt(q1)}` });
  if (q1 < q2) opts.push({ value: `${q1}_${q2}`, label: `${fmt(q1)}-${fmt(q2)}` });
  if (q2 < q3) opts.push({ value: `${q2}_${q3}`, label: `${fmt(q2)}-${fmt(q3)}` });
  opts.push({ value: `${q3}_${Math.ceil(maxP * 1.5)}`, label: `${fmt(q3)}+` });
  opts.push({ value: 'other', label: 'Other (type below)' });

  return opts;
}

// ── POST handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query || body.input || body.text || '';
    const userId = body.user_id || body.userId || 'anonymous';
    const engineOverride = body.engine || request.nextUrl.searchParams.get('engine');
    const allowExternal =
      body.allowExternal !== false && request.headers.get('x-allow-external') !== 'false';

    if (!query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // ── Smart Intent Engine v2 path ────────────────────────────────────────
    try {
      const {
        processQuery,
        isSmartIntentV2Enabled,
        fetchDBProducts,
        rankProducts,
        explainProduct,
        isDBProductId,
      } = await import('@/lib/smart-intent');
      if (isSmartIntentV2Enabled(engineOverride)) {
        const result = processQuery(query, engineOverride);
        if (
          result.engine_version === 'v2' &&
          (result.products.length > 0 || result.intent.confidence >= 30)
        ) {
          // Phase 6: Fetch REAL DB products and rank them by intent relevance.
          // Synthetic/on-the-fly products from the v2 engine are never used in
          // the final result set — only products stored in the database are shown.
          // If DB returns nothing, the response correctly has an empty products array.
          let finalProducts: typeof result.products = [];
          try {
            // NOTE: noun_signals contain prefixed internal tokens like "category:appliances"
            // and "brand:Samsung" — they must NEVER be passed as NestJS search terms because
            // the API tokenises the search string and requires every token to match a product
            // name/description/category/genericName. Prefixed tokens never match → zero results.
            const dbProducts = await fetchDBProducts(
              result.intent.category,
              result.intent.budget,
              result.intent.brand,
              20,
              {
                useCase: result.intent.use_case,
                features: result.intent.features,
                // rawQuery enables specific product-type detection (e.g. "washing machine"
                // → "Washing Machine" instead of always using genericNouns[0]).
                rawQuery: query,
                // searchTerms intentionally omitted — the canonical primaryNoun from taxonomy
                // is used instead. Use-case / feature strings are added in Strategy 3+.
              }
            );
            if (dbProducts.length > 0) {
              // Rank DB products by how well they match the detected intent.
              // All entries come from the real database — no synthetic fill.
              const rankInputs = dbProducts.map((p) => ({
                product: p,
                matchScore: isDBProductId(p.id) ? 90 : 70,
                matchReasons: ['db'] as string[],
              }));
              finalProducts = rankProducts(rankInputs, result.intent);

              // ── Background DB tag enrichment (fire-and-forget) ──────────
              // Silently grow the ProductTag/ProductTagMap taxonomy from the
              // detected intent. approved=false until a moderator reviews.
              try {
                const { triggerTagEnrichment } =
                  await import('@/lib/smart-intent/db-tag-enrichment');
                triggerTagEnrichment({
                  productIds: finalProducts.slice(0, 8).map((p) => p.id),
                  useCase: result.intent.use_case ?? null,
                  features: result.intent.features ?? [],
                  brand: result.intent.brand ?? null,
                });
              } catch {
                // Best-effort — never block the user.
              }
            }
            // dbProducts.length === 0 → finalProducts stays [];
            // the response will have an empty products array, which is correct —
            // no synthetic data is fabricated to pad the result.
          } catch (dbErr) {
            console.warn('[intent/analyze] DB bridge failed:', dbErr);
            finalProducts = []; // do NOT fall back to synthetic products
          }

          // Phase 5: Generate explanations for top products
          let productsWithExplanations = finalProducts.slice(0, 8).map((p) => {
            const explanation = explainProduct(p, result.intent);
            return {
              ...p,
              aiExplanation: explanation.summary,
              explanation_details: explanation,
              isDBProduct: isDBProductId(p.id),
            };
          });

          // Phase 5b: Filter out external products if admin toggle is OFF
          if (!allowExternal) {
            productsWithExplanations = productsWithExplanations.filter((p: any) => {
              const src = (p.source || p.product?.source || '').toUpperCase();
              const ext = p.isExternal === true || p.product?.isExternal === true;
              const platform = (p.platform || p.product?.platform || '').toLowerCase();
              return src !== 'EXTERNAL' && !ext && platform !== 'amazon' && platform !== 'flipkart';
            });
          }

          // ── Self-Learning: Check for learned/enriched question overrides ──
          // Base: regenerate questions with real DB brands/prices (replaces synthetic catalog)
          let finalQuestions = result.questions;
          try {
            const { getDBCatalogData } = await import('@/lib/smart-intent/db-catalog-helpers');
            const { generateQuestions: genQuestionsWithDB } =
              await import('@/lib/smart-intent/question-generator');
            const intentCat = result.intent.category || 'phone';
            const dbCatalog = await getDBCatalogData(intentCat);
            if (dbCatalog.brands.length > 0 || dbCatalog.priceRange.max > 0) {
              const dbBacked = genQuestionsWithDB(result.intent, {
                brands: dbCatalog.brands,
                priceRange: dbCatalog.priceRange,
              });
              if (dbBacked.length > 0) {
                finalQuestions = dbBacked;
              }
            }
          } catch {
            /* DB catalog fetch failed — keep processQuery() synthetic questions */
          }
          let learningSource: string | null = null;
          try {
            const learned = await findLearnedResponse(query);
            if (learned) {
              // Use enrichedQuestions from AI response first (these are the LLM-generated rich questions)
              if (
                learned.enrichedQuestions &&
                Array.isArray(learned.enrichedQuestions) &&
                (learned.enrichedQuestions as unknown[]).length > 0
              ) {
                // Convert enrichedQuestions format to questions format
                type ECat = 'budget' | 'brand' | 'feature' | 'use_case' | 'delivery';
                const validCats = new Set<string>([
                  'budget',
                  'brand',
                  'feature',
                  'use_case',
                  'delivery',
                ]);
                const enrichedQs = learned.enrichedQuestions as Array<{
                  text: string;
                  options: string[];
                  category: string;
                  priority: number;
                }>;
                // Only use enriched questions if they have proper text AND non-empty options
                const validEnriched = enrichedQs.filter(
                  (eq) => eq.text && Array.isArray(eq.options) && eq.options.length > 0
                );
                if (validEnriched.length > 0) {
                  finalQuestions = validEnriched.map((eq, idx) => {
                    const cat: ECat = validCats.has(eq.category)
                      ? (eq.category as ECat)
                      : 'feature';
                    return {
                      id: `eq${idx + 1}`,
                      question: eq.text,
                      type: 'multiple_choice' as const,
                      options: eq.options.map((o: string) => ({
                        value: o.toLowerCase().replace(/\s+/g, '_'),
                        label: o,
                      })),
                      category: cat,
                      required: false,
                      reason: `Enriched from ${learned.matchType || 'learned'} match`,
                    };
                  });
                  learningSource = `enriched-${learned.source}-${learned.matchType}`;
                }
              } else {
                const learnedData = learned.questions as Record<string, unknown>;
                if (
                  learnedData?.questions &&
                  Array.isArray(learnedData.questions) &&
                  (learnedData.questions as unknown[]).length > 0
                ) {
                  // Only use learned questions if they have proper question text AND options
                  // (v2 engine stores stubs like [{id, category}] without text/options — skip those)
                  const candidateQs = learnedData.questions as Array<Record<string, unknown>>;
                  const hasProperQuestions = candidateQs.every(
                    (q) =>
                      typeof q.question === 'string' &&
                      q.question.length > 0 &&
                      Array.isArray(q.options) &&
                      (q.options as unknown[]).length > 0
                  );
                  if (hasProperQuestions) {
                    finalQuestions = candidateQs as unknown as typeof result.questions;
                    learningSource = `${learned.source}-${learned.matchType}`;
                  }
                  // else: skip malformed learned questions, keep v2 engine's proper questions
                }
              }
            }
          } catch {
            /* learning lookup failed — use original */
          }

          // ── Self-Learning: Capture this query + response (fire-and-forget) ──
          const numUserId =
            typeof userId === 'number'
              ? userId
              : typeof userId === 'string' && /^\d+$/.test(userId)
                ? parseInt(userId, 10)
                : null;
          insertSmartIntentRecord({
            userId: numUserId,
            queryBy: typeof userId === 'string' ? userId : 'anonymous',
            queryText: query,
            userEmail: request.headers.get('x-user-email') || undefined,
            initialProductSuggestionText: result.initial_text?.slice(0, 500) || null,
            intentEngineResponse: {
              intent: result.intent,
              questions: result.questions,
              products: result.products.slice(0, 5).map((p: any) => ({
                id: p.id,
                name: p.name,
                brand: p.brand,
                price: p.price,
                relevanceScore: p.relevanceScore,
              })),
              response: result.response,
              engine_version: result.engine_version,
              processing_time_ms: result.processing_time_ms,
            },
          }).catch((err) => console.error('[Learning] capture failed:', err.message));

          return NextResponse.json({
            userId,
            intent: {
              user_intent: query,
              category: result.intent.category || 'general',
              confidence: result.intent.confidence / 100,
              budget: result.intent.budget || { min: 0, max: 0 },
              preferences: result.intent.brand ? [result.intent.brand] : [],
              use_case: result.intent.use_case,
              features: result.intent.features,
              matched_entities: result.intent.matched_entities,
            },
            clarifying_questions: finalQuestions,
            learning_source: learningSource,
            initial_text: result.initial_text,
            matchedProducts: productsWithExplanations.length,
            products: productsWithExplanations,
            engine_version: 'v2',
            processing_time_ms: result.processing_time_ms,
          });
        }
        // v2 returned empty / low confidence → fall through to v1
      }
    } catch (v2Error) {
      console.error('[intent/analyze] v2 engine error, falling back to v1:', v2Error);
    }
    // ── End v2 path — fall through to original v1 logic below ──────────────

    const searchResults = searchCatalog(query);

    // No matches → return clear "not found" message
    if (searchResults.length === 0) {
      return NextResponse.json({
        userId,
        intent: {
          user_intent: query,
          category: 'not_found',
          confidence: 0,
          budget: { min: 0, max: 0 },
          preferences: [],
        },
        clarifying_questions: [],
        initial_text: `Sorry, I couldn't find any products matching "${query}" in our catalog. Please try a different keyword, product name, or brand name.`,
        matchedProducts: 0,
      });
    }

    // Use top result(s)
    const topResult = searchResults[0];
    const topEntries = searchResults.slice(0, 2); // max 2 categories

    // Collect prices & brands (used as fallback when DB query returns nothing)
    const allPrices: number[] = [];
    const allBrands = new Map<string, string>();

    for (const { entry } of topEntries) {
      for (let i = 0; i < entry.brands.length; i++) {
        allPrices.push(entry.prices[i]);
        const key = entry.brands[i].toLowerCase().replace(/[\s&']+/g, '_');
        allBrands.set(key, entry.brands[i]);
      }
    }

    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);

    // Detect brand mentions
    const textLower = query.toLowerCase();
    const preferredBrands: string[] = [];
    for (const [, label] of allBrands) {
      if (textLower.includes(label.toLowerCase())) preferredBrands.push(label);
    }

    // Budget modifiers
    let budget = { min: minPrice, max: maxPrice };
    if (/cheap|budget|affordable|sasta/i.test(query)) {
      budget = { min: 0, max: Math.ceil(maxPrice * 0.4) };
    } else if (/premium|best|high.?end|expensive|luxury/i.test(query)) {
      budget = { min: Math.ceil(maxPrice * 0.5), max: Math.ceil(maxPrice * 2) };
    }

    // ── v1: Replace MOCK_CATALOG brand/price options with real DB data ──────
    // Map subCat (from MOCK_CATALOG search) to the intent category key used by db-catalog-helpers
    const SUBCAT_TO_INTENT_CAT: Record<string, string> = {
      Smartphones: 'phone',
      Laptops: 'laptop',
      Tablets: 'tablet',
      Cameras: 'camera',
      Headphones: 'headphones',
      Speakers: 'speaker',
      Smartwatches: 'watch',
      Televisions: 'television',
      Gaming: 'gaming',
      'Home Appliances': 'appliances',
      'Kitchen Appliances': 'appliances',
      Furniture: 'furniture',
      Stationery: 'stationery',
      "Men's Clothing": 'fashion',
      "Women's Clothing": 'fashion',
      Footwear: 'fashion',
      Cookware: 'appliances',
      Appliances: 'appliances',
      Staples: 'groceries',
      'Packaged Foods': 'groceries',
      'Personal Care': 'grooming',
      Cricket: 'sports',
      Fitness: 'fitness',
      'Self Help & Business': 'books',
      'Academic & Competitive': 'books',
    };
    const v1IntentCat =
      SUBCAT_TO_INTENT_CAT[topResult.entry.subCat] ||
      topResult.entry.subCat.toLowerCase().replace(/['\s&]+/g, '_');

    // Attempt to fetch real DB brands and prices — fall back to MOCK_CATALOG if DB is unavailable
    let v1DbBrands: string[] = [];
    let v1DbPriceRange: { min: number; max: number; p25: number; p50: number; p75: number } | null =
      null;
    try {
      const { getDBCatalogData } = await import('@/lib/smart-intent/db-catalog-helpers');
      const dbCatalog = await getDBCatalogData(v1IntentCat);
      if (dbCatalog.brands.length > 0) v1DbBrands = dbCatalog.brands;
      if (dbCatalog.priceRange.max > 0) v1DbPriceRange = dbCatalog.priceRange;
    } catch {
      /* DB unavailable — use MOCK_CATALOG data below */
    }

    // Dynamic brand options — prefer real DB brands
    const brandOptions =
      v1DbBrands.length > 0
        ? [
            ...v1DbBrands
              .slice(0, 8)
              .map((b) => ({ value: b.toLowerCase().replace(/[\s&']+/g, '_'), label: b })),
            { value: 'other', label: 'Other (type below)' },
            { value: 'any', label: 'Any brand' },
          ]
        : [
            ...Array.from(allBrands.entries())
              .slice(0, 8)
              .map(([v, l]) => ({ value: v, label: l })),
            { value: 'other', label: 'Other (type below)' },
            { value: 'any', label: 'Any brand' },
          ];

    // Dynamic budget options — prefer real DB price stats
    const budgetOptions =
      v1DbPriceRange && v1DbPriceRange.max > 0
        ? generateBudgetOptions([
            v1DbPriceRange.min,
            v1DbPriceRange.p25,
            v1DbPriceRange.p50,
            v1DbPriceRange.p75,
            v1DbPriceRange.max,
          ])
        : generateBudgetOptions(allPrices);

    const category = topResult.entry.subCat.toLowerCase().replace(/['\s&]+/g, '_');

    const clarifying_questions = [
      {
        id: 'q1',
        question: `What is your budget range for ${topResult.entry.subCat}?`,
        type: 'multiple_choice',
        options: budgetOptions,
        category: 'budget',
        required: false,
      },
      {
        id: 'q2',
        question: `Do you have a preferred ${topResult.entry.subCat} brand?`,
        type: 'multiple_choice',
        options: brandOptions,
        category: 'brand',
        required: false,
      },
      {
        id: 'q3',
        question: 'How soon do you need delivery?',
        type: 'multiple_choice',
        options: [
          { value: 'today', label: 'Today' },
          { value: '1_2_days', label: '1-2 days' },
          { value: 'this_week', label: 'This week' },
          { value: 'anytime', label: 'No rush' },
        ],
        category: 'delivery',
        required: false,
      },
    ];

    // Build initial recommendation text
    const topProducts: { name: string; price: number }[] = [];
    for (const { entry } of topEntries) {
      for (let i = 0; i < Math.min(entry.brands.length, 5); i++) {
        topProducts.push({ name: `${entry.brands[i]} ${entry.names[i]}`, price: entry.prices[i] });
      }
    }
    const top5 = topProducts.slice(0, 5);
    const productList = top5
      .map((p, i) => `${i + 1}. ${p.name} (₹${p.price.toLocaleString('en-IN')})`)
      .join(' ');

    const tips: Record<string, string> = {
      Electronics: 'Compare specs and warranty before buying. Inverter technology saves energy.',
      Fashion: 'Check size charts and return policies before ordering.',
      Groceries: 'Check expiry dates, pack sizes and compare unit prices.',
      'Home & Kitchen': 'Verify dimensions and material quality for durability.',
      Sports: 'Check certifications, size guides and user reviews.',
      Books: 'Verify edition, language and author before ordering.',
      Stationery:
        'For smooth writing, Cello Butterflow is a top choice. Reynolds offers excellent ink flow.',
    };
    // NOTE: We intentionally do NOT include synthetic product names in the
    // `initial_text` — all real product suggestions must come from the DB
    // via the v2 path. This v1 path only provides clarifying-question
    // structure when v2 is unavailable.
    const tip = tips[topResult.entry.category] || 'Compare prices and read reviews.';

    const initialText = `I can help you find the best ${topResult.entry.subCat.toLowerCase()} from our catalog. 🌱 **Pro Tip:** ${tip} Could you share a budget or preferred brand so I can pull matching products from our store?`;

    // ── Capture v1 analyze path in SmartIntentEngineResponse ──
    const numUserIdAnalyze = /^\d+$/.test(String(userId)) ? parseInt(String(userId), 10) : null;
    insertSmartIntentRecord({
      userId: numUserIdAnalyze,
      queryBy: String(userId),
      queryText: query,
      userEmail: request.headers.get('x-user-email') || undefined,
      initialProductSuggestionText: initialText,
      intentEngineResponse: {
        clarifying_questions,
        top_products: top5,
        engine_version: 'v1',
        category,
        matched_category: topResult.entry.category,
      },
    }).catch((err) => console.error('[Learning] v1 analyze capture failed:', err.message));

    return NextResponse.json({
      userId,
      intent: {
        user_intent: query,
        category,
        confidence: topResult.matchScore >= 50 ? 0.95 : topResult.matchScore >= 20 ? 0.88 : 0.72,
        budget,
        preferences: preferredBrands,
        matched_subcategory: topResult.entry.subCat,
        matched_category: topResult.entry.category,
      },
      clarifying_questions,
      initial_text: initialText,
      matchedProducts: allPrices.length,
    });
  } catch (err: unknown) {
    console.error('[intent/analyze]', err);
    return NextResponse.json(
      { error: 'Failed to analyze intent', details: String(err) },
      { status: 500 }
    );
  }
}
