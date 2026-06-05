/**
 * India-specific formatting utilities
 * Handles INR currency, delivery dates, etc.
 */

/**
 * Format price in INR with proper comma separation
 * ₹1,29,999 format (Indian numbering system)
 */
export function formatPrice(price: number): string {
  // Convert to INR string format with Indian comma placement
  const indianFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return indianFormatter.format(price);
}

/**
 * Format price without currency symbol (for displays)
 */
export function formatPriceAmount(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Format delivery date
 * Returns: "Free delivery by tomorrow" or "Free delivery by Nov 25"
 */
export function formatDeliveryDate(days: number = 1): string {
  if (days === 1) {
    return 'Free delivery by tomorrow';
  }
  const date = new Date();
  date.setDate(date.getDate() + days);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  return `Free delivery by ${date.toLocaleDateString('en-IN', options)}`;
}

/**
 * Calculate EMI options available
 * Returns array of monthly amounts for common EMI durations
 */
export function getEMIOptions(
  price: number,
  interestRate: number = 12
): {
  months: number;
  amount: number;
  total: number;
}[] {
  const durations = [3, 6, 9, 12];
  const ratePerMonth = interestRate / 100 / 12;

  return durations.map((months) => {
    if (ratePerMonth === 0) {
      return {
        months,
        amount: Math.round(price / months),
        total: price,
      };
    }

    // EMI formula: P * r * (1 + r)^n / ((1 + r)^n - 1)
    const emi =
      (price * (ratePerMonth * Math.pow(1 + ratePerMonth, months))) /
      (Math.pow(1 + ratePerMonth, months) - 1);

    return {
      months,
      amount: Math.round(emi),
      total: Math.round(emi * months),
    };
  });
}

/**
 * Format discount percentage
 */
export function formatDiscount(originalPrice: number, discountedPrice: number): number {
  if (originalPrice <= 0) return 0;
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
}

/**
 * Format discount text with badge
 */
export function formatDiscountText(originalPrice: number, discountedPrice: number): string {
  const discount = formatDiscount(originalPrice, discountedPrice);
  return discount > 0 ? `${discount}% off` : '';
}

/**
 * Check if pincode supports delivery
 * Returns delivery estimate and COD availability
 */
export function checkPincodeDelivery(pincode: string): {
  isDeliverable: boolean;
  daysToDeliver: number;
  supportsCOD: boolean;
} {
  // For now, mock implementation
  // In production, this would call an API
  const mockData: Record<string, any> = {
    '560001': { isDeliverable: true, daysToDeliver: 1, supportsCOD: true }, // Bangalore
    '110001': { isDeliverable: true, daysToDeliver: 1, supportsCOD: true }, // Delhi
    '400001': { isDeliverable: true, daysToDeliver: 1, supportsCOD: true }, // Mumbai
    '300001': { isDeliverable: true, daysToDeliver: 2, supportsCOD: true }, // Jaipur
  };

  return (
    mockData[pincode] || {
      isDeliverable: true,
      daysToDeliver: 3,
      supportsCOD: true,
    }
  );
}

/**
 * Format GST percentage
 */
export function getGST(price: number, gstRate: number = 18): number {
  return Math.round((price * gstRate) / 100);
}

/**
 * Get price with GST included
 */
export function getPriceWithGST(price: number, gstRate: number = 18): number {
  return price + getGST(price, gstRate);
}

/**
 * Format product specification (e.g., "256GB" → "256 GB Storage")
 */
export function formatSpec(spec: string, label: string): string {
  return `${spec} ${label}`;
}

/**
 * Format rating text
 */
export function formatRating(rating: number, count: number): string {
  return `${rating.toFixed(1)} ⭐ (${count.toLocaleString('en-IN')} reviews)`;
}

const formatting = {
  formatPrice,
  formatPriceAmount,
  formatDeliveryDate,
  getEMIOptions,
  formatDiscount,
  formatDiscountText,
  checkPincodeDelivery,
  getGST,
  getPriceWithGST,
  formatSpec,
  formatRating,
};

export default formatting;
