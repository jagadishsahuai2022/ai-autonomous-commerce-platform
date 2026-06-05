/**
 * Smart Intent Engine v2 — Synthetic Product Catalog
 *
 * Generates 1000+ realistic products across 5 major categories.
 * Each product has: name, price, brand, rating, attributes JSON, image URL.
 *
 * Products are generated deterministically using seed-based logic
 * so the catalog is stable across server restarts.
 */

import type { ProductSpecifications, SearchableProduct } from './types';
import { buildSpecifications } from './data-enrichment';

// ── Unsplash image URLs by category ──────────────────────────────────────────

const IMAGES: Record<string, string[]> = {
  phone: [
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80',
    'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=400&q=80',
    'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400&q=80',
    'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400&q=80',
    'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=400&q=80',
  ],
  laptop: [
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80',
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80',
    'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=400&q=80',
    'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&q=80',
    'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400&q=80',
  ],
  headphones: [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&q=80',
    'https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=400&q=80',
    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&q=80',
    'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&q=80',
  ],
  television: [
    'https://images.unsplash.com/photo-1593359677879-a4bb92f4534a?w=400&q=80',
    'https://images.unsplash.com/photo-1571415060716-baff5f717a37?w=400&q=80',
    'https://images.unsplash.com/photo-1461151304267-38535e780c79?w=400&q=80',
    'https://images.unsplash.com/photo-1558888401-3cc1de77652d?w=400&q=80',
  ],
  appliances: [
    'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=400&q=80',
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80',
    'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=400&q=80',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80',
  ],
  // ── Phase 1: New category images ──
  fashion: [
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&q=80',
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
    'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=400&q=80',
    'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400&q=80',
  ],
  footwear: [
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80',
    'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=400&q=80',
    'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400&q=80',
    'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=400&q=80',
    'https://images.unsplash.com/photo-1518894781321-630e638d0742?w=400&q=80',
  ],
  watches: [
    'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=400&q=80',
    'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=400&q=80',
    'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&q=80',
    'https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=400&q=80',
  ],
  furniture: [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80',
    'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=400&q=80',
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&q=80',
    'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400&q=80',
  ],
  accessories: [
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80',
    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&q=80',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&q=80',
  ],
};

// ── Category Definitions ─────────────────────────────────────────────────────

interface CategoryDef {
  category: string;
  subCategories: SubCatDef[];
}

interface SubCatDef {
  name: string;
  count?: number; // override to hit target product-count goals
  brands: BrandDef[];
  priceRange: { min: number; max: number };
  nameTemplates: string[];
  attributeGenerators: Record<string, string[]>;
}

interface BrandDef {
  name: string;
  weight: number; // higher = more products from this brand
  priceMultiplier: number; // 1.0 = base, 1.3 = premium
}

