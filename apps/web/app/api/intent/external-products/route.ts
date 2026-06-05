import { NextRequest, NextResponse } from 'next/server';

// ── Known product catalogue for external suggestions ──────────────────────────
// Covers common Indian market products across categories with realistic pricing

interface ExternalProduct {
  name: string;
  brand: string;
  price: number;
  rating: number;
  reviewCount: number;
  features: string[];
  category: string;
}

const EXTERNAL_CATALOGUE: Record<string, ExternalProduct[]> = {
  phone: [
    { name: 'Galaxy S25 Ultra 5G 256GB', brand: 'Samsung', price: 139999, rating: 4.9, reviewCount: 8200, features: ['200MP camera', 'S Pen', '5000mAh'], category: 'Phones' },
    { name: 'iPhone 16 Pro Max 256GB', brand: 'Apple', price: 159900, rating: 4.8, reviewCount: 11500, features: ['A18 Pro chip', '48MP Fusion', 'Titanium'], category: 'Phones' },
    { name: 'Pixel 9 Pro XL 256GB', brand: 'Google', price: 109999, rating: 4.7, reviewCount: 4300, features: ['Tensor G4', 'Magic Eraser', '50MP'], category: 'Phones' },
    { name: 'Redmi Note 14 Pro 5G 128GB', brand: 'Xiaomi', price: 27999, rating: 4.5, reviewCount: 9800, features: ['50MP camera', '5500mAh', '67W fast charge'], category: 'Phones' },
    { name: 'Realme 13 Pro+ 5G 128GB', brand: 'Realme', price: 28999, rating: 4.4, reviewCount: 6700, features: ['50MP Sony LYT-701 sensor', 'AMOLED 120Hz', '5000mAh'], category: 'Phones' },
    { name: 'Narzo 70 Pro 5G 128GB', brand: 'Realme', price: 18999, rating: 4.3, reviewCount: 4200, features: ['50MP AI camera', '5000mAh', 'Dimensity 7050'], category: 'Phones' },
    { name: 'Moto G85 5G 128GB', brand: 'Motorola', price: 17999, rating: 4.4, reviewCount: 5100, features: ['pOLED 120Hz', '50MP OIS', '5000mAh'], category: 'Phones' },
    { name: 'Find X8 Pro 5G 512GB', brand: 'Oppo', price: 99999, rating: 4.6, reviewCount: 3100, features: ['Hasselblad camera', 'Snapdragon 8 Elite', '6000mAh'], category: 'Phones' },
  ],
  laptop: [
    { name: 'XPS 16 9640 Intel Core Ultra 9', brand: 'Dell', price: 249999, rating: 4.8, reviewCount: 3200, features: ['OLED 4K display', 'RTX 4070', '32GB RAM'], category: 'Laptops' },
    { name: 'MacBook Pro 16" M4 Pro', brand: 'Apple', price: 299990, rating: 4.9, reviewCount: 8900, features: ['M4 Pro chip', '18GB unified memory', '24h battery'], category: 'Laptops' },
    { name: 'ThinkPad X1 Carbon Gen 13', brand: 'Lenovo', price: 189999, rating: 4.7, reviewCount: 5100, features: ['Intel Core Ultra 7', 'Military grade', 'OLED display'], category: 'Laptops' },
    { name: 'Spectre x360 14 2024', brand: 'HP', price: 179999, rating: 4.6, reviewCount: 2800, features: ['Intel Core Ultra 5', '2-in-1 convertible', 'OLED 2.8K'], category: 'Laptops' },
    { name: 'ROG Zephyrus G16 Gaming', brand: 'ASUS', price: 219999, rating: 4.8, reviewCount: 4500, features: ['RTX 4080', 'QHD 240Hz', 'AMD Ryzen 9'], category: 'Laptops' },
  ],
  headphone: [
    { name: 'QuietComfort Ultra Headphones', brand: 'Bose', price: 34900, rating: 4.8, reviewCount: 12300, features: ['World-class ANC', 'Spatial audio', '24h battery'], category: 'Audio' },
    { name: 'WH-1000XM6 Wireless', brand: 'Sony', price: 29990, rating: 4.8, reviewCount: 18700, features: ['HD ANC', 'LDAC', '40h battery'], category: 'Audio' },
    { name: 'AirPods Max 2nd Gen', brand: 'Apple', price: 61900, rating: 4.7, reviewCount: 6700, features: ['Apple chip', 'ANC+Transparency', 'USB-C'], category: 'Audio' },
    { name: 'Momentum 4 Wireless', brand: 'Sennheiser', price: 27990, rating: 4.6, reviewCount: 3400, features: ['60h battery', 'aptX Adaptive', 'Adaptive ANC'], category: 'Audio' },
  ],
  tv: [
    { name: 'OLED C4 65" evo', brand: 'LG', price: 189990, rating: 4.8, reviewCount: 7800, features: ['α9 AI processor', 'Self-lit pixels', '120Hz'], category: 'TVs' },
    { name: 'QN90D 65" Neo QLED', brand: 'Samsung', price: 199990, rating: 4.7, reviewCount: 5200, features: ['Quantum Matrix', 'Anti-reflection', 'Object Tracking Sound+'], category: 'TVs' },
    { name: 'BRAVIA 9 65" QLED', brand: 'Sony', price: 249990, rating: 4.8, reviewCount: 3100, features: ['XR processor', 'IMAX Enhanced', 'Dolby Vision IQ'], category: 'TVs' },
    { name: 'P1 Master Series 65"', brand: 'Hisense', price: 109990, rating: 4.6, reviewCount: 2800, features: ['Mini LED', '144Hz', 'Dolby Vision IQ'], category: 'TVs' },
  ],
  speaker: [
    { name: 'HomePod 2nd Generation', brand: 'Apple', price: 32900, rating: 4.7, reviewCount: 4500, features: ['S9 chip', 'Spatial Audio', 'Smart home hub'], category: 'Audio' },
    { name: 'SRS-XB100 Ultra Portable', brand: 'Sony', price: 3990, rating: 4.6, reviewCount: 21000, features: ['IP67 waterproof', '16h battery', 'Extra Bass'], category: 'Audio' },
    { name: 'Charge 6 Portable Speaker', brand: 'JBL', price: 14999, rating: 4.7, reviewCount: 18500, features: ['IP67', '12h battery', 'USB-C power bank'], category: 'Audio' },
    { name: 'Wonderboom 4', brand: 'Ultimate Ears', price: 8499, rating: 4.6, reviewCount: 9200, features: ['360° sound', 'IP67', '14h battery'], category: 'Audio' },
  ],
  watch: [
    { name: 'Apple Watch Ultra 3', brand: 'Apple', price: 89900, rating: 4.8, reviewCount: 7600, features: ['60h battery', 'Dual GPS', 'Crash Detection'], category: 'Wearables' },
    { name: 'Galaxy Watch Ultra', brand: 'Samsung', price: 59999, rating: 4.7, reviewCount: 5200, features: ['Titanium body', '100h GPS', 'Advanced health'], category: 'Wearables' },
    { name: 'Watch GT 5 Pro 46mm', brand: 'Huawei', price: 24999, rating: 4.6, reviewCount: 4100, features: ['14-day battery', 'SpO2', 'ECG'], category: 'Wearables' },
    { name: 'Fenix 8 Solar', brand: 'Garmin', price: 119990, rating: 4.9, reviewCount: 3300, features: ['Solar charging', 'Multi-band GPS', '29-day battery'], category: 'Wearables' },
  ],
  tablet: [
    { name: 'iPad Pro M4 13" WiFi 256GB', brand: 'Apple', price: 119900, rating: 4.9, reviewCount: 9800, features: ['M4 chip', 'Ultra-thin', 'OLED XDR'], category: 'Tablets' },
    { name: 'Galaxy Tab S10 Ultra 5G 256GB', brand: 'Samsung', price: 119999, rating: 4.8, reviewCount: 6700, features: ['Snapdragon 8 Gen 3', 'S Pen', '14.6" AMOLED'], category: 'Tablets' },
    { name: 'Pad 7 Pro 5G 256GB', brand: 'Xiaomi', price: 59999, rating: 4.6, reviewCount: 3200, features: ['Snapdragon 8s Gen 3', 'Dolby Vision', '11200mAh'], category: 'Tablets' },
  ],
  camera: [
    { name: 'Alpha 7C II Mirrorless', brand: 'Sony', price: 199990, rating: 4.8, reviewCount: 4100, features: ['33MP full-frame', '4K 60fps', 'Real-time Eye AF'], category: 'Cameras' },
    { name: 'EOS R8 Mirrorless', brand: 'Canon', price: 139990, rating: 4.7, reviewCount: 3600, features: ['24.2MP', '4K 60fps', 'IBIS'], category: 'Cameras' },
    { name: 'Nikon Zf Mirrorless', brand: 'Nikon', price: 169990, rating: 4.8, reviewCount: 2900, features: ['24.5MP BSI-CMOS', 'Retro-modern design', '5-axis IBIS'], category: 'Cameras' },
  ],
  air_conditioner: [
    { name: 'Split AC 1.5T 5-Star Inverter', brand: 'Daikin', price: 49990, rating: 4.7, reviewCount: 8900, features: ['5-star BEE', 'PM 2.5 filter', 'Self-cleaning'], category: 'Home Appliances' },
    { name: 'Convertible 5-in-1 1.5T AC', brand: 'Samsung', price: 45990, rating: 4.6, reviewCount: 12400, features: ['Inverter compressor', 'Anti-bacterial filter', 'WindFree cooling'], category: 'Home Appliances' },
    { name: '1.5T Classic+ Inverter AC', brand: 'Voltas', price: 35990, rating: 4.5, reviewCount: 19800, features: ['5-star rated', '100% copper', 'Auto-restart'], category: 'Home Appliances' },
  ],
  refrigerator: [
    { name: '674L French Door Refrigerator', brand: 'Samsung', price: 129999, rating: 4.7, reviewCount: 4500, features: ['Twin Cooling Plus', 'All-around cooling', 'Digital Inverter'], category: 'Home Appliances' },
    { name: '630L Side-by-Side Refrigerator', brand: 'LG', price: 119990, rating: 4.8, reviewCount: 5200, features: ['InstaView Door-in-Door', 'Linear Cooling', 'DoorCooling+'], category: 'Home Appliances' },
    { name: '592L Double Door', brand: 'Whirlpool', price: 79990, rating: 4.6, reviewCount: 7100, features: ['IntelliSense inverter', '6th Sense', 'Adaptive Intelligence'], category: 'Home Appliances' },
  ],
  washing_machine: [
    { name: 'Front Load 9kg AI Direct Drive', brand: 'LG', price: 79990, rating: 4.8, reviewCount: 8900, features: ['AI DD motor', 'Allergy Care', 'Steam+'], category: 'Home Appliances' },
    { name: '9kg Fully Automatic Front Load', brand: 'Samsung', price: 69999, rating: 4.7, reviewCount: 10200, features: ['Eco Bubble', 'Digital Inverter', 'Super Speed 39min'], category: 'Home Appliances' },
    { name: '8.5kg Fully Automatic Top Load', brand: 'Whirlpool', price: 35990, rating: 4.5, reviewCount: 15600, features: ['6th Sense', 'Hard Water Wash', 'ZPF technology'], category: 'Home Appliances' },
  ],
  default: [
    { name: 'Premium Quality Product', brand: 'TopBrand', price: 9999, rating: 4.5, reviewCount: 1200, features: ['High quality', 'Durable', 'Warranty included'], category: 'General' },
    { name: 'Value Choice Product', brand: 'ValueBrand', price: 4999, rating: 4.3, reviewCount: 2800, features: ['Great value', 'Popular choice'], category: 'General' },
    { name: 'Expert Pick Product', brand: 'ExpertBrand', price: 14999, rating: 4.7, reviewCount: 900, features: ['Professional grade', 'Long-lasting'], category: 'General' },
  ],
};

