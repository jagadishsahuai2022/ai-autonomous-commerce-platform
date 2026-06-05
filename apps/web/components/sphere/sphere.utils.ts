/**
 * sphere.utils.ts — Pure utility functions for the 3D category sphere v2.
 *
 * v2: Icon-based sphere with high-density Fibonacci distribution.
 *  - SVG icon paths per category (Flipkart-inspired but original)
 *  - Canvas-based circular icon textures (128×128)
 *  - Fibonacci sphere for even distribution
 *  - Duplicate-fill logic when categories < positions
 */

import * as THREE from 'three';

// ─── Fibonacci sphere distribution ──────────────────────────────────────────

/**
 * Distribute N points evenly on a unit sphere using the Fibonacci lattice.
 * Returns [x, y, z] tuples with |P| = radius.
 */
export function fibonacciSphere(count: number, radius = 1): Array<[number, number, number]> {
  const positions: Array<[number, number, number]> = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  for (let i = 0; i < count; i++) {
    const theta = Math.acos(1 - (2 * (i + 0.5)) / count);
    const phi = (2 * Math.PI * i) / goldenRatio;

    positions.push([
      radius * Math.sin(theta) * Math.cos(phi),
      radius * Math.sin(theta) * Math.sin(phi),
      radius * Math.cos(theta),
    ]);
  }
  return positions;
}

// ─── Category icon metadata ─────────────────────────────────────────────────

export interface CategoryIconMeta {
  /** SVG path(s) for the icon — drawn inside a 24×24 viewBox */
  paths: string[];
  /** Fill color for the icon glyph */
  iconColor: string;
  /** Background circle color */
  bgColor: string;
}

/**
 * Original SVG icon paths inspired by e-commerce category icons.
 * Each path is designed for a 24×24 viewBox, stroke-based rendering.
 *
 * v3: Comprehensive icons covering ALL parent categories AND subcategories
 * returned by the API (Headphones, Cameras, Smartwatches, etc.)
 */