const CATEGORIES: CategoryDef[] = [
  // ── PHONES ── (target: 530 total — 5 price tiers)
  {
    category: 'phone',
    subCategories: [
      // ─ Ultra Budget (₹3k–10k): 100 products ─
      {
        name: 'Ultra Budget',
        count: 100,
        brands: [
          { name: 'Tecno', weight: 3, priceMultiplier: 0.85 },
          { name: 'Infinix', weight: 3, priceMultiplier: 0.8 },
          { name: 'Xiaomi', weight: 2, priceMultiplier: 0.9 },
          { name: 'Realme', weight: 2, priceMultiplier: 0.88 },
          { name: 'Samsung', weight: 1, priceMultiplier: 1.0 },
        ],
        priceRange: { min: 3000, max: 10000 },
        nameTemplates: ['{brand} {series} {storage}', '{brand} {series} {suffix}'],
        attributeGenerators: {
          ram: ['2GB', '3GB', '4GB'],
          storage: ['32GB', '64GB'],
          display: ['6.5" IPS LCD 60Hz', '6.6" IPS LCD 90Hz', '6.7" IPS LCD 60Hz'],
          camera: ['8MP Dual', '13MP Dual', '50MP Dual'],
          battery: ['4000mAh', '5000mAh', '6000mAh'],
          processor: ['Helio A22', 'Helio A23', 'Unisoc T606', 'Unisoc T616', 'Helio G36'],
          connectivity: ['4G LTE'],
          charging: ['10W', '18W Fast'],
        },
      },
      // ─ Budget (₹10k–20k): 150 products ─
      {
        name: 'Budget',
        count: 150,
        brands: [
          { name: 'Xiaomi', weight: 3, priceMultiplier: 0.9 },
          { name: 'Realme', weight: 3, priceMultiplier: 0.85 },
          { name: 'Samsung', weight: 2, priceMultiplier: 1.0 },
          { name: 'Vivo', weight: 2, priceMultiplier: 0.9 },
          { name: 'Oppo', weight: 2, priceMultiplier: 0.9 },
          { name: 'Tecno', weight: 2, priceMultiplier: 0.7 },
          { name: 'Infinix', weight: 1, priceMultiplier: 0.65 },
        ],
        priceRange: { min: 10000, max: 20000 },
        nameTemplates: ['{brand} {series} {suffix} {storage}'],
        attributeGenerators: {
          ram: ['3GB', '4GB', '6GB'],
          storage: ['64GB', '128GB'],
          display: ['6.5" IPS LCD 60Hz', '6.6" IPS LCD 90Hz', '6.5" AMOLED 60Hz'],
          camera: ['13MP Dual', '50MP Dual', '50MP Triple'],
          battery: ['5000mAh', '6000mAh'],
          processor: ['Helio G88', 'Helio G96', 'Snapdragon 680', 'Dimensity 6100'],
          connectivity: ['4G LTE', '5G'],
          charging: ['10W', '18W Fast', '33W Fast'],
        },
      },
      // ─ Mid-Range (₹20k–40k): 150 products ─
      {
        name: 'Mid-Range',
        count: 150,
        brands: [
          { name: 'Samsung', weight: 3, priceMultiplier: 1.0 },
          { name: 'OnePlus', weight: 3, priceMultiplier: 1.0 },
          { name: 'Xiaomi', weight: 3, priceMultiplier: 0.85 },
          { name: 'Realme', weight: 2, priceMultiplier: 0.8 },
          { name: 'iQOO', weight: 2, priceMultiplier: 0.9 },
          { name: 'Nothing', weight: 2, priceMultiplier: 1.0 },
          { name: 'Motorola', weight: 2, priceMultiplier: 0.85 },
        ],
        priceRange: { min: 20000, max: 40000 },
        nameTemplates: ['{brand} {series} {suffix} {storage}', '{brand} {series} {storage}'],
        attributeGenerators: {
          ram: ['6GB', '8GB', '12GB'],
          storage: ['128GB', '256GB'],
          display: ['6.4" AMOLED 90Hz', '6.5" AMOLED 120Hz', '6.67" OLED 120Hz'],
          camera: ['50MP Dual', '64MP Triple', '108MP Triple', '50MP Triple OIS'],
          battery: ['4500mAh', '5000mAh', '5500mAh'],
          processor: [
            'Snapdragon 7 Gen 3',
            'Snapdragon 7s Gen 2',
            'Dimensity 8200',
            'Dimensity 7200',
          ],
          connectivity: ['5G'],
          charging: ['33W Fast', '44W Fast', '67W Fast', '80W Fast'],
        },
      },
      // ─ Upper Mid-Range (₹40k–70k): 65 products ─
      {
        name: 'Upper Mid-Range',
        count: 65,
        brands: [
          { name: 'Samsung', weight: 3, priceMultiplier: 1.2 },
          { name: 'OnePlus', weight: 3, priceMultiplier: 1.0 },
          { name: 'Xiaomi', weight: 2, priceMultiplier: 0.9 },
          { name: 'Nothing', weight: 2, priceMultiplier: 1.0 },
          { name: 'Sony', weight: 1, priceMultiplier: 1.2 },
        ],
        priceRange: { min: 40000, max: 70000 },
        nameTemplates: ['{brand} {series} {suffix}', '{brand} {series} {storage}'],
        attributeGenerators: {
          ram: ['8GB', '12GB'],
          storage: ['256GB', '512GB'],
          display: ['6.4" AMOLED 120Hz', '6.55" AMOLED 120Hz', '6.7" LTPO AMOLED 120Hz'],
          camera: ['50MP Triple OIS', '64MP Triple', '50MP Quad OIS'],
          battery: ['4500mAh', '5000mAh'],
          processor: [
            'Snapdragon 8s Gen 3',
            'Snapdragon 7+ Gen 3',
            'Dimensity 9000',
            'Exynos 2200',
          ],
          connectivity: ['5G', '5G + Wi-Fi 6E'],
          charging: ['67W Fast', '80W Fast', '100W Fast'],
        },
      },
      // ─ Flagship (₹70k+): 65 products ─
      {
        name: 'Flagship',
        count: 65,
        brands: [
          { name: 'Apple', weight: 3, priceMultiplier: 1.4 },
          { name: 'Samsung', weight: 3, priceMultiplier: 1.2 },
          { name: 'OnePlus', weight: 2, priceMultiplier: 1.0 },
          { name: 'Google', weight: 2, priceMultiplier: 1.1 },
          { name: 'Sony', weight: 1, priceMultiplier: 1.3 },
        ],
        priceRange: { min: 70000, max: 170000 },
        nameTemplates: [
          '{brand} {series} Pro Max {storage}',
          '{brand} {series} Ultra {storage}',
          '{brand} {series} Plus {storage}',
        ],
        attributeGenerators: {
          ram: ['8GB', '12GB', '16GB'],
          storage: ['128GB', '256GB', '512GB', '1TB'],
          display: [
            '6.1" OLED 120Hz',
            '6.5" AMOLED 120Hz',
            '6.7" LTPO AMOLED 120Hz',
            '6.9" Dynamic AMOLED 120Hz',
          ],
          camera: ['48MP Triple', '50MP Triple', '108MP Quad', '200MP Quad', '48MP Dual'],
          battery: ['4500mAh', '5000mAh', '5500mAh'],
          processor: [
            'Snapdragon 8 Gen 3',
            'A17 Pro',
            'Dimensity 9300',
            'Exynos 2400',
            'Tensor G3',
          ],
          connectivity: ['5G', '5G + Wi-Fi 7'],
          charging: ['67W Fast', '100W Fast', '120W HyperCharge', '45W + Wireless'],
        },
      },
    ],
  },
  // ── LAPTOPS ──
  {
    category: 'laptop',
    subCategories: [
      {
        name: 'Gaming',
        count: 100,
        brands: [
          { name: 'ASUS', weight: 3, priceMultiplier: 1.0 },
          { name: 'MSI', weight: 3, priceMultiplier: 1.1 },
          { name: 'Lenovo', weight: 2, priceMultiplier: 1.0 },
          { name: 'HP', weight: 2, priceMultiplier: 1.0 },
          { name: 'Acer', weight: 2, priceMultiplier: 0.85 },
          { name: 'Dell', weight: 1, priceMultiplier: 1.1 },
        ],
        priceRange: { min: 55000, max: 250000 },
        nameTemplates: ['{brand} {series} {suffix} {gpu} {ram}'],
        attributeGenerators: {
          ram: ['8GB DDR5', '16GB DDR5', '32GB DDR5'],
          storage: ['512GB SSD', '1TB SSD', '1TB SSD + 512GB SSD'],
          display: ['15.6" FHD 144Hz', '15.6" FHD 165Hz', '16" QHD 165Hz', '16" QHD 240Hz'],
          gpu: ['RTX 4050', 'RTX 4060', 'RTX 4070', 'RTX 4080', 'RTX 4090'],
          processor: [
            'Intel i5-13500H',
            'Intel i7-13700H',
            'Intel i9-13900H',
            'AMD Ryzen 7 7745HX',
            'AMD Ryzen 9 7945HX',
          ],
          battery: ['4-cell 76Wh', '4-cell 90Wh', '6-cell 99.9Wh'],
          weight: ['2.1 kg', '2.3 kg', '2.5 kg', '2.7 kg'],
        },
      },
      {
        name: 'Ultrabook',
        count: 100,
        brands: [
          { name: 'Apple', weight: 3, priceMultiplier: 1.4 },
          { name: 'Dell', weight: 3, priceMultiplier: 1.1 },
          { name: 'HP', weight: 2, priceMultiplier: 1.0 },
          { name: 'Lenovo', weight: 2, priceMultiplier: 1.0 },
          { name: 'ASUS', weight: 2, priceMultiplier: 0.95 },
          { name: 'LG', weight: 1, priceMultiplier: 1.2 },
        ],
        priceRange: { min: 60000, max: 250000 },
        nameTemplates: ['{brand} {series} {suffix} {storage}'],
        attributeGenerators: {
          ram: ['8GB', '16GB', '32GB'],
          storage: ['256GB SSD', '512GB SSD', '1TB SSD'],
          display: ['13.3" FHD IPS', '14" 2.8K OLED', '14" QHD+ IPS', '15.6" 3.5K OLED'],
          gpu: ['Integrated Intel Iris Xe', 'Integrated AMD Radeon', 'Apple M3 GPU'],
          processor: [
            'Intel Core Ultra 5',
            'Intel Core Ultra 7',
            'Intel Core Ultra 9',
            'Apple M3',
            'Apple M3 Pro',
            'Apple M3 Max',
            'AMD Ryzen 7 7840U',
          ],
          battery: ['10hrs', '12hrs', '15hrs', '18hrs', '22hrs'],
          weight: ['1.0 kg', '1.2 kg', '1.4 kg', '1.6 kg'],
        },
      },
      {
        name: 'Budget',
        count: 120,
        brands: [
          { name: 'HP', weight: 3, priceMultiplier: 1.0 },
          { name: 'Lenovo', weight: 3, priceMultiplier: 0.9 },
          { name: 'Acer', weight: 3, priceMultiplier: 0.85 },
          { name: 'ASUS', weight: 2, priceMultiplier: 0.9 },
          { name: 'Dell', weight: 2, priceMultiplier: 1.0 },
          { name: 'Infinix', weight: 1, priceMultiplier: 0.6 },
        ],
        priceRange: { min: 20000, max: 55000 },
        nameTemplates: ['{brand} {series} {suffix} {storage}'],
        attributeGenerators: {
          ram: ['4GB DDR4', '8GB DDR4', '8GB DDR5'],
          storage: ['256GB SSD', '512GB SSD', '1TB HDD + 256GB SSD'],
          display: ['14" FHD IPS', '15.6" FHD IPS', '15.6" FHD TN'],
          gpu: ['Integrated Intel UHD', 'Integrated AMD Radeon'],
          processor: ['Intel i3-1215U', 'Intel i5-1235U', 'AMD Ryzen 3 7320U', 'AMD Ryzen 5 7520U'],
          battery: ['6hrs', '8hrs', '10hrs'],
          weight: ['1.5 kg', '1.7 kg', '1.9 kg'],
        },
      },
    ],
  },
  // ── HEADPHONES ──
  {
    category: 'headphones',
    subCategories: [
      {
        name: 'Over-Ear',
        count: 100,
        brands: [
          { name: 'Sony', weight: 3, priceMultiplier: 1.3 },
          { name: 'Bose', weight: 3, priceMultiplier: 1.4 },
          { name: 'Sennheiser', weight: 2, priceMultiplier: 1.2 },
          { name: 'JBL', weight: 2, priceMultiplier: 0.8 },
          { name: 'Audio-Technica', weight: 1, priceMultiplier: 1.1 },
          { name: 'Beyerdynamic', weight: 1, priceMultiplier: 1.3 },
        ],
        priceRange: { min: 3000, max: 40000 },
        nameTemplates: ['{brand} {series} Wireless Over-Ear', '{brand} {series} ANC Headphones'],
        attributeGenerators: {
          driver: ['30mm', '40mm', '45mm', '50mm'],
          anc: ['Active Noise Cancelling', 'Adaptive ANC', 'Basic ANC', 'No ANC'],
          battery: ['20hrs', '30hrs', '40hrs', '60hrs'],
          connectivity: ['Bluetooth 5.0', 'Bluetooth 5.2', 'Bluetooth 5.3 + 3.5mm'],
          weight: ['200g', '250g', '280g', '320g'],
          codec: ['SBC, AAC', 'SBC, AAC, LDAC', 'SBC, AAC, aptX HD'],
        },
      },
      {
        name: 'TWS Earbuds',
        count: 150,
        brands: [
          { name: 'Apple', weight: 3, priceMultiplier: 1.5 },
          { name: 'Samsung', weight: 2, priceMultiplier: 1.1 },
          { name: 'Sony', weight: 2, priceMultiplier: 1.2 },
          { name: 'boAt', weight: 3, priceMultiplier: 0.4 },
          { name: 'Noise', weight: 2, priceMultiplier: 0.4 },
          { name: 'JBL', weight: 2, priceMultiplier: 0.6 },
          { name: 'OnePlus', weight: 1, priceMultiplier: 0.7 },
          { name: 'Nothing', weight: 1, priceMultiplier: 0.8 },
        ],
        priceRange: { min: 499, max: 30000 },
        nameTemplates: ['{brand} {series} TWS Earbuds', '{brand} {series} True Wireless'],
        attributeGenerators: {
          driver: ['6mm', '8mm', '10mm', '11mm', '12mm'],
          anc: ['Active Noise Cancelling', 'Hybrid ANC', 'No ANC'],
          battery: [
            '5hrs + 20hrs case',
            '6hrs + 24hrs case',
            '8hrs + 32hrs case',
            '10hrs + 40hrs case',
          ],
          connectivity: ['Bluetooth 5.2', 'Bluetooth 5.3'],
          waterproof: ['IPX4', 'IPX5', 'IP55', 'IP57'],
          codec: ['SBC, AAC', 'SBC, AAC, LDAC'],
        },
      },
      {
        name: 'Neckband',
        count: 50,
        brands: [
          { name: 'boAt', weight: 3, priceMultiplier: 0.5 },
          { name: 'Noise', weight: 2, priceMultiplier: 0.5 },
          { name: 'Realme', weight: 2, priceMultiplier: 0.5 },
          { name: 'OnePlus', weight: 1, priceMultiplier: 0.7 },
          { name: 'JBL', weight: 2, priceMultiplier: 0.8 },
          { name: 'Sony', weight: 1, priceMultiplier: 1.0 },
        ],
        priceRange: { min: 299, max: 5000 },
        nameTemplates: ['{brand} {series} Wireless Neckband', '{brand} {series} Neckband Pro'],
        attributeGenerators: {
          driver: ['10mm', '12mm', '14.2mm'],
          anc: ['ENC', 'Dual ENC', 'No ANC'],
          battery: ['12hrs', '24hrs', '30hrs', '40hrs', '60hrs'],
          connectivity: ['Bluetooth 5.0', 'Bluetooth 5.2'],
          waterproof: ['IPX4', 'IPX5'],
        },
      },
    ],
  },
  // ── TVs ──
  {
    category: 'television',
    subCategories: [
      {
        name: 'Premium',
        brands: [
          { name: 'Samsung', weight: 3, priceMultiplier: 1.1 },
          { name: 'LG', weight: 3, priceMultiplier: 1.2 },
          { name: 'Sony', weight: 2, priceMultiplier: 1.4 },
          { name: 'TCL', weight: 1, priceMultiplier: 0.7 },
        ],
        priceRange: { min: 40000, max: 300000 },
        nameTemplates: [
          '{brand} {size}" {panel} 4K Smart TV {series}',
          '{brand} {size}" {panel} {series}',
        ],
        attributeGenerators: {
          size: ['43', '50', '55', '65', '75', '85'],
          panel: ['OLED', 'QLED', 'Neo QLED', 'Mini LED'],
          resolution: ['4K UHD', '4K UHD 120Hz'],
          smart_platform: ['Tizen OS', 'webOS', 'Google TV', 'Android TV'],
          hdr: ['HDR10+', 'Dolby Vision IQ', 'HDR10+ Adaptive'],
          audio: ['20W', '40W Dolby Atmos', '60W MusicFrame', '80W Dolby Atmos 5.1'],
          connectivity: ['Wi-Fi 5, HDMI 2.1', 'Wi-Fi 6, HDMI 2.1 x4'],
        },
      },
      {
        name: 'Budget',
        brands: [
          { name: 'Xiaomi', weight: 3, priceMultiplier: 0.6 },
          { name: 'Realme', weight: 2, priceMultiplier: 0.55 },
          { name: 'OnePlus', weight: 2, priceMultiplier: 0.7 },
          { name: 'TCL', weight: 2, priceMultiplier: 0.6 },
          { name: 'Samsung', weight: 2, priceMultiplier: 0.8 },
          { name: 'LG', weight: 1, priceMultiplier: 0.8 },
          { name: 'Hisense', weight: 1, priceMultiplier: 0.55 },
          { name: 'Vu', weight: 1, priceMultiplier: 0.5 },
        ],
        priceRange: { min: 8000, max: 45000 },
        nameTemplates: ['{brand} {size}" {panel} Smart TV', '{brand} {size}" HD Ready Smart TV'],
        attributeGenerators: {
          size: ['32', '40', '43', '50', '55'],
          panel: ['LED', 'QLED', 'LED IPS'],
          resolution: ['HD Ready', 'Full HD', '4K UHD'],
          smart_platform: ['Android TV', 'Google TV', 'Fire TV'],
          hdr: ['HDR10', 'HLG'],
          audio: ['10W', '20W', '24W Dolby Audio'],
          connectivity: ['Wi-Fi 5, HDMI x3', 'Wi-Fi 5, HDMI x2'],
        },
      },
    ],
  },
  // ── APPLIANCES ──
  {
    category: 'appliances',
    subCategories: [
      {
        name: 'Washing Machines',
        brands: [
          { name: 'LG', weight: 3, priceMultiplier: 1.0 },
          { name: 'Samsung', weight: 3, priceMultiplier: 1.0 },
          { name: 'Whirlpool', weight: 2, priceMultiplier: 0.85 },
          { name: 'IFB', weight: 2, priceMultiplier: 1.1 },
          { name: 'Bosch', weight: 2, priceMultiplier: 1.2 },
          { name: 'Haier', weight: 2, priceMultiplier: 0.7 },
          { name: 'Godrej', weight: 1, priceMultiplier: 0.75 },
        ],
        priceRange: { min: 7000, max: 55000 },
        nameTemplates: ['{brand} {capacity}Kg {type} Washing Machine {suffix}'],
        attributeGenerators: {
          type: ['Front Load', 'Top Load', 'Semi-Automatic'],
          capacity: ['6', '6.5', '7', '7.5', '8', '9', '10'],
          star_rating: ['3 Star', '4 Star', '5 Star'],
          motor: ['Standard', 'Inverter', 'AI DD Inverter'],
          wash_programs: ['6', '8', '10', '14', '20'],
          rpm: ['800 RPM', '1000 RPM', '1200 RPM', '1400 RPM'],
        },
      },
      {
        name: 'Refrigerators',
        brands: [
          { name: 'LG', weight: 3, priceMultiplier: 1.0 },
          { name: 'Samsung', weight: 3, priceMultiplier: 1.0 },
          { name: 'Whirlpool', weight: 2, priceMultiplier: 0.85 },
          { name: 'Haier', weight: 2, priceMultiplier: 0.8 },
          { name: 'Godrej', weight: 2, priceMultiplier: 0.75 },
          { name: 'Bosch', weight: 1, priceMultiplier: 1.3 },
          { name: 'Hitachi', weight: 1, priceMultiplier: 1.2 },
        ],
        priceRange: { min: 8000, max: 120000 },
        nameTemplates: ['{brand} {capacity}L {type} Refrigerator {suffix}'],
        attributeGenerators: {
          type: ['Single Door', 'Double Door', 'Triple Door', 'Side by Side', 'French Door'],
          capacity: ['190', '215', '235', '253', '260', '310', '340', '470', '550', '650'],
          star_rating: ['2 Star', '3 Star', '4 Star', '5 Star'],
          technology: ['Direct Cool', 'Frost Free', 'Convertible', 'Digital Inverter'],
          special: ['Ice Maker', 'Water Dispenser', 'Convertible Mode', 'Crisper+'],
        },
      },
      {
        name: 'Air Conditioners',
        brands: [
          { name: 'Daikin', weight: 3, priceMultiplier: 1.2 },
          { name: 'Voltas', weight: 2, priceMultiplier: 0.8 },
          { name: 'Blue Star', weight: 2, priceMultiplier: 0.9 },
          { name: 'LG', weight: 2, priceMultiplier: 1.0 },
          { name: 'Samsung', weight: 2, priceMultiplier: 1.0 },
          { name: 'Carrier', weight: 1, priceMultiplier: 0.85 },
          { name: 'Lloyd', weight: 1, priceMultiplier: 0.75 },
          { name: 'Hitachi', weight: 1, priceMultiplier: 1.1 },
        ],
        priceRange: { min: 22000, max: 80000 },
        nameTemplates: ['{brand} {capacity} Ton {suffix} Split AC {star_rating}'],
        attributeGenerators: {
          capacity: ['1', '1.5', '2'],
          star_rating: ['3 Star', '4 Star', '5 Star'],
          type: ['Split', 'Window', 'Portable'],
          technology: ['Fixed Speed', 'Inverter', 'Dual Inverter', 'AI Inverter'],
          cooling: ['Copper Condenser', 'Copper + Anti-Corrosion'],
          special: ['4-Way Swing', '4-in-1 Convertible', 'PM 2.5 Filter', 'Self-Clean'],
        },
      },
      {
        name: 'Kitchen Appliances',
        brands: [
          { name: 'Philips', weight: 3, priceMultiplier: 1.0 },
          { name: 'Prestige', weight: 2, priceMultiplier: 0.8 },
          { name: 'Bajaj', weight: 2, priceMultiplier: 0.7 },
          { name: 'Preethi', weight: 2, priceMultiplier: 0.8 },
          { name: 'Morphy Richards', weight: 1, priceMultiplier: 1.0 },
          { name: 'Samsung', weight: 1, priceMultiplier: 1.1 },
          { name: 'Bosch', weight: 1, priceMultiplier: 1.2 },
        ],
        priceRange: { min: 800, max: 30000 },
        nameTemplates: ['{brand} {series} {type} {power}'],
        attributeGenerators: {
          type: [
            'Mixer Grinder',
            'Juicer',
            'Air Fryer',
            'Microwave Oven',
            'OTG',
            'Induction Cooktop',
            'Electric Kettle',
            'Hand Blender',
            'Dishwasher',
          ],
          power: ['450W', '600W', '750W', '1000W', '1400W', '2000W'],
          capacity: ['0.5L', '1L', '1.5L', '3 Jars', '28L', '32L', '42L', '12 Place'],
          special: ['Anti-Drip', 'Pulse Function', '360° Heating', 'Auto Menu'],
        },
      },
    ],
  },
  // ── FASHION (Phase 1 — 5 new categories) ──
  {
    category: 'fashion',
    subCategories: [
      {
        name: 'Mens Clothing',
        count: 80,
        brands: [
          { name: 'Allen Solly', weight: 3, priceMultiplier: 1.0 },
          { name: 'Peter England', weight: 3, priceMultiplier: 0.9 },
          { name: 'Van Heusen', weight: 2, priceMultiplier: 1.1 },
          { name: "Levi's", weight: 2, priceMultiplier: 1.2 },
          { name: 'Adidas', weight: 2, priceMultiplier: 1.0 },
          { name: 'H&M', weight: 3, priceMultiplier: 0.7 },
        ],
        priceRange: { min: 399, max: 5999 },
        nameTemplates: ['{brand} {series} {type}'],
        attributeGenerators: {
          type: [
            'Slim Fit Jeans',
            'Regular Fit T-Shirt',
            'Formal Shirt',
            'Chino Trouser',
            'Polo T-Shirt',
            'Jogger',
            'Hoodie',
            'Casual Shirt',
            'Shorts',
            'Formal Trouser',
          ],
          material: ['100% Cotton', 'Cotton-Polyester Blend', 'Linen', 'Denim', 'Fleece', 'Jersey'],
          fit: ['Slim Fit', 'Regular Fit', 'Relaxed Fit', 'Skinny Fit', 'Comfort Fit'],
          occasion: ['Casual', 'Formal', 'Party Wear', 'Sports', 'Ethnic'],
          care: ['Machine Wash', 'Hand Wash', 'Dry Clean Only'],
        },
      },
      {
        name: 'Womens Clothing',
        count: 80,
        brands: [
          { name: 'H&M', weight: 3, priceMultiplier: 0.8 },
          { name: 'Zara', weight: 2, priceMultiplier: 1.3 },
          { name: 'Mango', weight: 2, priceMultiplier: 1.2 },
          { name: 'Allen Solly', weight: 2, priceMultiplier: 1.0 },
          { name: 'Van Heusen', weight: 2, priceMultiplier: 0.9 },
          { name: 'Nike', weight: 1, priceMultiplier: 1.1 },
        ],
        priceRange: { min: 299, max: 7999 },
        nameTemplates: ['{brand} {series} {type}'],
        attributeGenerators: {
          type: [
            'Kurti',
            'Dress',
            'Top',
            'Salwar Kameez',
            'Saree',
            'Leggings',
            'Skirt',
            'Blouse',
            'Palazzo Pants',
            'Ethnic Suit',
          ],
          material: ['Cotton', 'Silk', 'Chiffon', 'Georgette', 'Rayon', 'Polyester'],
          fit: ['Regular', 'Fitted', 'Flared', 'A-Line', 'Straight'],
          occasion: ['Casual', 'Formal', 'Festive', 'Party', 'Daily Wear'],
          care: ['Machine Wash', 'Hand Wash', 'Dry Clean'],
        },
      },
      {
        name: 'Activewear',
        count: 40,
        brands: [
          { name: 'Nike', weight: 3, priceMultiplier: 1.2 },
          { name: 'Adidas', weight: 3, priceMultiplier: 1.1 },
          { name: 'Puma', weight: 2, priceMultiplier: 0.9 },
          { name: 'Reebok', weight: 2, priceMultiplier: 0.85 },
          { name: 'H&M', weight: 2, priceMultiplier: 0.6 },
        ],
        priceRange: { min: 799, max: 5999 },
        nameTemplates: ['{brand} {series} {type}'],
        attributeGenerators: {
          type: [
            'Running T-Shirt',
            'Sports Shorts',
            'Track Pants',
            'Sports Bra',
            'Yoga Pants',
            'Compression Tights',
            'Windbreaker',
            'Tracksuit',
          ],
          material: ['Dri-FIT', 'Climalite', 'Quick-Dry Polyester', 'Compression Spandex'],
          fit: ['Slim Fit', 'Regular Fit', 'Compression Fit'],
          occasion: ['Running', 'Gym', 'Yoga', 'Sports', 'Training'],
          care: ['Machine Wash Cold'],
        },
      },
    ],
  },
  // ── FOOTWEAR ──
  {
    category: 'footwear',
    subCategories: [
      {
        name: 'Sneakers',
        count: 70,
        brands: [
          { name: 'Nike', weight: 3, priceMultiplier: 1.3 },
          { name: 'Adidas', weight: 3, priceMultiplier: 1.2 },
          { name: 'Puma', weight: 2, priceMultiplier: 0.9 },
          { name: 'Reebok', weight: 2, priceMultiplier: 0.85 },
          { name: 'Skechers', weight: 2, priceMultiplier: 0.8 },
          { name: 'Bata', weight: 1, priceMultiplier: 0.6 },
        ],
        priceRange: { min: 1499, max: 15999 },
        nameTemplates: ['{brand} {series} Sneakers'],
        attributeGenerators: {
          material: ['Mesh', 'Knit', 'Leather', 'Synthetic Leather', 'Canvas'],
          sole: ['Rubber', 'EVA', 'Foam-Cushioned', 'Air-Cushioned'],
          closure: ['Lace-Up', 'Slip-On', 'Velcro'],
          occasion: ['Casual', 'Running', 'Training', 'Gym', 'Everyday'],
          waterproof: ['Non-Waterproof', 'Water-Resistant', 'Waterproof'],
        },
      },
      {
        name: 'Formal Shoes',
        count: 50,
        brands: [
          { name: 'Bata', weight: 3, priceMultiplier: 0.8 },
          { name: 'Red Tape', weight: 3, priceMultiplier: 0.9 },
          { name: 'Woodland', weight: 2, priceMultiplier: 1.1 },
          { name: 'Metro', weight: 2, priceMultiplier: 0.75 },
          { name: 'Tommy Hilfiger', weight: 1, priceMultiplier: 1.5 },
        ],
        priceRange: { min: 999, max: 9999 },
        nameTemplates: ['{brand} {series} Formal Shoes'],
        attributeGenerators: {
          material: ['Genuine Leather', 'Faux Leather', 'Suede', 'Patent Leather'],
          sole: ['Leather Sole', 'Rubber Sole', 'TPR Sole'],
          closure: ['Lace-Up', 'Slip-On', 'Monk Strap', 'Buckle'],
          occasion: ['Office', 'Formal', 'Business', 'Wedding'],
          care: ['Polish Regularly', 'Wipe with Damp Cloth'],
        },
      },
      {
        name: 'Sandals & Slippers',
        count: 40,
        brands: [
          { name: 'Bata', weight: 3, priceMultiplier: 0.7 },
          { name: 'Crocs', weight: 3, priceMultiplier: 1.0 },
          { name: 'Puma', weight: 2, priceMultiplier: 0.8 },
          { name: 'Woodland', weight: 2, priceMultiplier: 0.9 },
          { name: 'Skechers', weight: 2, priceMultiplier: 0.85 },
        ],
        priceRange: { min: 299, max: 4999 },
        nameTemplates: ['{brand} {series} {type}'],
        attributeGenerators: {
          type: ['Back-Strap Sandals', 'Flip Flops', 'Slides', 'Clogs', 'Sports Sandals'],
          material: ['EVA Foam', 'Rubber', 'Leather', 'Synthetic'],
          sole: ['Non-Slip Rubber', 'Cushioned', 'EVA'],
          occasion: ['Beach', 'Home', 'Casual', 'Sports'],
          waterproof: ['Waterproof', 'Water-Resistant'],
        },
      },
    ],
  },
  // ── WATCHES (Analog / Classic watches, distinct from smartwatch category) ──
  {
    category: 'watches',
    subCategories: [
      {
        name: 'Analog Watches',
        count: 70,
        brands: [
          { name: 'Titan', weight: 3, priceMultiplier: 0.9 },
          { name: 'Fossil', weight: 3, priceMultiplier: 1.3 },
          { name: 'Casio', weight: 2, priceMultiplier: 0.8 },
          { name: 'Seiko', weight: 2, priceMultiplier: 1.2 },
          { name: 'Citizen', weight: 2, priceMultiplier: 1.1 },
        ],
        priceRange: { min: 1499, max: 39999 },
        nameTemplates: ['{brand} {series} Analog Watch'],
        attributeGenerators: {
          movement: ['Quartz Movement', 'Automatic Movement', 'Eco-Drive', 'Solar Powered'],
          display: ['Analog', 'Chronograph', 'Day-Date', 'Dual Time'],
          case_material: ['Stainless Steel', 'Titanium', 'Brass', 'Rose Gold Plated'],
          strap: ['Leather Strap', 'Metal Strap', 'Silicone Strap', 'Mesh Strap'],
          water_resistance: [
            '30m Water Resistant',
            '50m Water Resistant',
            '100m Water Resistant',
            'Not Water Resistant',
          ],
        },
      },
      {
        name: 'Luxury Watches',
        count: 30,
        brands: [
          { name: 'Fossil', weight: 3, priceMultiplier: 1.5 },
          { name: 'Seiko', weight: 3, priceMultiplier: 1.4 },
          { name: 'Citizen', weight: 2, priceMultiplier: 1.3 },
          { name: 'Titan', weight: 2, priceMultiplier: 1.2 },
        ],
        priceRange: { min: 15000, max: 125000 },
        nameTemplates: ['{brand} {series} Luxury Watch'],
        attributeGenerators: {
          movement: [
            'Swiss Automatic',
            'Mechanical Hand-Wind',
            'Sapphire Crystal',
            'Certified Chronometer',
          ],
          display: ['Analog', 'Skeleton Dial', 'Moonphase', 'Power Reserve'],
          case_material: ['Solid Gold Plated', 'Titanium', 'Ceramic Bezel', 'Steel Sapphire'],
          strap: ['Alligator Leather', 'Oyster Bracelet', 'Jubilee Bracelet', 'Milanese Mesh'],
          water_resistance: ['50m Water Resistant', '100m Water Resistant', '300m Diver'],
        },
      },
    ],
  },
  // ── FURNITURE ──
  {
    category: 'furniture',
    subCategories: [
      {
        name: 'Sofas & Seating',
        count: 50,
        brands: [
          { name: 'Ikea', weight: 3, priceMultiplier: 1.0 },
          { name: 'Durian', weight: 3, priceMultiplier: 1.4 },
          { name: 'Pepperfry', weight: 2, priceMultiplier: 0.9 },
          { name: 'Nilkamal', weight: 2, priceMultiplier: 0.7 },
        ],
        priceRange: { min: 8999, max: 120000 },
        nameTemplates: ['{brand} {series} {type}'],
        attributeGenerators: {
          type: [
            '3-Seater Sofa',
            '2-Seater Sofa',
            'L-Shaped Sectional',
            'Recliner Sofa',
            '1-Seater Accent Chair',
            'Futon Sofa Bed',
          ],
          material: ['Fabric', 'Leatherette', 'Genuine Leather', 'Velvet', 'Linen'],
          frame: ['Hardwood Frame', 'Engineered Wood', 'Metal Frame'],
          color: ['Grey', 'Beige', 'Brown', 'Navy Blue', 'Charcoal', 'Olive Green'],
          assembly: ['Assembly Required', 'Tool-Free Assembly', 'Pre-Assembled'],
        },
      },
      {
        name: 'Storage & Wardrobes',
        count: 50,
        brands: [
          { name: 'Ikea', weight: 3, priceMultiplier: 0.9 },
          { name: 'Nilkamal', weight: 3, priceMultiplier: 0.7 },
          { name: 'Durian', weight: 2, priceMultiplier: 1.3 },
          { name: 'Godrej', weight: 2, priceMultiplier: 1.1 },
          { name: 'Pepperfry', weight: 2, priceMultiplier: 0.85 },
        ],
        priceRange: { min: 4999, max: 80000 },
        nameTemplates: ['{brand} {series} {type}'],
        attributeGenerators: {
          type: [
            '2-Door Wardrobe',
            '3-Door Wardrobe',
            'Sliding Door Wardrobe',
            'Bookshelf',
            'Cabinet',
            'TV Unit',
            'Shoe Rack',
            'Study Table',
          ],
          material: ['Engineered Wood', 'Solid Wood', 'MDF', 'Plywood'],
          finish: ['Walnut', 'Wenge', 'White Gloss', 'Oak', 'Teak'],
          features: [
            'Anti-Termite',
            'Moisture Resistant',
            'Scratch Resistant',
            'Soft Close Hinges',
          ],
          assembly: ['Assembly Required', 'Pre-Assembled'],
        },
      },
    ],
  },
  // ── ACCESSORIES ──
  {
    category: 'accessories',
    subCategories: [
      {
        name: 'Bags & Wallets',
        count: 70,
        brands: [
          { name: 'Hidesign', weight: 3, priceMultiplier: 1.3 },
          { name: 'Baggit', weight: 3, priceMultiplier: 0.9 },
          { name: 'Lavie', weight: 2, priceMultiplier: 0.85 },
          { name: 'Tommy Hilfiger', weight: 2, priceMultiplier: 1.4 },
          { name: 'Calvin Klein', weight: 1, priceMultiplier: 1.5 },
        ],
        priceRange: { min: 699, max: 29999 },
        nameTemplates: ['{brand} {series} {type}'],
        attributeGenerators: {
          type: [
            'Tote Bag',
            'Sling Bag',
            'Backpack',
            'Wallet',
            'Clutch',
            'Crossbody Bag',
            'Laptop Bag',
            'Duffel Bag',
            'Travel Bag',
          ],
          material: ['Genuine Leather', 'Faux Leather', 'Canvas', 'Nylon', 'Vegan Leather'],
          color: ['Black', 'Brown', 'Tan', 'Navy', 'Burgundy', 'Olive'],
          compartments: [
            '1 Main Compartment',
            '2 Compartments',
            '3 Compartments',
            'Multiple Pockets',
          ],
          closure: ['Zipper', 'Magnetic Snap', 'Drawstring', 'Buckle'],
        },
      },
      {
        name: 'Sunglasses & Eyewear',
        count: 30,
        brands: [
          { name: 'Tommy Hilfiger', weight: 3, priceMultiplier: 1.3 },
          { name: 'Calvin Klein', weight: 2, priceMultiplier: 1.4 },
          { name: 'Fossil', weight: 2, priceMultiplier: 1.1 },
          { name: 'Titan', weight: 2, priceMultiplier: 0.9 },
          { name: 'Bata', weight: 1, priceMultiplier: 0.7 },
        ],
        priceRange: { min: 499, max: 12999 },
        nameTemplates: ['{brand} {series} Sunglasses'],
        attributeGenerators: {
          frame_shape: ['Wayfarer', 'Aviator', 'Round', 'Cat-Eye', 'Rectangle', 'Oval'],
          lens: ['Polarized', 'UV400 Protected', 'Blue Light Blocking', 'Gradient'],
          material: ['Acetate', 'Metal', 'TR90', 'Titanium'],
          gender: ['Unisex', 'Men', 'Women'],
          uv_protection: ['100% UV Protection', 'UV400'],
        },
      },
    ],
  },
];

