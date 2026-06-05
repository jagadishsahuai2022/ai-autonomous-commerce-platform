/**
 * Shared Auto-Checkout Settings — Single source of truth
 * Used by both Profile page and Wallet page to keep settings in sync.
 */

export interface AutoCheckoutSettings {
  enabled: boolean;
  perOrderLimit: number | null;    // maps to profile.autoPurchaseThreshold / wallet.maxPerOrder
  monthlyBudget: number | null;    // maps to profile.monthlyAiBudget
  dailyLimit: number | null;       // wallet-only
  aiSpendingLimit: number | null;  // wallet AI per-order limit
  defaultDeliveryDays: number;
  defaultPaymentMethod: string;
}

const STORAGE_KEY = 'dc-auto-checkout-settings';

const DEFAULTS: AutoCheckoutSettings = {
  enabled: false,
  perOrderLimit: null,
  monthlyBudget: null,
  dailyLimit: null,
  aiSpendingLimit: null,
  defaultDeliveryDays: 3,
  defaultPaymentMethod: 'wallet',
};

/** Read current settings from localStorage (single source of truth) */
export function getAutoCheckoutSettings(): AutoCheckoutSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Write settings to localStorage and fire sync event */
export function saveAutoCheckoutSettings(partial: Partial<AutoCheckoutSettings>): AutoCheckoutSettings {
  const current = getAutoCheckoutSettings();
  const updated = { ...current, ...partial };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('autoCheckoutSettingsChanged', { detail: updated }));
  }
  return updated;
}

/** Subscribe to settings changes from other pages/components. Returns cleanup fn. */
export function onAutoCheckoutSettingsChanged(callback: (settings: AutoCheckoutSettings) => void): () => void {
  const handler = (e: Event) => {
    const custom = e as CustomEvent<AutoCheckoutSettings>;
    callback(custom.detail);
  };
  window.addEventListener('autoCheckoutSettingsChanged', handler);
  return () => window.removeEventListener('autoCheckoutSettingsChanged', handler);
}

/** Map profile form data → shared settings */
export function fromProfileForm(form: {
  autoPurchaseEnabled?: boolean;
  autoPurchaseThreshold?: number | string;
  monthlyAiBudget?: number | string;
  defaultDeliveryDays?: number | string;
  defaultPaymentMethod?: string;
}): Partial<AutoCheckoutSettings> {
  return {
    enabled: form.autoPurchaseEnabled ?? false,
    perOrderLimit: form.autoPurchaseThreshold ? Number(form.autoPurchaseThreshold) : null,
    monthlyBudget: form.monthlyAiBudget ? Number(form.monthlyAiBudget) : null,
    defaultDeliveryDays: form.defaultDeliveryDays ? Number(form.defaultDeliveryDays) : 3,
    defaultPaymentMethod: form.defaultPaymentMethod || 'wallet',
  };
}

/** Map wallet form data → shared settings */
export function fromWalletForm(form: {
  maxPerOrder?: string;
  dailyLimit?: string;
  isAiAuthorized?: boolean;
  aiSpendingLimit?: string;
}): Partial<AutoCheckoutSettings> {
  return {
    enabled: form.isAiAuthorized ?? false,
    perOrderLimit: form.maxPerOrder ? Number(form.maxPerOrder) : null,
    dailyLimit: form.dailyLimit ? Number(form.dailyLimit) : null,
    aiSpendingLimit: form.aiSpendingLimit ? Number(form.aiSpendingLimit) : null,
  };
}

/** Convert shared settings → wallet settings form shape */
export function toWalletForm(settings: AutoCheckoutSettings) {
  return {
    maxPerOrder: settings.perOrderLimit ? String(settings.perOrderLimit) : '',
    dailyLimit: settings.dailyLimit ? String(settings.dailyLimit) : '',
    isAiAuthorized: settings.enabled,
    aiSpendingLimit: settings.aiSpendingLimit ? String(settings.aiSpendingLimit) : '',
  };
}