export const CATEGORY_ICONS: Record<string, CategoryIconMeta> = {
  // ── Parent categories ────────────────────────────────────────────────────
  Electronics: {
    paths: ['M3 6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V6zm5 12h8m-4-2v2'],
    iconColor: '#ffffff',
    bgColor: '#6d28d9',
  },
  Fashion: {
    paths: ['M12 2l3 4v3l3 9H6l3-9V6l3-4zm-3 4h6'],
    iconColor: '#ffffff',
    bgColor: '#db2777',
  },
  Groceries: {
    paths: ['M3 10h18l-2 8H5L3 10zm4-4l2-4m8 4l-2-4M8 10v8m4-8v8m4-8v8'],
    iconColor: '#ffffff',
    bgColor: '#059669',
  },
  'Home & Kitchen': {
    paths: ['M3 12l9-8 9 8M5 10v9a1 1 0 001 1h3v-5h6v5h3a1 1 0 001-1v-9'],
    iconColor: '#ffffff',
    bgColor: '#d97706',
  },
  Sports: {
    paths: ['M12 2a10 10 0 100 20 10 10 0 000-20zm0 0c-3 3-3 7 0 10s3 7 0 10M2 12h20'],
    iconColor: '#ffffff',
    bgColor: '#2563eb',
  },
  Books: {
    paths: ['M12 6.5c-2-2.5-5-3-7-3v13c2 0 5 .5 7 3 2-2.5 5-3 7-3V3.5c-2 0-5 .5-7 3z'],
    iconColor: '#ffffff',
    bgColor: '#7c3aed',
  },
  'Health & Wellness': {
    paths: ['M12 21l-1.5-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.3.8 4.5 2.1C13.2 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.5 11.2L12 21z'],
    iconColor: '#ffffff',
    bgColor: '#0284c7',
  },
  'Baby & Kids': {
    paths: ['M10 2h4v3l2 2v3l-1 1v8a2 2 0 01-2 2h-2a2 2 0 01-2-2v-8l-1-1V7l2-2V2z'],
    iconColor: '#ffffff',
    bgColor: '#f59e0b',
  },
  Automotive: {
    paths: ['M5 17h14v-4l-2-4H7L5 13v4zm2 0a1 1 0 100 2 1 1 0 000-2zm10 0a1 1 0 100 2 1 1 0 000-2z'],
    iconColor: '#ffffff',
    bgColor: '#374151',
  },
  'Pet Supplies': {
    paths: ['M12 16c2 1.5 4 1 5-1s0-4-2-4-3 1-3 3zm-3-9a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4z'],
    iconColor: '#ffffff',
    bgColor: '#854d0e',
  },
  'Office & Stationery': {
    paths: ['M4 4h12v16H4V4zm4 4h4m-4 4h4m-4 4h2'],
    iconColor: '#ffffff',
    bgColor: '#4b5563',
  },
  'Garden & Outdoor': {
    paths: ['M12 22V10m0 0C12 6 8 2 4 4c0 4 4 6 8 6zm0 0c0-4 4-8 8-6 0 4-4 6-8 6z'],
    iconColor: '#ffffff',
    bgColor: '#16a34a',
  },

  // ── Electronics subcategories ────────────────────────────────────────────
  Smartphones: {
    paths: ['M7 2h10a1 1 0 011 1v18a1 1 0 01-1 1H7a1 1 0 01-1-1V3a1 1 0 011-1zm3 17h4'],
    iconColor: '#ffffff',
    bgColor: '#7c3aed',
  },
  Laptops: {
    paths: ['M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM2 18h20v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-1z'],
    iconColor: '#ffffff',
    bgColor: '#4f46e5',
  },
  Headphones: {
    paths: ['M3 18v-6a9 9 0 0118 0v6M3 18a3 3 0 003 3h0a1 1 0 001-1v-4a1 1 0 00-1-1h0a3 3 0 00-3 3zm18 0a3 3 0 01-3 3h0a1 1 0 01-1-1v-4a1 1 0 011-1h0a3 3 0 013 3z'],
    iconColor: '#ffffff',
    bgColor: '#8b5cf6',
  },
  'Smart Watches': {
    paths: ['M9 3h6m-6 18h6M8 6h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2zm1 4v4l3 2'],
    iconColor: '#ffffff',
    bgColor: '#6366f1',
  },
  Smartwatches: {
    paths: ['M9 3h6m-6 18h6M8 6h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2zm1 4v4l3 2'],
    iconColor: '#ffffff',
    bgColor: '#6366f1',
  },
  Tablets: {
    paths: ['M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1zm5 17h4'],
    iconColor: '#ffffff',
    bgColor: '#818cf8',
  },
  Cameras: {
    paths: ['M3 9a2 2 0 012-2h1l1-2h10l1 2h1a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zm9 8a4 4 0 100-8 4 4 0 000 8z'],
    iconColor: '#ffffff',
    bgColor: '#a78bfa',
  },
  'Air Purifiers': {
    paths: ['M8 2h8v2H8V2zM6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zm6 5a3 3 0 100 6 3 3 0 000-6zm0 1v2m-1-1h2'],
    iconColor: '#ffffff',
    bgColor: '#06b6d4',
  },
  Refrigerators: {
    paths: ['M6 2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm0 9h12M15 6v3m0 4v5'],
    iconColor: '#ffffff',
    bgColor: '#0e7490',
  },
  Televisions: {
    paths: ['M2 5h20v12H2V5zm4 16h12M12 17v4'],
    iconColor: '#ffffff',
    bgColor: '#5b21b6',
  },
  Speakers: {
    paths: ['M6 2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm6 4a2 2 0 100 4 2 2 0 000-4zm0 7a3 3 0 100 6 3 3 0 000-6z'],
    iconColor: '#ffffff',
    bgColor: '#9333ea',
  },
  'Gaming Consoles': {
    paths: ['M6 11h4m-2-2v4m6-1h.01M18 13h.01M2 15V9a4 4 0 014-4h12a4 4 0 014 4v6a3 3 0 01-3 3h-1l-2-2H8L6 18H5a3 3 0 01-3-3z'],
    iconColor: '#ffffff',
    bgColor: '#1d4ed8',
  },
  Gaming: {
    paths: ['M6 11h4m-2-2v4m6-1h.01M18 13h.01M2 15V9a4 4 0 014-4h12a4 4 0 014 4v6a3 3 0 01-3 3h-1l-2-2H8L6 18H5a3 3 0 01-3-3z'],
    iconColor: '#ffffff',
    bgColor: '#1d4ed8',
  },
  Printers: {
    paths: ['M6 8V3h12v5M6 17H4a2 2 0 01-2-2v-4a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2h-2m-2 4H8v-5h8v5z'],
    iconColor: '#ffffff',
    bgColor: '#64748b',
  },
  'Power Banks': {
    paths: ['M6 6h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2zm-2 5h2m12 0h2M10 10v4m2-5v6m2-5v4'],
    iconColor: '#ffffff',
    bgColor: '#16a34a',
  },
  Networking: {
    paths: ['M12 2a3 3 0 100 6 3 3 0 000-6zm-7 13a3 3 0 100 6 3 3 0 000-6zm14 0a3 3 0 100 6 3 3 0 000-6zM12 8v3m-4 3l3-3m2 0l3 3'],
    iconColor: '#ffffff',
    bgColor: '#0891b2',
  },
  'Storage Devices': {
    paths: ['M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2zm14 4h.01M14 10h.01'],
    iconColor: '#ffffff',
    bgColor: '#475569',
  },

  // ── Groceries subcategories ──────────────────────────────────────────────
  Staples: {
    paths: ['M12 2l8 4v12l-8 4-8-4V6l8-4zm0 8l8-4M12 10v12M12 10L4 6'],
    iconColor: '#ffffff',
    bgColor: '#a16207',
  },
  'Packaged Foods': {
    paths: ['M8 2h8l2 4v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6l2-4zm0 4h8m-4 4v4'],
    iconColor: '#ffffff',
    bgColor: '#ca8a04',
  },
  'Personal Care': {
    paths: ['M9 2h6v5l1 2v10a1 1 0 01-1 1h-6a1 1 0 01-1-1V9l1-2V2zm0 5h6'],
    iconColor: '#ffffff',
    bgColor: '#ec4899',
  },

  // ── Fashion subcategories ────────────────────────────────────────────────
  Clothing: {
    paths: ['M8 2h8l4 4-3 2v12H7V8L4 6l4-4z'],
    iconColor: '#ffffff',
    bgColor: '#be185d',
  },
  Footwear: {
    paths: ['M4 16h16l1-3c0-2-2-3-4-3h-3l-2-3c-1-1-3-1-4 0L4 11v5z'],
    iconColor: '#ffffff',
    bgColor: '#0891b2',
  },
  Watches: {
    paths: ['M12 8v4l2 2m-2-10a6 6 0 100 12 6 6 0 000-12zm0-4v2m0 14v2'],
    iconColor: '#ffffff',
    bgColor: '#d946ef',
  },
  'Bags & Luggage': {
    paths: ['M6 6h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2zm3-4h6v4H9V2zm3 10v3'],
    iconColor: '#ffffff',
    bgColor: '#b45309',
  },
  Sunglasses: {
    paths: ['M2 12c1.5-3 5-5 10-5s8.5 2 10 5c-1.5 3-5 5-10 5S3.5 15 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z'],
    iconColor: '#ffffff',
    bgColor: '#6b21a8',
  },
  Jewellery: {
    paths: ['M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6l2-6z'],
    iconColor: '#ffffff',
    bgColor: '#c026d3',
  },
  'Kids Clothing': {
    paths: ['M8 2h8l4 4-3 2v12H7V8L4 6l4-4zm4 8a2 2 0 100-4 2 2 0 000 4z'],
    iconColor: '#ffffff',
    bgColor: '#f472b6',
  },
  'Ethnic Wear': {
    paths: ['M12 2l3 4v3l3 9H6l3-9V6l3-4zm-4 14c0 2 2 4 4 4s4-2 4-4'],
    iconColor: '#ffffff',
    bgColor: '#e11d48',
  },
  'Sports Shoes': {
    paths: ['M4 16h16l1-3c0-2-2-3-4-3h-3l-2-3c-1-1-3-1-4 0L4 11v5zm3-2l2-2 3 1 3-1 2 2'],
    iconColor: '#ffffff',
    bgColor: '#0284c7',
  },

  // ── Home & Kitchen subcategories ─────────────────────────────────────────
  Cookware: {
    paths: ['M5 12a7 7 0 0114 0v4H5v-4zm7-8v3M3 16h18m-9-4a2 2 0 100-4 2 2 0 000 4z'],
    iconColor: '#ffffff',
    bgColor: '#ea580c',
  },
  Appliances: {
    paths: ['M6 2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm6 6a3 3 0 100 6 3 3 0 000-6zm0 9h.01'],
    iconColor: '#ffffff',
    bgColor: '#f97316',
  },
  'Home Appliances': {
    paths: ['M6 2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm6 6a3 3 0 100 6 3 3 0 000-6zm0 9h.01'],
    iconColor: '#ffffff',
    bgColor: '#f97316',
  },
  Furniture: {
    paths: ['M5 10a2 2 0 012-2h10a2 2 0 012 2v2H5v-2zm0 2v5m14-5v5m-11 0v2m8-2v2'],
    iconColor: '#ffffff',
    bgColor: '#92400e',
  },
  Bedding: {
    paths: ['M3 14h18v6H3v-6zm0 0V8a2 2 0 012-2h14a2 2 0 012 2v6m-15-4h2a2 2 0 002-2V8'],
    iconColor: '#ffffff',
    bgColor: '#7c3aed',
  },
  'Home Decor': {
    paths: ['M12 2l-2 6h-6l5 4-2 6 5-4 5 4-2-6 5-4h-6l-2-6z'],
    iconColor: '#ffffff',
    bgColor: '#e879f9',
  },
  'Storage & Organization': {
    paths: ['M4 4h16v5H4V4zm0 7h8v9H4v-9zm10 0h6v9h-6v-9z'],
    iconColor: '#ffffff',
    bgColor: '#78716c',
  },
  Lighting: {
    paths: ['M12 2a6 6 0 016 6c0 3-2 5-3 6v2H9v-2c-1-1-3-3-3-6a6 6 0 016-6zm-2 16h4m-3 2h2'],
    iconColor: '#ffffff',
    bgColor: '#eab308',
  },

  // ── Sports subcategories ─────────────────────────────────────────────────
  Cricket: {
    paths: ['M18 4l-6 6m0 0l-2 8-4-4 8-2m-2-2l4-4M5 19l2-2'],
    iconColor: '#ffffff',
    bgColor: '#15803d',
  },
  Fitness: {
    paths: ['M6 5v14M18 5v14M6 12h12m-9-4v8m6-8v8'],
    iconColor: '#ffffff',
    bgColor: '#dc2626',
  },
  Badminton: {
    paths: ['M12 2l3 7h-6l3-7zm-1 7v10m2-10v10m-3 3h4'],
    iconColor: '#ffffff',
    bgColor: '#0d9488',
  },

  // ── Books subcategories ──────────────────────────────────────────────────
  'Self Help & Business': {
    paths: ['M12 6.5c-2-2.5-5-3-7-3v13c2 0 5 .5 7 3 2-2.5 5-3 7-3V3.5c-2 0-5 .5-7 3zm0 0v13'],
    iconColor: '#ffffff',
    bgColor: '#7c3aed',
  },
  'Academic & Competitive': {
    paths: ['M4 4h16v16H4V4zm2 2v3h3V6H6zm0 5v3h3v-3H6zm5-5v3h7V6h-7zm0 5v3h7v-3h-7z'],
    iconColor: '#ffffff',
    bgColor: '#2563eb',
  },

  // ── Health & Wellness subcategories ──────────────────────────────────────
  Supplements: {
    paths: ['M8 3h8l1 3v14a2 2 0 01-2 2H9a2 2 0 01-2-2V6l1-3zm0 3h8m-6 4h4m-2-2v4'],
    iconColor: '#ffffff',
    bgColor: '#22c55e',
  },
  'Medical Devices': {
    paths: ['M12 2v6m0 0l3 3v9H9v-9l3-3zM8 12h8m-8 4h8'],
    iconColor: '#ffffff',
    bgColor: '#0ea5e9',
  },
  'Ayurveda & Herbal': {
    paths: ['M12 22V10m0 0C12 6 8 2 4 4c0 4 4 6 8 6zm0 0c0-4 4-8 8-6 0 4-4 6-8 6zm-2 4a2 2 0 104 0'],
    iconColor: '#ffffff',
    bgColor: '#15803d',
  },

  // ── Baby & Kids subcategories ────────────────────────────────────────────
  'Baby Care': {
    paths: ['M10 2h4v3l2 2v3l-1 1v8a2 2 0 01-2 2h-2a2 2 0 01-2-2v-8l-1-1V7l2-2V2zm2 8a1 1 0 100 2 1 1 0 000-2z'],
    iconColor: '#ffffff',
    bgColor: '#f59e0b',
  },
  Toys: {
    paths: ['M12 8a4 4 0 100-8 4 4 0 000 8zm-5 2a3 3 0 00-3 3v5h16v-5a3 3 0 00-3-3H7z'],
    iconColor: '#ffffff',
    bgColor: '#dc2626',
  },

  // ── Automotive subcategories ─────────────────────────────────────────────
  'Car Accessories': {
    paths: ['M5 17h14v-4l-2-4H7L5 13v4zm2 0a1 1 0 100 2 1 1 0 000-2zm10 0a1 1 0 100 2 1 1 0 000-2zm-6-7h2'],
    iconColor: '#ffffff',
    bgColor: '#334155',
  },
  'Bike Accessories': {
    paths: ['M5 18a3 3 0 100-6 3 3 0 000 6zm14 0a3 3 0 100-6 3 3 0 000 6zM5 15h4l3-5 3 5h4'],
    iconColor: '#ffffff',
    bgColor: '#475569',
  },

  // ── Pet Supplies subcategories ───────────────────────────────────────────
  'Dog Supplies': {
    paths: ['M12 16c2 1.5 4 1 5-1s0-4-2-4-3 1-3 3zm-3-9a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4zM4 18l2-3h12l2 3'],
    iconColor: '#ffffff',
    bgColor: '#a16207',
  },
  'Cat Supplies': {
    paths: ['M12 16c2 1.5 4 1 5-1s0-4-2-4-3 1-3 3zm-3-9a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4zM4 3l4 4m12-4l-4 4'],
    iconColor: '#ffffff',
    bgColor: '#854d0e',
  },

  // ── Office & Stationery subcategories ────────────────────────────────────
  'Office Supplies': {
    paths: ['M4 4h12v16H4V4zm4 4h4m-4 4h4m-4 4h2m6-10v12'],
    iconColor: '#ffffff',
    bgColor: '#6b7280',
  },
  'Desk Accessories': {
    paths: ['M3 17h18v3H3v-3zm2-5h4v5H5v-5zm6 0h4v5h-4v-5zm6-4h4v9h-4V8z'],
    iconColor: '#ffffff',
    bgColor: '#64748b',
  },

  // ── Garden & Outdoor subcategories ───────────────────────────────────────
  Gardening: {
    paths: ['M12 22V10m0 0C12 6 8 2 4 4c0 4 4 6 8 6zm0 0c0-4 4-8 8-6 0 4-4 6-8 6z'],
    iconColor: '#ffffff',
    bgColor: '#16a34a',
  },
  'Outdoor Furniture': {
    paths: ['M5 10a2 2 0 012-2h10a2 2 0 012 2v2H5v-2zm0 2v5m14-5v5m-9-9V4m4 0v4'],
    iconColor: '#ffffff',
    bgColor: '#65a30d',
  },

  // ── Legacy aliases (kept for backward compat) ────────────────────────────
  Shoes: {
    paths: ['M4 16h16l1-3c0-2-2-3-4-3h-3l-2-3c-1-1-3-1-4 0L4 11v5z'],
    iconColor: '#ffffff',
    bgColor: '#0891b2',
  },
  Beauty: {
    paths: ['M9 2h6v5l1 2v10a1 1 0 01-1 1h-6a1 1 0 01-1-1V9l1-2V2zm0 5h6'],
    iconColor: '#ffffff',
    bgColor: '#ec4899',
  },
  Garden: {
    paths: ['M12 22V10m0 0C12 6 8 2 4 4c0 4 4 6 8 6zm0 0c0-4 4-8 8-6 0 4-4 6-8 6z'],
    iconColor: '#ffffff',
    bgColor: '#16a34a',
  },
  Health: {
    paths: ['M12 21l-1.5-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.3.8 4.5 2.1C13.2 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.5 11.2L12 21z'],
    iconColor: '#ffffff',
    bgColor: '#0284c7',
  },
  Music: {
    paths: ['M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z'],
    iconColor: '#ffffff',
    bgColor: '#9333ea',
  },
  Movies: {
    paths: ['M4 4h16v16H4V4zm0 4h16M8 4v4m4-4v4m4-4v4'],
    iconColor: '#ffffff',
    bgColor: '#b91c1c',
  },
  Games: {
    paths: ['M6 11h4m-2-2v4m6-1h.01M18 13h.01M2 15V9a4 4 0 014-4h12a4 4 0 014 4v6a3 3 0 01-3 3h-1l-2-2H8L6 18H5a3 3 0 01-3-3z'],
    iconColor: '#ffffff',
    bgColor: '#1d4ed8',
  },
  Office: {
    paths: ['M4 4h12v16H4V4zm4 4h4m-4 4h4m-4 4h2'],
    iconColor: '#ffffff',
    bgColor: '#4b5563',
  },
  Baby: {
    paths: ['M10 2h4v3l2 2v3l-1 1v8a2 2 0 01-2 2h-2a2 2 0 01-2-2v-8l-1-1V7l2-2V2z'],
    iconColor: '#ffffff',
    bgColor: '#f59e0b',
  },
  Pets: {
    paths: ['M12 16c2 1.5 4 1 5-1s0-4-2-4-3 1-3 3zm-3-9a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4z'],
    iconColor: '#ffffff',
    bgColor: '#854d0e',
  },
  Travel: {
    paths: ['M12 2L8 8H3l2 4 7-2v8l-3 2v2h6v-2l-3-2v-8l7 2 2-4h-5L12 2z'],
    iconColor: '#ffffff',
    bgColor: '#0e7490',
  },
};