// ── Deterministic RNG ────────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ── Series Name Generator ────────────────────────────────────────────────────

const SERIES_NAMES: Record<string, string[]> = {
  Apple: [
    'iPhone 15',
    'iPhone 16',
    'MacBook Air M3',
    'MacBook Pro M3',
    'iPad Pro M4',
    'AirPods Pro 2',
    'Watch Ultra 2',
  ],
  Samsung: [
    'Galaxy S24',
    'Galaxy S25',
    'Galaxy A55',
    'Galaxy A35',
    'Galaxy M55',
    'Galaxy Tab S9',
    'Neo QLED QN85',
    'Crystal UHD',
  ],
  OnePlus: ['12', '12R', 'Nord 4', 'Nord CE 4', 'Buds Pro 2', 'Pad 2'],
  Xiaomi: ['14', '14 Pro', 'Redmi Note 13', 'Redmi 13C', 'Smart TV X', 'Pad 6'],
  Realme: ['GT 5 Pro', 'GT Neo 6', '12 Pro+', 'Narzo 70', 'Buds T300'],
  Vivo: ['V30', 'V30 Pro', 'Y200', 'X100 Pro'],
  Oppo: ['Find X7', 'Reno 12', 'A3 Pro', 'F27 Pro+'],
  Google: ['Pixel 8', 'Pixel 8 Pro', 'Pixel 8a'],
  Nothing: ['Phone 2', 'Phone 2a', 'Ear 2', 'CMF Buds Pro'],
  Motorola: ['Edge 50', 'Edge 50 Pro', 'G85', 'ThinkPhone'],
  Dell: ['XPS 15', 'XPS 13', 'Inspiron 15', 'Latitude 14', 'G16'],
  HP: ['Spectre x360', 'Pavilion 15', 'Victus 16', 'Omen 16', 'EliteBook 840'],
  Lenovo: ['ThinkPad X1', 'IdeaPad Slim 5', 'Legion Pro 7', 'Yoga 9i', 'Tab P12'],
  ASUS: ['ROG Zephyrus', 'ROG Strix', 'VivoBook 15', 'ZenBook 14', 'TUF Gaming F15'],
  Acer: ['Nitro V 16', 'Swift Go 14', 'Aspire 5', 'Predator Helios 16'],
  MSI: ['Stealth 16', 'Prestige 16', 'Raider GE78', 'Titan GT77'],
  Sony: ['WH-1000XM5', 'WF-1000XM5', 'Bravia XR', 'LinkBuds S', 'Xperia 1 VI'],
  Bose: ['QuietComfort Ultra', 'QuietComfort 45', 'SoundLink Max', 'Ultra Open'],
  Sennheiser: ['Momentum 4', 'HD 660S2', 'Accentum Wireless', 'IE 600'],
  JBL: ['Tune 770NC', 'Live Pro 2', 'Charge 5', 'PartyBox Encore', 'Tour One M2'],
  LG: ['OLED evo C4', 'UltraGear', 'Gram 16', 'InstaView'],
  'Audio-Technica': ['M50xBT2', 'SQ1TW2', 'CK3TW'],
  Beyerdynamic: ['DT 900 Pro X', 'Free BYRD'],
  boAt: ['Airdopes 141', 'Rockerz 450', 'Wave Pro 47', 'Stone 1200'],
  Noise: ['Buds VS104', 'Icon 3', 'ColorFit Ultra 3'],
  TCL: ['C845', 'C745', 'P755', 'S5400A'],
  Hisense: ['U7K', 'A6K', 'E7K'],
  Whirlpool: ['Xpert', 'Magic Clean', 'Magicool', 'FreshCare'],
  IFB: ['Senator', 'Diva Plus', 'TL-RES', 'Elite Plus'],
  Bosch: ['Serie 6', 'Serie 4', 'Perfect Cooking'],
  Haier: ['Smart Eco', 'Marvel', 'FlexiDry'],
  Daikin: ['FTKF', 'MTKL', 'DTKJ'],
  Voltas: ['SAC', 'Adjustable'],
  'Blue Star': ['IC518QATU', 'IA318DLU'],
  Godrej: ['Eon', 'Edge Pro', 'RT EON'],
  Philips: ['HL7756', 'HD9252', 'AC1215'],
  Prestige: ['IRIS', 'Delight', 'Popular svachh'],
  Bajaj: ['Majesty', 'Victor', 'Rex'],
  iQOO: ['12', 'Neo 9 Pro', 'Z9'],
  Tecno: [
    'Spark 20 Pro',
    'Spark 20C',
    'Camon 30',
    'Camon 20',
    'Pop 8',
    'Pova 6 Pro',
    'Pova 5',
    'Phantom V Fold',
    'Spark Go 2024',
  ],
  Infinix: [
    'Note 40 Pro',
    'Note 40',
    'Hot 40i',
    'Hot 40',
    'Hot 30i',
    'Zero 30',
    'Zero 20',
    'Smart 8',
    'Smart 7',
    'GT 20 Pro',
  ],
  LG_TV: ['C4 OLED', 'B4 OLED', 'UR78'],
  Vu: ['Masterpiece QLED', 'GloLED', 'Premium 4K'],
  Carrier: ['Flexicool', 'Duracool', 'Ester CXi'],
  Lloyd: ['GLS18I5FWGEV', 'LS18I5FWEL'],
  Hitachi: ['Shizuka', 'Kashikoi', 'Merai 3100S'],
  'Morphy Richards': ['Icon DLX', 'Superb', 'OTG Besta', 'Luxe'],
  Preethi: ['Zodiac', 'Blue Leaf', 'Spice', 'Eco Twin'],
};

