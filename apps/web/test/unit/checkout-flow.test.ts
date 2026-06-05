/**
 * Unit Tests — Checkout Flow Logic
 * Covers: wallet balance validation, order placement guards,
 *         address selection, autopilot-checkout eligibility checks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
}

interface Address {
  id: string;
  name: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

interface WalletBalance {
  amount: number;
  currency: 'INR';
}

// ── Checkout eligibility logic (mirrors apps/web checkout flow) ───────────────

function canCheckoutWithWallet(cartTotal: number, wallet: WalletBalance): { ok: boolean; reason?: string } {
  if (wallet.amount <= 0) return { ok: false, reason: 'Wallet balance is zero' };
  if (cartTotal <= 0) return { ok: false, reason: 'Cart is empty' };
  if (wallet.amount < cartTotal) return { ok: false, reason: `Insufficient balance: ₹${wallet.amount} < ₹${cartTotal}` };
  return { ok: true };
}

function isAutoCheckoutEligible(
  cartItems: CartItem[],
  address: Address | null,
  wallet: WalletBalance,
  aiPlusSubscription: boolean
): { eligible: boolean; reason?: string } {
  if (!aiPlusSubscription) return { eligible: false, reason: 'AI+ subscription required' };
  if (!address) return { eligible: false, reason: 'No delivery address set' };
  if (cartItems.length === 0) return { eligible: false, reason: 'Cart is empty' };
  const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  if (wallet.amount < total) return { eligible: false, reason: 'Insufficient wallet balance' };
  const outOfStock = cartItems.find(i => i.stock === 0);
  if (outOfStock) return { eligible: false, reason: `${outOfStock.name} is out of stock` };
  return { eligible: true };
}

function calculateOrderSummary(items: CartItem[], discountPct = 0) {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = Math.round(subtotal * discountPct / 100);
  const shipping = subtotal > 999 ? 0 : 49;
  const tax = Math.round((subtotal - discount) * 0.18);
  const total = subtotal - discount + shipping + tax;
  return { subtotal, discount, shipping, tax, total };
}

function validateDeliveryAddress(addr: Partial<Address>): string[] {
  const errors: string[] = [];
  if (!addr.name?.trim()) errors.push('Recipient name required');
  if (!addr.line1?.trim()) errors.push('Address line 1 required');
  if (!addr.city?.trim()) errors.push('City required');
  if (!addr.state?.trim()) errors.push('State required');
  if (!addr.pincode?.trim()) errors.push('Pincode required');
  else if (!/^\d{6}$/.test(addr.pincode)) errors.push('Pincode must be 6 digits');
  return errors;
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const makeCart = (count = 2, price = 999): CartItem[] => Array.from({ length: count }, (_, i) => ({
  id: `item-${i}`,
  productId: `prod-${i}`,
  name: `Product ${i}`,
  price,
  quantity: 1,
  stock: 10,
}));

const defaultAddress: Address = {
  id: 'addr-1',
  name: 'Test User',
  line1: '123 Main St',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  isDefault: true,
};

// ════════════════════════════════════════════════════════════════════════════
// WALLET CHECKOUT
// ════════════════════════════════════════════════════════════════════════════
describe('canCheckoutWithWallet', () => {
  it('allows checkout when balance covers total', () => {
    expect(canCheckoutWithWallet(500, { amount: 1000, currency: 'INR' }).ok).toBe(true);
  });

  it('blocks checkout when wallet is empty', () => {
    const result = canCheckoutWithWallet(500, { amount: 0, currency: 'INR' });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/zero/i);
  });

  it('blocks checkout when balance is insufficient', () => {
    const result = canCheckoutWithWallet(1500, { amount: 1000, currency: 'INR' });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/insufficient/i);
  });

  it('allows exact-balance checkout', () => {
    expect(canCheckoutWithWallet(1000, { amount: 1000, currency: 'INR' }).ok).toBe(true);
  });

  it('blocks empty cart', () => {
    const result = canCheckoutWithWallet(0, { amount: 500, currency: 'INR' });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/empty/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AUTO-CHECKOUT ELIGIBILITY
// ════════════════════════════════════════════════════════════════════════════
describe('isAutoCheckoutEligible', () => {
  const cart = makeCart(2, 500);
  const wallet: WalletBalance = { amount: 5000, currency: 'INR' };

  it('eligible when all conditions met', () => {
    const r = isAutoCheckoutEligible(cart, defaultAddress, wallet, true);
    expect(r.eligible).toBe(true);
  });

  it('ineligible without AI+ subscription', () => {
    const r = isAutoCheckoutEligible(cart, defaultAddress, wallet, false);
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/ai\+/i);
  });

  it('ineligible without address', () => {
    const r = isAutoCheckoutEligible(cart, null, wallet, true);
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/address/i);
  });

  it('ineligible with empty cart', () => {
    const r = isAutoCheckoutEligible([], defaultAddress, wallet, true);
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/empty/i);
  });

  it('ineligible with insufficient wallet', () => {
    const r = isAutoCheckoutEligible(makeCart(10, 999), defaultAddress, { amount: 100, currency: 'INR' }, true);
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/insufficient/i);
  });

  it('ineligible when item is out of stock', () => {
    const outOfStockCart = [{ ...cart[0], stock: 0 }, cart[1]];
    const r = isAutoCheckoutEligible(outOfStockCart, defaultAddress, wallet, true);
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/out of stock/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ORDER SUMMARY CALCULATION
// ════════════════════════════════════════════════════════════════════════════
describe('calculateOrderSummary', () => {
  it('adds 18% GST on subtotal', () => {
    const result = calculateOrderSummary([{ ...makeCart(1, 1000)[0] }]);
    expect(result.tax).toBe(180);
  });

  it('free shipping above ₹999', () => {
    const result = calculateOrderSummary(makeCart(2, 600));
    expect(result.shipping).toBe(0);
  });

  it('charges ₹49 shipping below ₹999', () => {
    const result = calculateOrderSummary(makeCart(1, 100));
    expect(result.shipping).toBe(49);
  });

  it('applies discount correctly', () => {
    const result = calculateOrderSummary(makeCart(1, 1000), 10);
    expect(result.discount).toBe(100);
    expect(result.subtotal).toBe(1000);
  });

  it('total = subtotal - discount + shipping + tax', () => {
    const items = makeCart(1, 500);
    const result = calculateOrderSummary(items, 0);
    expect(result.total).toBe(result.subtotal + result.shipping + result.tax);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ADDRESS VALIDATION
// ════════════════════════════════════════════════════════════════════════════
describe('validateDeliveryAddress', () => {
  it('passes valid address', () => {
    expect(validateDeliveryAddress(defaultAddress)).toHaveLength(0);
  });

  it('catches missing name', () => {
    const errors = validateDeliveryAddress({ ...defaultAddress, name: '' });
    expect(errors).toContain('Recipient name required');
  });

  it('catches missing city', () => {
    const errors = validateDeliveryAddress({ ...defaultAddress, city: '' });
    expect(errors).toContain('City required');
  });

  it('catches invalid pincode (too short)', () => {
    const errors = validateDeliveryAddress({ ...defaultAddress, pincode: '4000' });
    expect(errors.some(e => e.includes('6 digits'))).toBe(true);
  });

  it('catches invalid pincode (letters)', () => {
    const errors = validateDeliveryAddress({ ...defaultAddress, pincode: 'ABCDEF' });
    expect(errors.some(e => e.includes('6 digits'))).toBe(true);
  });

  it('accepts 6-digit numeric pincode', () => {
    const errors = validateDeliveryAddress({ ...defaultAddress, pincode: '560001' });
    expect(errors).toHaveLength(0);
  });

  it('returns multiple errors for multiple missing fields', () => {
    const errors = validateDeliveryAddress({});
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });
});
