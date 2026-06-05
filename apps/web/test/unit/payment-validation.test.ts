/**
 * Unit Tests — Payment Validation Logic
 * Tests the validation rules used in wallet and checkout payment forms.
 */
import { describe, it, expect } from 'vitest';

// ── Validation logic extracted from wallet/page.tsx ──────────────────────────

interface ValidationErrors {
  [key: string]: string;
}

function validatePaymentDetails(params: {
  amount: string;
  paymentMethod: string;
  upiId?: string;
  cardNumber?: string;
  cardName?: string;
  cardExpiry?: string;
  cardCvv?: string;
  bankName?: string;
  mockBypass?: boolean;
}): ValidationErrors {
  if (params.mockBypass) return {};

  const errors: ValidationErrors = {};
  const amount = parseFloat(params.amount);

  if (!amount || amount <= 0) errors.amount = 'Enter a valid amount';
  if (amount > 100000) errors.amount = 'Maximum ₹1,00,000 per transaction';

  if (params.paymentMethod === 'upi') {
    if (!params.upiId || !params.upiId.includes('@') || params.upiId.length < 5)
      errors.upiId = 'Enter a valid UPI ID (e.g., name@upi)';
  } else if (params.paymentMethod === 'credit_card' || params.paymentMethod === 'debit_card') {
    const digits = (params.cardNumber || '').replace(/\s/g, '');
    if (digits.length < 15 || digits.length > 19)
      errors.cardNumber = 'Card number must be 15-19 digits';
    if (!params.cardName || params.cardName.trim().length < 2)
      errors.cardName = 'Enter cardholder name';
    if (!params.cardExpiry || !/^\d{2}\/\d{2}$/.test(params.cardExpiry))
      errors.cardExpiry = 'Enter valid expiry (MM/YY)';
    else {
      const [mm, yy] = params.cardExpiry.split('/').map(Number);
      if (mm < 1 || mm > 12) errors.cardExpiry = 'Invalid month';
      else {
        const now = new Date();
        const expDate = new Date(2000 + yy, mm);
        if (expDate < now) errors.cardExpiry = 'Card has expired';
      }
    }
    if (!params.cardCvv || params.cardCvv.length < 3 || params.cardCvv.length > 4)
      errors.cardCvv = 'CVV must be 3-4 digits';
  } else if (params.paymentMethod === 'net_banking') {
    if (!params.bankName) errors.bankName = 'Select a bank';
  }

  return errors;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Payment Validation — Amount', () => {
  it('rejects empty amount', () => {
    const errors = validatePaymentDetails({ amount: '', paymentMethod: 'upi' });
    expect(errors.amount).toBeDefined();
  });

  it('rejects zero amount', () => {
    const errors = validatePaymentDetails({ amount: '0', paymentMethod: 'upi' });
    expect(errors.amount).toBeDefined();
  });

  it('rejects negative amount', () => {
    const errors = validatePaymentDetails({ amount: '-500', paymentMethod: 'upi' });
    expect(errors.amount).toBeDefined();
  });

  it('rejects amount over 100000', () => {
    const errors = validatePaymentDetails({
      amount: '200000',
      paymentMethod: 'upi',
      upiId: 'test@upi',
    });
    expect(errors.amount).toContain('1,00,000');
  });

  it('accepts valid amount', () => {
    const errors = validatePaymentDetails({
      amount: '500',
      paymentMethod: 'upi',
      upiId: 'test@upi',
    });
    expect(errors.amount).toBeUndefined();
  });
});

describe('Payment Validation — UPI', () => {
  it('rejects UPI ID without @', () => {
    const errors = validatePaymentDetails({
      amount: '100',
      paymentMethod: 'upi',
      upiId: 'invalid',
    });
    expect(errors.upiId).toBeDefined();
  });

  it('rejects too-short UPI ID', () => {
    const errors = validatePaymentDetails({ amount: '100', paymentMethod: 'upi', upiId: 'a@b' });
    expect(errors.upiId).toBeDefined();
  });

  it('rejects empty UPI ID', () => {
    const errors = validatePaymentDetails({ amount: '100', paymentMethod: 'upi', upiId: '' });
    expect(errors.upiId).toBeDefined();
  });

  it('accepts valid UPI ID', () => {
    const errors = validatePaymentDetails({
      amount: '100',
      paymentMethod: 'upi',
      upiId: 'user@paytm',
    });
    expect(errors.upiId).toBeUndefined();
  });

  it('accepts UPI ID with long format', () => {
    const errors = validatePaymentDetails({
      amount: '100',
      paymentMethod: 'upi',
      upiId: 'myname.surname@okaxis',
    });
    expect(errors.upiId).toBeUndefined();
  });
});