// ── Category-specific series name overrides ───────────────────────────────────
// Prevents phone/laptop series names appearing on appliance/furniture etc products
const CATEGORY_SERIES_NAMES: Record<string, Record<string, string[]>> = {
  // ── Laptop: strict series overrides so Apple/Samsung never generate phone/TV names ──
  laptop: {
    Apple: ['MacBook Air M2', 'MacBook Air M3', 'MacBook Pro M3', 'MacBook Pro M4', 'MacBook Pro 16 M3'],
    Dell: ['XPS 15', 'XPS 13 Plus', 'Inspiron 15', 'Inspiron 16', 'Latitude 14', 'G16'],
    HP: ['Spectre x360', 'Pavilion 15', 'Victus 16', 'Omen 16', 'EliteBook 840', 'Envy x360'],
    Lenovo: ['ThinkPad X1 Carbon', 'IdeaPad Slim 5', 'Legion Pro 7', 'Yoga 9i', 'IdeaPad 3'],
    ASUS: ['ROG Zephyrus G14', 'ROG Strix G16', 'VivoBook 15', 'ZenBook 14', 'TUF Gaming F15'],
    Acer: ['Nitro V 16', 'Swift Go 14', 'Aspire 5', 'Predator Helios 16', 'Aspire 3'],
    MSI: ['Stealth 16', 'Prestige 16', 'Raider GE78', 'Modern 15', 'Titan GT77'],
    LG: ['Gram 16', 'Gram 14', 'Gram 17', 'Gram Style 16'],
    Infinix: ['INBook X2 Plus', 'INBook X1 Pro', 'ZeroBook Ultra 14'],
  },
  // ── Phone: strict overrides so Samsung/Xiaomi never leak TV/tablet series names ──
  phone: {
    Apple: ['iPhone 16', 'iPhone 16 Pro', 'iPhone 15', 'iPhone 15 Pro', 'iPhone SE 3'],
    Samsung: ['Galaxy S25', 'Galaxy S24', 'Galaxy A55', 'Galaxy A35', 'Galaxy M55', 'Galaxy F55', 'Galaxy S25 Ultra'],
    Xiaomi: ['14', '14 Pro', 'Redmi Note 13', 'Redmi 13C', 'Redmi Note 13 Pro+'],
    OnePlus: ['12', '12R', 'Nord 4', 'Nord CE 4', 'Open'],
    Nothing: ['Phone 2', 'Phone 2a', 'CMF Phone 1'],
  },
  // ── Headphones: so Apple/Samsung never generate phone/TV names ──
  headphones: {
    Apple: ['AirPods Pro 2', 'AirPods 4', 'AirPods Max'],
    Samsung: ['Galaxy Buds3 Pro', 'Galaxy Buds3', 'Galaxy Buds2 Pro', 'Galaxy Buds FE'],
    OnePlus: ['Buds Pro 2', 'Buds 3', 'Nord Buds 3 Pro'],
    Xiaomi: ['Buds 5 Pro', 'Redmi Buds 6 Pro', 'Redmi Buds 5'],
    Realme: ['Buds Air 6 Pro', 'Buds T300', 'Buds Air 5'],
    Nothing: ['Ear 2', 'Ear 1', 'CMF Buds Pro 2'],
  },
  television: {
    Samsung: ['Neo QLED QN85', 'Neo QLED QN95', 'Crystal UHD TU8', 'QLED Q80C', 'The Frame', 'The Serif', 'The Sero'],
    LG: ['OLED evo C4', 'OLED evo G4', 'QNED 90', 'NanoCell 75', 'UHD UR80', 'UR78', 'OLED C3'],
    Sony: ['Bravia XR A95L', 'Bravia XR X95L', 'Bravia 8', 'Bravia 7', 'X80L', 'X75L'],
    OnePlus: ['Q2 Pro', 'Y2 Pro', 'Y1S Pro', 'U2S', '65 U2'],
    Mi: ['TV 5X', 'TV A2', 'TV L2', 'QLED 4K'],
    TCL: ['C845', 'C745', 'P755', 'S5400A', 'Metallic'],
    Hisense: ['U7K', 'A6K', 'E7K', 'U6K Pro', 'A7H'],
    Vu: ['GloLED', 'UltraAndroid', 'OAledTV', 'Masterpiece Glo'],
    Panasonic: ['TX-65JX940B', 'TX-55JX940B', 'TX-65HX940B', 'LZ1500'],
    Philips: ['The One', '55PUS8518', 'OLED708', 'Ambilight'],
  },
  appliances: {
    Samsung: ['EcoBubble', 'AddWash', 'QuickDrive', 'Bespoke', 'Digital Inverter'],
    LG: ['TurboWash', 'Steam+', 'Direct Drive', 'AI DD', 'EcoHybrid'],
    Godrej: ['Eon Valor', 'Edge Pro', 'Edge Nx', 'Axis'],
    Hitachi: ['Shizuka', 'Kashikoi', 'Merai'],
  },
  fashion: {
    Samsung: ['Casual', 'Active', 'Classic'],
    'H&M': ['Basic', 'Divided', 'Studio', 'Conscious'],
    Zara: ['TRF', 'Origins', 'Edition'],
    Mango: ['Committed', 'Teen', 'Man'],
    Adidas: ['Originals', 'Sportswear', 'Tiro', 'Entrada'],
    Nike: ['Dri-FIT', 'Air', 'Jordan', 'Elite', 'Tech Fleece'],
  },
  footwear: {
    Adidas: ['Ultraboost', 'Stan Smith', 'Superstar', 'NMD', 'Forum'],
    Nike: ['Air Max', 'Air Force 1', 'React', 'Free RN', 'Pegasus'],
    Puma: ['Suede', 'RS-X', 'Cell Venom', 'Future Rider', 'Cali'],
    Reebok: ['Classic', 'Nano', 'Floatride', 'Club C'],
    Bata: ['Comfit', 'North Star', 'Power', 'Weinbrenner'],
    Skechers: ['D-Lites', 'Arch Fit', 'GOwalk', 'UltraFlex'],
  },
  watches: {
    Titan: ['Raga', 'Edge', 'Bandhan', 'Classique', 'Karishma', 'Purple'],
    Fossil: ['Gen 6', 'Everett', 'Neutra', 'Townsman', 'Grant'],
    Casio: ['G-Shock', 'Edifice', 'Sheen', 'Baby-G', 'Pro Trek'],
    Seiko: ['Presage', 'Prospex', 'Astron', 'Cocktail Time'],
    Citizen: ['Eco-Drive', 'Promaster', 'Satellite Wave'],
  },
  furniture: {
    Ikea: ['Billy', 'Kallax', 'Lack', 'Hemnes', 'Ektorp', 'Poang'],
    Durian: ['Rio', 'Enigma', 'Vogue', 'Aura', 'Cleo'],
    Nilkamal: ['Freedom', 'Berlin', 'Lingo', 'Apex'],
    Pepperfry: ['Nordic', 'Studio', 'Bohemian', 'Home'],
  },
  accessories: {
    Hidesign: ['Austin', 'Rucksack', 'Paris', 'Cairo', 'Neptune'],
    Baggit: ['Maven', 'Savor', 'Dazzle', 'Presto'],
    Lavie: ['Monte', 'Trifle', 'Flap', 'Rucksack'],
    'Tommy Hilfiger': ['Iconic', 'Sport', 'Heritage', 'Classic'],
    'Calvin Klein': ['Sculpted', 'Ck2', 'Edge', 'Monogram'],
  },
};

