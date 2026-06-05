/**
 * PaymentMethod Enum & Auto-Checkout Payment Configuration
 *
 * Centralised payment method enumeration used across all pages:
 *  - Shopping List, AI+, Wallet, Checkout, Orders
 *
 * Environment variable:
 *  NEXT_PUBLIC_AUTO_CHECKOUT_PAYMENT_METHODS  — JSON array of PaymentMethod values
 *  that the AI agent is allowed to use for auto-checkout.
 *  Default: ["WALLET"]
 */

export enum PaymentMethod {
  WALLET = 'WALLET',
  UPI = 'UPI',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  NET_BANKING = 'NET_BANKING',
  COD = 'COD',
  EMI = 'EMI',
}

/** Human-readable labels for each payment method */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.WALLET]: 'Wallet',
  [PaymentMethod.UPI]: 'UPI',
  [PaymentMethod.CREDIT_CARD]: 'Credit Card',
  [PaymentMethod.DEBIT_CARD]: 'Debit Card',
  [PaymentMethod.NET_BANKING]: 'Net Banking',
  [PaymentMethod.COD]: 'Cash on Delivery',
  [PaymentMethod.EMI]: 'EMI',
};

/** Legacy lowercase API value → enum mapping */
export const LEGACY_TO_ENUM: Record<string, PaymentMethod> = {
  wallet: PaymentMethod.WALLET,
  upi: PaymentMethod.UPI,
  credit_card: PaymentMethod.CREDIT_CARD,
  debit_card: PaymentMethod.DEBIT_CARD,
  net_banking: PaymentMethod.NET_BANKING,
  cod: PaymentMethod.COD,
  emi: PaymentMethod.EMI,
};

/** Enum → legacy lowercase API value */
export const ENUM_TO_API: Record<PaymentMethod, string> = {
  [PaymentMethod.WALLET]: 'wallet',
  [PaymentMethod.UPI]: 'upi',
  [PaymentMethod.CREDIT_CARD]: 'credit_card',
  [PaymentMethod.DEBIT_CARD]: 'debit_card',
  [PaymentMethod.NET_BANKING]: 'net_banking',
  [PaymentMethod.COD]: 'cod',
  [PaymentMethod.EMI]: 'emi',
};

/**
 * All payment methods available to users for manual checkout.
 * Order matters — displayed in this sequence in dropdowns.
 */
export const ALL_PAYMENT_METHODS = [
  { value: '', label: 'Any', enum: null },
  { value: 'wallet', label: 'Wallet', enum: PaymentMethod.WALLET },
  { value: 'upi', label: 'UPI', enum: PaymentMethod.UPI },
  { value: 'credit_card', label: 'Credit Card', enum: PaymentMethod.CREDIT_CARD },
  { value: 'debit_card', label: 'Debit Card', enum: PaymentMethod.DEBIT_CARD },
  { value: 'net_banking', label: 'Net Banking', enum: PaymentMethod.NET_BANKING },
  { value: 'cod', label: 'Cash on Delivery', enum: PaymentMethod.COD },
  { value: 'emi', label: 'EMI', enum: PaymentMethod.EMI },
] as const;

/**
 * Parse the NEXT_PUBLIC_AUTO_CHECKOUT_PAYMENT_METHODS env variable.
 * Returns an array of PaymentMethod enums allowed for AI auto-checkout.
 * Defaults to [PaymentMethod.WALLET] if not set or invalid.
 */
export function getAutoCheckoutPaymentMethods(): PaymentMethod[] {
  const raw = process.env.NEXT_PUBLIC_AUTO_CHECKOUT_PAYMENT_METHODS;
  if (!raw) return [PaymentMethod.WALLET];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [PaymentMethod.WALLET];
    return parsed
      .map((v: string) => {
        const upper = String(v).toUpperCase();
        return Object.values(PaymentMethod).includes(upper as PaymentMethod)
          ? (upper as PaymentMethod)
          : null;
      })
      .filter(Boolean) as PaymentMethod[];
  } catch {
    return [PaymentMethod.WALLET];
  }
}

/**
 * Returns the display label for auto-checkout payment methods.
 * e.g. "Wallet" or "Wallet, UPI"
 */
export function getAutoCheckoutLabel(): string {
  const methods = getAutoCheckoutPaymentMethods();
  return methods.map((m) => PAYMENT_METHOD_LABELS[m]).join(', ');
}

/**
 * Returns the first auto-checkout payment method's API value for outgoing requests.
 * Falls back to 'wallet'.
 */
export function getAutoCheckoutApiValue(): string {
  const methods = getAutoCheckoutPaymentMethods();
  return methods.length > 0 ? ENUM_TO_API[methods[0]] : 'wallet';
}