// ── Discovery item type icons (for non-category sphere nodes) ───────────────

export const DISCOVERY_TYPE_ICONS: Record<string, CategoryIconMeta> = {
  trending: {
    paths: ['M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'],
    iconColor: '#ffffff',
    bgColor: '#ef4444',
  },
  deal: {
    paths: ['M13 10V3L4 14h7v7l9-11h-7z'],
    iconColor: '#ffffff',
    bgColor: '#f59e0b',
  },
  personalized: {
    paths: ['M12 2a10 10 0 100 20 10 10 0 000-20zm0 6v4l3 3'],
    iconColor: '#ffffff',
    bgColor: '#8b5cf6',
  },
  limited_stock: {
    paths: [
      'M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.97L13.74 4a2 2 0 00-3.5 0L3.33 16.03A2 2 0 005.07 19z',
    ],
    iconColor: '#ffffff',
    bgColor: '#dc2626',
  },
  new_arrival: {
    paths: [
      'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    ],
    iconColor: '#ffffff',
    bgColor: '#10b981',
  },
};

const DEFAULT_META: CategoryIconMeta = {
  paths: ['M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'],
  iconColor: '#ffffff',
  bgColor: '#6b7280',
};

/**
 * Get icon metadata for a category or discovery type.
 * Uses exact match first, then case-insensitive match, then partial keyword match,
 * then discovery type icons, and finally falls back to default.
 */
export function getCategoryIcon(name: string): CategoryIconMeta {
  // 1. Exact match
  if (CATEGORY_ICONS[name]) return CATEGORY_ICONS[name];
  // 2. Discovery type match
  if (DISCOVERY_TYPE_ICONS[name]) return DISCOVERY_TYPE_ICONS[name];
  // 3. Case-insensitive match
  const lowerName = name.toLowerCase();
  const exactInsensitive = Object.entries(CATEGORY_ICONS).find(
    ([key]) => key.toLowerCase() === lowerName,
  );
  if (exactInsensitive) return exactInsensitive[1];
  // 4. Partial keyword match (e.g., "Gaming" matches "Gaming Consoles")
  const partial = Object.entries(CATEGORY_ICONS).find(
    ([key]) => lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName),
  );
  if (partial) return partial[1];
  // 5. Default fallback
  return DEFAULT_META;
}