describe('Payment Validation — Credit/Debit Card', () => {
  const validCard = {
    amount: '5000',
    paymentMethod: 'credit_card',
    cardNumber: '4111 1111 1111 1111',
    cardName: 'Test User',
    cardExpiry: '12/30',
    cardCvv: '123',
  };

  it('accepts fully valid card details', () => {
    const errors = validatePaymentDetails(validCard);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('rejects card number shorter than 15 digits', () => {
    const errors = validatePaymentDetails({ ...validCard, cardNumber: '1234 5678' });
    expect(errors.cardNumber).toBeDefined();
  });

  it('rejects card number longer than 19 digits', () => {
    const errors = validatePaymentDetails({ ...validCard, cardNumber: '12345678901234567890' });
    expect(errors.cardNumber).toBeDefined();
  });

  it('accepts 15-digit card (Amex)', () => {
    const errors = validatePaymentDetails({ ...validCard, cardNumber: '378282246310005' });
    expect(errors.cardNumber).toBeUndefined();
  });

  it('rejects empty cardholder name', () => {
    const errors = validatePaymentDetails({ ...validCard, cardName: '' });
    expect(errors.cardName).toBeDefined();
  });

  it('rejects single-char cardholder name', () => {
    const errors = validatePaymentDetails({ ...validCard, cardName: 'A' });
    expect(errors.cardName).toBeDefined();
  });

  it('rejects invalid expiry format', () => {
    const errors = validatePaymentDetails({ ...validCard, cardExpiry: '2030' });
    expect(errors.cardExpiry).toBeDefined();
  });

  it('rejects month > 12', () => {
    const errors = validatePaymentDetails({ ...validCard, cardExpiry: '13/30' });
    expect(errors.cardExpiry).toContain('month');
  });

  it('rejects month 0', () => {
    const errors = validatePaymentDetails({ ...validCard, cardExpiry: '00/30' });
    expect(errors.cardExpiry).toContain('month');
  });

  it('rejects expired card', () => {
    const errors = validatePaymentDetails({ ...validCard, cardExpiry: '01/20' });
    expect(errors.cardExpiry).toContain('expired');
  });

  it('accepts future expiry', () => {
    const errors = validatePaymentDetails({ ...validCard, cardExpiry: '12/35' });
    expect(errors.cardExpiry).toBeUndefined();
  });

  it('rejects CVV shorter than 3 digits', () => {
    const errors = validatePaymentDetails({ ...validCard, cardCvv: '12' });
    expect(errors.cardCvv).toBeDefined();
  });

  it('rejects CVV longer than 4 digits', () => {
    const errors = validatePaymentDetails({ ...validCard, cardCvv: '12345' });
    expect(errors.cardCvv).toBeDefined();
  });

  it('accepts 4-digit CVV (Amex)', () => {
    const errors = validatePaymentDetails({ ...validCard, cardCvv: '1234' });
    expect(errors.cardCvv).toBeUndefined();
  });

  it('works for debit_card payment method too', () => {
    const errors = validatePaymentDetails({ ...validCard, paymentMethod: 'debit_card' });
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('Payment Validation — Net Banking', () => {
  it('rejects when no bank selected', () => {
    const errors = validatePaymentDetails({
      amount: '1000',
      paymentMethod: 'net_banking',
      bankName: '',
    });
    expect(errors.bankName).toBeDefined();
  });

  it('accepts when bank is selected', () => {
    const errors = validatePaymentDetails({
      amount: '1000',
      paymentMethod: 'net_banking',
      bankName: 'SBI',
    });
    expect(errors.bankName).toBeUndefined();
  });
});

describe('Payment Validation — Mock Bypass', () => {
  it('skips all validation when mockBypass is true', () => {
    const errors = validatePaymentDetails({
      amount: '',
      paymentMethod: 'credit_card',
      cardNumber: '',
      cardName: '',
      cardExpiry: '',
      cardCvv: '',
      mockBypass: true,
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('validates normally when mockBypass is false', () => {
    const errors = validatePaymentDetails({
      amount: '',
      paymentMethod: 'credit_card',
      cardNumber: '',
      cardName: '',
      cardExpiry: '',
      cardCvv: '',
      mockBypass: false,
    });
    expect(Object.keys(errors).length).toBeGreaterThan(0);
  });
});