const SUFFIX_POOL = [
  'Pro',
  'Max',
  'Ultra',
  'Lite',
  'Neo',
  'SE',
  'Plus',
  'Air',
  'Standard',
  'Elite',
  '4G',
  '5G',
  'Gen 2',
  'Gen 3',
];

// ── Product Generation ───────────────────────────────────────────────────────

let _cachedCatalog: SearchableProduct[] | null = null;

export function getSyntheticCatalog(): SearchableProduct[] {
  if (_cachedCatalog) return _cachedCatalog;

  const products: SearchableProduct[] = [];
  const rng = seededRandom(42);
  let idCounter = 10000;
  const makeId = (n: number): string => `synth-${n}`;

  for (const catDef of CATEGORIES) {
    for (const subCat of catDef.subCategories) {
      // Use explicit count if set, otherwise default 65–85 per subcategory
      const productCount = subCat.count ?? 65 + Math.floor(rng() * 20);

      for (let i = 0; i < productCount; i++) {
        // Pick brand by weight
        const brandWeightTotal = subCat.brands.reduce((s, b) => s + b.weight, 0);
        let brandRoll = rng() * brandWeightTotal;
        let brandDef = subCat.brands[0];
        for (const b of subCat.brands) {
          brandRoll -= b.weight;
          if (brandRoll <= 0) {
            brandDef = b;
            break;
          }
        }

        // Generate attributes
        const attrs: Record<string, string> = {};
        for (const [key, values] of Object.entries(subCat.attributeGenerators)) {
          attrs[key] = pick(values, rng);
        }

        // Generate price with brand multiplier + random jitter
        const basePrice =
          subCat.priceRange.min + rng() * (subCat.priceRange.max - subCat.priceRange.min);
        const price = Math.round((basePrice * brandDef.priceMultiplier) / 100) * 100 + 99;
        const originalPrice = Math.round((price * (1 + rng() * 0.2)) / 100) * 100 + 99;

        // Series name — use category-specific override if available to prevent cross-contamination
        const catOverride = CATEGORY_SERIES_NAMES[catDef.category];
        const seriesList = (catOverride && catOverride[brandDef.name]) ||
          SERIES_NAMES[brandDef.name] || ['Series ' + Math.floor(rng() * 20)];
        const series = pick(seriesList, rng);
        const suffix = pick(SUFFIX_POOL, rng);

        // Build name — phones use "(RAM, Storage)" format; others use legacy format
        let name: string;
        if (catDef.category === 'phone') {
          name = `${brandDef.name} ${series}`;
          const ram = attrs.ram ? `${attrs.ram} RAM` : '';
          const storage = attrs.storage || '';
          const specStr = [ram, storage].filter(Boolean).join(', ');
          if (specStr) name += ` (${specStr})`;
          // Occasionally append a suffix that isn't already in name
          if (!name.includes(suffix) && rng() > 0.7) name += ` ${suffix}`;
        } else {
          name = `${brandDef.name} ${series}`;
          if (attrs.storage) name += ` ${attrs.storage}`;
          else if (attrs.capacity && catDef.category !== 'headphones') name += ` ${attrs.capacity}`;
          if (!name.includes(suffix) && rng() > 0.5) name += ` ${suffix}`;
        }

        // Rating distribution (3.5–5.0, skewed towards 4.0–4.6)
        const rating = Math.round((3.5 + rng() * 1.0 + rng() * 0.5) * 10) / 10;
        const reviewCount = Math.floor(100 + rng() * 30000);

        const images = IMAGES[catDef.category] || IMAGES.phone;

        // Phase 1+3: Build structured specifications and search index
        const specifications: ProductSpecifications = buildSpecifications(
          catDef.category,
          subCat.name,
          brandDef.name,
          price,
          attrs
        );

        const searchIndex = [
          name,
          brandDef.name,
          catDef.category,
          subCat.name,
          ...specifications.search_tags,
          ...specifications.features,
          ...specifications.use_cases,
          ...Object.values(attrs),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        products.push({
          id: makeId(idCounter++),
          name,
          brand: brandDef.name,
          price,
          originalPrice: Math.max(originalPrice, price),
          category: catDef.category,
          subCategory: subCat.name,
          rating: Math.min(5.0, rating),
          reviewCount,
          image: pick(images, rng),
          inStock: rng() > 0.05, // 95% in stock
          delivery: {
            daysMin:
              catDef.category === 'appliances'
                ? 2 + Math.floor(rng() * 3)
                : 1 + Math.floor(rng() * 2),
            daysMax:
              catDef.category === 'appliances'
                ? 5 + Math.floor(rng() * 3)
                : 2 + Math.floor(rng() * 3),
            free: price > 500,
          },
          codAvailable: price < 100000,
          hasEMI: price > 5000,
          attributes: attrs,
          searchIndex,
          specifications,
        });
      }
    }
  }

  _cachedCatalog = products;
  return products;
}

// ── Utility: Get brands for a category ───────────────────────────────────────

export function getSyntheticBrands(category: string): string[] {
  const seen = new Set<string>();
  const brands: string[] = [];
  for (const catDef of CATEGORIES) {
    if (catDef.category !== category) continue;
    for (const sub of catDef.subCategories) {
      for (const b of sub.brands) {
        if (!seen.has(b.name)) {
          seen.add(b.name);
          brands.push(b.name);
        }
      }
    }
  }
  return brands;
}

// ── Utility: Get price range for a category ──────────────────────────────────

export function getSyntheticPriceRange(category: string): { min: number; max: number } {
  let min = Infinity;
  let max = 0;
  for (const catDef of CATEGORIES) {
    if (catDef.category !== category) continue;
    for (const sub of catDef.subCategories) {
      if (sub.priceRange.min < min) min = sub.priceRange.min;
      if (sub.priceRange.max > max) max = sub.priceRange.max;
    }
  }
  if (min === Infinity) return { min: 0, max: 200000 };
  return { min, max };
}

// ── Utility: Get catalog size stats ──────────────────────────────────────────

export function getCatalogStats(): Record<string, number> {
  const catalog = getSyntheticCatalog();
  const stats: Record<string, number> = { total: catalog.length };
  for (const p of catalog) {
    stats[p.category] = (stats[p.category] || 0) + 1;
  }
  return stats;
}
