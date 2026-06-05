/**
 * Tests for profile page address management:
 * - Add address with default shipping/billing selection
 * - Form validation logic
 * - Default preference state management
 */
import { describe, it, expect, vi } from 'vitest';

// ── Simulated address form validation ────────────────────────────────────────

interface AddressForm {
  name: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

function validateAddressForm(form: AddressForm): string | null {
  if (!form.name || !form.line1 || !form.city || !form.state || !form.pincode) {
    return 'Fill all required fields';
  }
  if (!/^\d{6}$/.test(form.pincode)) {
    return 'Pincode must be exactly 6 digits';
  }
  if (form.phone) {
    const cleaned = form.phone.replace(/[\s+\-]/g, '').replace(/^0+/, '');
    if (!/^\d{10}$/.test(cleaned)) {
      return 'Phone number must be 10 digits';
    }
  }
  return null;
}

function computeDefaultsAfterAdd(
  currentBillingId: number | null,
  currentShippingId: number | null,
  newAddressId: number,
  setAsDefaultBilling: boolean,
  setAsDefaultShipping: boolean
): { billingId: number | null; shippingId: number | null } {
  return {
    billingId: setAsDefaultBilling ? newAddressId : currentBillingId,
    shippingId: setAsDefaultShipping ? newAddressId : currentShippingId,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Address Form — Validation', () => {
  const validForm: AddressForm = {
    name: 'John Doe',
    line1: '123, Main Street',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
  };

  it('accepts a fully valid form', () => {
    expect(validateAddressForm(validForm)).toBeNull();
  });

  it('rejects missing name', () => {
    expect(validateAddressForm({ ...validForm, name: '' })).toBe('Fill all required fields');
  });

  it('rejects missing line1', () => {
    expect(validateAddressForm({ ...validForm, line1: '' })).toBe('Fill all required fields');
  });

  it('rejects missing city', () => {
    expect(validateAddressForm({ ...validForm, city: '' })).toBe('Fill all required fields');
  });

  it('rejects missing state', () => {
    expect(validateAddressForm({ ...validForm, state: '' })).toBe('Fill all required fields');
  });

  it('rejects missing pincode', () => {
    expect(validateAddressForm({ ...validForm, pincode: '' })).toBe('Fill all required fields');
  });

  it('rejects 5-digit pincode', () => {
    expect(validateAddressForm({ ...validForm, pincode: '56000' })).toBe(
      'Pincode must be exactly 6 digits'
    );
  });

  it('rejects 7-digit pincode', () => {
    expect(validateAddressForm({ ...validForm, pincode: '5600011' })).toBe(
      'Pincode must be exactly 6 digits'
    );
  });

  it('rejects non-numeric pincode', () => {
    expect(validateAddressForm({ ...validForm, pincode: '5600AB' })).toBe(
      'Pincode must be exactly 6 digits'
    );
  });

  it('accepts valid 10-digit phone', () => {
    expect(validateAddressForm({ ...validForm, phone: '9876543210' })).toBeNull();
  });

  it('accepts phone with spaces and strips them', () => {
    expect(validateAddressForm({ ...validForm, phone: '98765 43210' })).toBeNull();
  });

  it('rejects short phone number', () => {
    expect(validateAddressForm({ ...validForm, phone: '98765' })).toBe(
      'Phone number must be 10 digits'
    );
  });

  it('accepts empty phone (optional field)', () => {
    expect(validateAddressForm({ ...validForm, phone: '' })).toBeNull();
  });

  it('accepts undefined phone (optional field)', () => {
    expect(validateAddressForm({ ...validForm, phone: undefined })).toBeNull();
  });
});

describe('Address Defaults — After Add', () => {
  it('sets new address as default shipping when requested', () => {
    const result = computeDefaultsAfterAdd(null, null, 42, false, true);
    expect(result.shippingId).toBe(42);
    expect(result.billingId).toBeNull();
  });

  it('sets new address as default billing when requested', () => {
    const result = computeDefaultsAfterAdd(null, null, 42, true, false);
    expect(result.billingId).toBe(42);
    expect(result.shippingId).toBeNull();
  });

  it('sets new address as both default shipping and billing', () => {
    const result = computeDefaultsAfterAdd(null, null, 42, true, true);
    expect(result.billingId).toBe(42);
    expect(result.shippingId).toBe(42);
  });

  it('does not change existing defaults when neither checkbox is checked', () => {
    const result = computeDefaultsAfterAdd(10, 20, 42, false, false);
    expect(result.billingId).toBe(10);
    expect(result.shippingId).toBe(20);
  });

  it('replaces old shipping default with new address id', () => {
    const result = computeDefaultsAfterAdd(10, 20, 42, false, true);
    expect(result.shippingId).toBe(42);
    expect(result.billingId).toBe(10); // unchanged
  });

  it('replaces old billing default with new address id', () => {
    const result = computeDefaultsAfterAdd(10, 20, 42, true, false);
    expect(result.billingId).toBe(42);
    expect(result.shippingId).toBe(20); // unchanged
  });

  it('new address id becomes both defaults when both checked, overriding old ones', () => {
    const result = computeDefaultsAfterAdd(10, 20, 42, true, true);
    expect(result.billingId).toBe(42);
    expect(result.shippingId).toBe(42);
  });
});

describe('Address Defaults — Delete Logic', () => {
  function handleDeleteDefaults(
    deletedId: number,
    currentBillingId: number | null,
    currentShippingId: number | null
  ) {
    return {
      billingId: currentBillingId === deletedId ? null : currentBillingId,
      shippingId: currentShippingId === deletedId ? null : currentShippingId,
    };
  }

  it('clears billing default when that address is deleted', () => {
    const result = handleDeleteDefaults(10, 10, 20);
    expect(result.billingId).toBeNull();
    expect(result.shippingId).toBe(20);
  });

  it('clears shipping default when that address is deleted', () => {
    const result = handleDeleteDefaults(20, 10, 20);
    expect(result.billingId).toBe(10);
    expect(result.shippingId).toBeNull();
  });

  it('clears both when same-address is billing and shipping default', () => {
    const result = handleDeleteDefaults(10, 10, 10);
    expect(result.billingId).toBeNull();
    expect(result.shippingId).toBeNull();
  });

  it('leaves defaults unchanged when a non-default address is deleted', () => {
    const result = handleDeleteDefaults(99, 10, 20);
    expect(result.billingId).toBe(10);
    expect(result.shippingId).toBe(20);
  });
});