// ─── Canvas icon texture creation ────────────────────────────────────────────

/**
 * Create a circular icon texture for a category.
 * 128×128 pixels — small but crisp.
 * Caller must call texture.dispose() on unmount.
 */
export function createIconTexture(name: string): THREE.CanvasTexture {
  const SIZE = 128;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  const meta = getCategoryIcon(name);
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = SIZE / 2 - 4;

  // Circular background
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = meta.bgColor;
  ctx.fill();

  // Radial highlight for depth
  const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.22)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.04)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw SVG icon paths
  const iconSize = r * 1.1;
  const offsetX = cx - iconSize / 2;
  const offsetY = cy - iconSize / 2;
  const scale = iconSize / 24;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = meta.iconColor;
  ctx.fillStyle = 'none';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const d of meta.paths) {
    const path = new Path2D(d);
    ctx.stroke(path);
  }
  ctx.restore();

  // Thin white border ring
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ─── Duplicate-fill logic ────────────────────────────────────────────────────

export interface SphereNode {
  categoryName: string;
  originalIndex: number;
}

/**
 * Fill `targetCount` positions with categories, duplicating round-robin if needed.
 */
export function fillSphereNodes(
  categories: Array<{ name: string; count: number }>,
  targetCount: number
): SphereNode[] {
  if (categories.length === 0) return [];
  const nodes: SphereNode[] = [];
  for (let i = 0; i < targetCount; i++) {
    const idx = i % categories.length;
    nodes.push({ categoryName: categories[idx].name, originalIndex: idx });
  }
  return nodes;
}

/**
 * @deprecated Use createIconTexture instead. Kept for test compatibility.
 */
export function createCategoryTexture(name: string): THREE.CanvasTexture {
  return createIconTexture(name);
}

/**
 * Compute a quaternion that orientates a plane mesh so its +Z normal
 * points OUTWARD from the sphere center.
 */
export function outwardQuaternion(x: number, y: number, z: number): THREE.Quaternion {
  const normal = new THREE.Vector3(x, y, z).normalize();
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  return q;
}