// ── Category detection from intent text ─────────────────────────────────────
function detectCategory(intentText: string): string {
  const lower = intentText.toLowerCase();
  // Check headphone/earphone BEFORE phone to avoid false positive
  if (/headphone|earphone|earbud|airpod|wh-1000|headset|earplug|truly wireless|tws|noise cancel/i.test(lower)) return 'headphone';
  if (/phone|iphone|samsung|android|mobile|smartphone|oneplus|pixel|poco|redmi|realme/i.test(lower)) return 'phone';
  if (/laptop|macbook|notebook|chromebook|ultrabook|thinkpad|xps|spectre|VivoBook/i.test(lower)) return 'laptop';
  if (/speaker|bluetooth speaker|soundbar|home audio/i.test(lower)) return 'speaker';
  if (/tv|television|smart tv|oled|qled|4k tv|led tv/i.test(lower)) return 'tv';
  if (/watch|smartwatch|fitness band|amazfit|galaxy watch|fenix/i.test(lower)) return 'watch';
  if (/tablet|ipad|galaxy tab|drawing tab|e-reader/i.test(lower)) return 'tablet';
  if (/camera|dslr|mirrorless|lens|gopro|action cam/i.test(lower)) return 'camera';
  // Check washing machine BEFORE AC to avoid 'ac' in 'machine' matching AC
  if (/washing machine|washer|front load|top load/i.test(lower)) return 'washing_machine';
  if (/\bac\b|air condition|split ac|window ac|portable ac/i.test(lower)) return 'air_conditioner';
  if (/fridge|refrigerator|freezer/i.test(lower)) return 'refrigerator';
  return 'default';
}

