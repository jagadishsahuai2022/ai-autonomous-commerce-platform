/**
 * Fallback data used when backend APIs are unavailable.
 * Provides sensible defaults so the UI can always render.
 */

export interface FallbackProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviewCount: number;
  category: string;
  image: string;
  inStock: boolean;
  description: string;
  deliveryDays: number;
}

export const FALLBACK_PRODUCTS: FallbackProduct[] = [
  {
    id: 'fb-1', name: 'Wireless Bluetooth Headphones', brand: 'SoundMax',
    price: 2499, originalPrice: 3999, rating: 4.3, reviewCount: 1240,
    category: 'Audio', image: '/placeholder-product.png', inStock: true,
    description: 'Premium noise-cancelling headphones with 30hr battery.', deliveryDays: 3,
  },
  {
    id: 'fb-2', name: 'Smart Watch Pro', brand: 'TechWear',
    price: 4999, originalPrice: 7999, rating: 4.5, reviewCount: 876,
    category: 'Wearables', image: '/placeholder-product.png', inStock: true,
    description: 'Health & fitness tracker with AMOLED display.', deliveryDays: 2,
  },
  {
    id: 'fb-3', name: 'USB-C Fast Charger 65W', brand: 'PowerPro',
    price: 1299, originalPrice: 1999, rating: 4.6, reviewCount: 2100,
    category: 'Accessories', image: '/placeholder-product.png', inStock: true,
    description: 'GaN fast charger for laptops, tablets, and phones.', deliveryDays: 1,
  },
  {
    id: 'fb-4', name: 'Mechanical Gaming Keyboard', brand: 'KeyForce',
    price: 3499, originalPrice: 5499, rating: 4.4, reviewCount: 950,
    category: 'Peripherals', image: '/placeholder-product.png', inStock: true,
    description: 'RGB backlit with Cherry MX Blue switches.', deliveryDays: 3,
  },
  {
    id: 'fb-5', name: 'Portable Bluetooth Speaker', brand: 'SoundMax',
    price: 1899, originalPrice: 2999, rating: 4.2, reviewCount: 1567,
    category: 'Audio', image: '/placeholder-product.png', inStock: true,
    description: 'Waterproof speaker with 12hr battery.', deliveryDays: 2,
  },
  {
    id: 'fb-6', name: 'Laptop Stand Adjustable', brand: 'ErgoDesk',
    price: 899, originalPrice: 1499, rating: 4.7, reviewCount: 3200,
    category: 'Accessories', image: '/placeholder-product.png', inStock: true,
    description: 'Aluminum adjustable stand for 11-17 inch laptops.', deliveryDays: 2,
  },
  {
    id: 'fb-7', name: 'Wireless Mouse Ergonomic', brand: 'TechWear',
    price: 799, originalPrice: 1299, rating: 4.1, reviewCount: 2800,
    category: 'Peripherals', image: '/placeholder-product.png', inStock: true,
    description: 'Silent click, ergonomic vertical mouse.', deliveryDays: 1,
  },
  {
    id: 'fb-8', name: 'Noise Cancelling Earbuds', brand: 'SoundMax',
    price: 3999, originalPrice: 5999, rating: 4.5, reviewCount: 1100,
    category: 'Audio', image: '/placeholder-product.png', inStock: true,
    description: 'ANC earbuds with spatial audio support.', deliveryDays: 3,
  },
];

export interface FallbackUserProfile {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  whatsappNumber: string;
  notificationEmail: string;
  avatarUrl: string;
  subscriptionPlan: string;
  autoPurchaseEnabled: boolean;
  autoPurchaseThreshold: number;
  preferredAiModel: string;
  addresses: unknown[];
}

export function getFallbackProfile(email?: string): FallbackUserProfile {
  const cachedProfile = typeof window !== 'undefined'
    ? localStorage.getItem('userProfile')
    : null;

  if (cachedProfile) {
    try { return JSON.parse(cachedProfile); } catch { /* use default */ }
  }

  const userEmail = email
    || (typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null)
    || 'guest@delegatecart.com';

  return {
    id: 'local',
    email: userEmail,
    name: userEmail.split('@')[0],
    firstName: userEmail.split('@')[0],
    lastName: '',
    whatsappNumber: '',
    notificationEmail: userEmail,
    avatarUrl: '',
    subscriptionPlan: 'BASIC',
    autoPurchaseEnabled: false,
    autoPurchaseThreshold: 500,
    preferredAiModel: 'standard',
    addresses: [],
  };
}

export const FALLBACK_FEATURE_FLAGS = [
  { name: 'ai-recommendations', enabled: true, description: 'AI product recommendations' },
  { name: 'checkout-v2', enabled: true, description: 'New checkout flow' },
  { name: 'loyalty-program', enabled: false, description: 'Loyalty program' },
  { name: 'dark-mode', enabled: true, description: 'Dark mode support' },
  { name: 'whatsapp-sharing', enabled: true, description: 'WhatsApp sharing' },
  { name: 'smart-delegate', enabled: true, description: 'Smart delegate feature' },
];

export const FALLBACK_ANALYTICS = {
  period: 'last_30_days',
  totalEvents: 0,
  totalConversions: 0,
  conversionRate: 0,
  aiRecommendationSuccessRate: 0,
  topCategories: [],
  recentEvents: [],
};

export const FALLBACK_CHAT_RESPONSE = {
  message: "I'm having trouble connecting right now, but I can still help! Try searching for products using the search bar, or browse categories from the products page.",
  products: [],
  parsed: { intent: 'fallback', products: [] },
};

/**
 * Cache profile to localStorage for offline fallback.
 */
export function cacheProfile(profile: Record<string, unknown>): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('userProfile', JSON.stringify(profile));
    } catch { /* storage full — ignore */ }
  }
}