// ── Budget extraction from answers ──────────────────────────────────────────
function extractBudget(answers: string[]): { min: number; max: number } | null {
  for (const ans of answers) {
    const lower = ans.toLowerCase();
    // Budget range patterns like "10k_30k", "10000_30000"
    const rangeMatch = /(\d+)[k_]?[_-](\d+)[k]?/i.exec(lower);
    if (rangeMatch) {
      let min = parseInt(rangeMatch[1]);
      let max = parseInt(rangeMatch[2]);
      if (min < 1000) min *= 1000; // convert "10k" → 10000
      if (max < 1000) max *= 1000;
      if (max > min) return { min, max };
    }
    // Under X pattern
    const underMatch = /under[_ ]?(\d+)[k]?/i.exec(lower);
    if (underMatch) {
      let max = parseInt(underMatch[1]);
      if (max < 1000) max *= 1000;
      return { min: 0, max };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const intentText: string = body.intentText || '';
    const answers: string[] = Array.isArray(body.answers) ? body.answers : [];

    if (!intentText.trim()) {
      return NextResponse.json({ products: [] });
    }

    const category = detectCategory(intentText);
    const allCatalogueItems = EXTERNAL_CATALOGUE[category] ?? EXTERNAL_CATALOGUE.default;
    const budget = extractBudget([intentText, ...answers]);

    // Filter by budget if we can detect one
    let candidates = budget
      ? allCatalogueItems.filter((p) => p.price >= budget.min && p.price <= budget.max * 1.3)
      : allCatalogueItems;

    // If budget filter gives nothing, fall back to all items sorted cheapest first
    if (candidates.length === 0) {
      candidates = [...allCatalogueItems].sort((a, b) =>
        budget ? Math.abs(a.price - budget.max) - Math.abs(b.price - budget.max) : a.price - b.price
      );
    }

    // Return top 4 suggestions
    const products = candidates.slice(0, 4);

    return NextResponse.json({ products, category, budget });
  } catch (err) {
    console.error('[external-products] error:', err);
    return NextResponse.json({ products: [] });
  }
}
