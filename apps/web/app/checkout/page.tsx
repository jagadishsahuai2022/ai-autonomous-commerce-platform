'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, AlertCircle, Loader2, Plus, MapPin, CreditCard, CheckCircle2, Package, Wallet } from 'lucide-react';
import { fetchWithRetry } from '@/lib/safe-api';
import { initiateWalletPayment, processWalletDebit, markOrderPlaced, markOrderFailed } from '@/lib/wallet-transactions';
import Link from 'next/link';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  url?: string;
}

interface Address {
  id: string;
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

const SHIPPING_OPTIONS = [
  { id: 'standard', label: 'Standard Delivery', days: '5-7 business days', cost: 0 },
  { id: 'express', label: 'Express Delivery', days: '2-3 business days', cost: 99 },
  { id: 'overnight', label: 'Overnight Delivery', days: 'Next business day', cost: 299 },
];

const PAYMENT_OPTIONS = [
  { id: 'upi', label: 'UPI / PhonePe / GPay', icon: '📱' },
  { id: 'card', label: 'Credit / Debit Card', icon: '💳' },
  { id: 'wallet', label: 'DelegateCart Wallet', icon: '👛' },
  { id: 'netbanking', label: 'Net Banking', icon: '🏦' },
  { id: 'cod', label: 'Cash on Delivery', icon: '💵' },
  { id: 'emi', label: 'EMI (No Cost)', icon: '📅' },
];

const STEPS = ['Address', 'Shipping', 'Payment', 'Review'];

export default function CheckoutPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [selectedShipping, setSelectedShipping] = useState('standard');
  const [selectedPayment, setSelectedPayment] = useState('upi');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [newAddr, setNewAddr] = useState({ name: '', phone: '', line1: '', city: '', state: '', pincode: '' });

  // Payment details
  const buildTimeMock = process.env.NEXT_PUBLIC_ENABLE_MOCK_PAYMENT === 'true';
  // Runtime override: show toggle only in development environments (never in production)
  const showMockToggle = process.env.NODE_ENV === 'development' && buildTimeMock;
  const [mockBypass, setMockBypass] = useState(false); // default false for safety; restored from localStorage in useEffect
  const isMockPayment = showMockToggle && mockBypass;
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [emiTenure, setEmiTenure] = useState('3');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const toggleMockBypass = (enabled: boolean) => {
    setMockBypass(enabled);
    localStorage.setItem('mockPaymentBypass', enabled ? 'true' : 'false');
  };

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('authToken');
    setAuthToken(token);
    // Restore runtime mock payment toggle (default to build-time env value)
    const saved = localStorage.getItem('mockPaymentBypass');
    setMockBypass(saved !== null ? saved === 'true' : buildTimeMock);

    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        // Filter out EXTERNAL items — they cannot be checked out
        const parsed: CartItem[] = JSON.parse(savedCart);
        setCartItems(parsed.filter((item: any) => item.source !== 'EXTERNAL'));
      } catch { }
    }

    // Load addresses from API (with localStorage fallback)
    const loadAddresses = async () => {
      if (!token) return;
      // Fetch wallet balance
      try {
        const wRes = await fetch('/api/wallet', { headers: { Authorization: `Bearer ${token}`, 'x-user-email': localStorage.getItem('userEmail') || '' } });
        if (wRes.ok) { const wData = await wRes.json(); setWalletBalance(wData.wallet?.balance ?? 0); }
      } catch { }
      try {
        const res = await fetch('/api/user/addresses', {
          headers: { Authorization: `Bearer ${token}`, 'x-user-email': localStorage.getItem('userEmail') || '' },
        });
        if (res.ok) {
          const data = await res.json();
          const apiAddrs: Address[] = (data.addresses || []).map((a: any) => ({
            id: String(a.id),
            name: a.name,
            phone: a.phone || '',
            line1: a.line1,
            city: a.city,
            state: a.state,
            pincode: a.pincode,
            isDefault: a.isDefault || false,
          }));
          if (apiAddrs.length > 0) {
            setAddresses(apiAddrs);
            // Auto-select: check profile default shipping, then first default, then first address
            try {
              const profileRes = await fetch('/api/user/profile', { headers: { Authorization: `Bearer ${token}`, 'x-user-email': localStorage.getItem('userEmail') || '' } });
              if (profileRes.ok) {
                const profile = await profileRes.json();
                const defaultShipId = profile.defaultShippingAddressId ? String(profile.defaultShippingAddressId) : null;
                if (defaultShipId && apiAddrs.some(a => a.id === defaultShipId)) {
                  setSelectedAddressId(defaultShipId);
                  return;
                }
              }
            } catch { }
            const def = apiAddrs.find(a => a.isDefault) || apiAddrs[0];
            if (def) setSelectedAddressId(def.id);
            return;
          }
        }
      } catch { }
      // Fallback to localStorage
      const savedAddresses = localStorage.getItem('addresses');
      if (savedAddresses) {
        try {
          const addrs: Address[] = JSON.parse(savedAddresses);
          setAddresses(addrs);
          const def = addrs.find(a => a.isDefault) || addrs[0];
          if (def) setSelectedAddressId(def.id);
        } catch { }
      }
    };
    loadAddresses();
  }, []);

  if (!mounted) return <div className="min-h-screen bg-gray-50" />;

  if (!authToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-4">
        <AlertCircle className="text-red-500 w-12 h-12" />
        <h2 className="text-xl font-bold text-gray-800">Please log in to checkout</h2>
        <p className="text-gray-600">You need to be logged in to place an order.</p>
        <Link href="/signin?redirect=/checkout" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
          Sign In to Continue
        </Link>
        <Link href="/cart" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Cart
        </Link>
      </div>
    );
  }

  if (cartItems.length === 0 && !orderPlaced) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-4">
        <Package className="text-gray-400 w-12 h-12" />
        <h2 className="text-xl font-bold text-gray-800">Your cart is empty</h2>
        <Link href="/products" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
          Browse Products
        </Link>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="text-green-600 w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Order Placed Successfully!</h2>
        <p className="text-gray-600">Your order ID: <strong>{orderId}</strong></p>
        <p className="text-gray-500">You will receive a confirmation email shortly.</p>
        <div className="flex gap-3">
          <Link href="/dashboard" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            Go to Dashboard
          </Link>
          <Link href="/products" className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCost = SHIPPING_OPTIONS.find(o => o.id === selectedShipping)?.cost || 0;
  const tax = Math.round(subtotal * 18) / 100;
  const total = subtotal + shippingCost + tax;

  const selectedAddress = addresses.find(a => a.id === selectedAddressId);

  const handleAddAddress = async () => {
    if (!newAddr.name || !newAddr.phone || !newAddr.line1 || !newAddr.city || !newAddr.state || !newAddr.pincode) {
      alert('Please fill all address fields');
      return;
    }
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const res = await fetch('/api/user/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-user-email': localStorage.getItem('userEmail') || '' },
          body: JSON.stringify(newAddr),
        });
        if (res.ok) {
          const data = await res.json();
          const apiAddr: Address = {
            id: String(data.address.id),
            name: data.address.name,
            phone: data.address.phone || '',
            line1: data.address.line1,
            city: data.address.city,
            state: data.address.state,
            pincode: data.address.pincode,
            isDefault: data.address.isDefault || false,
          };
          const updated = [...addresses, apiAddr];
          setAddresses(updated);
          setSelectedAddressId(apiAddr.id);
          setShowAddressForm(false);
          setNewAddr({ name: '', phone: '', line1: '', city: '', state: '', pincode: '' });
          return;
        }
      } catch { }
    }
    // Fallback to localStorage
    const addr: Address = {
      id: `addr-${Date.now()}`,
      ...newAddr,
      isDefault: addresses.length === 0,
    };
    const updated = [...addresses, addr];
    setAddresses(updated);
    localStorage.setItem('addresses', JSON.stringify(updated));
    setSelectedAddressId(addr.id);
    setShowAddressForm(false);
    setNewAddr({ name: '', phone: '', line1: '', city: '', state: '', pincode: '' });
  };

  const handlePlaceOrder = async () => {
    setIsPlacingOrder(true);
    // Simulate order processing
    await new Promise(r => setTimeout(r, 1500));
    const localId = `ORD-${Date.now().toString().slice(-8)}`;
    const aiAssisted = localStorage.getItem('cartFromAI') === 'true';

    // Save order to localStorage first (immediate feedback)
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.unshift({
      id: localId,
      items: cartItems,
      total,
      status: 'confirmed',
      paymentMethod: selectedPayment,
      address: selectedAddress,
      createdAt: new Date().toISOString(),
      aiAssisted,
    });
    localStorage.setItem('orders', JSON.stringify(orders));

    // Save order to DB (async — don't block UI)
    const token = localStorage.getItem('authToken') || '';
    let dbOrderId = localId;

    // Debit wallet if wallet payment selected — uses idempotent transaction service
    let walletTxnId: string | null = null;
    if (selectedPayment === 'wallet' && token) {
      try {
        const txn = initiateWalletPayment('current-user', localId, total);
        walletTxnId = txn.id;
        processWalletDebit(txn.id, token);
        await fetchWithRetry('/api/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-user-email': localStorage.getItem('userEmail') || '' },
          body: JSON.stringify({ action: 'debit', amount: total, description: `Order ${localId}` }),
        });
      } catch (e) {
        console.warn('[checkout] Wallet debit failed:', e);
        if (walletTxnId) markOrderFailed(walletTxnId, 'Wallet debit API failed');
      }
    }

    try {
      const res = await fetchWithRetry('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          items: cartItems.map(item => ({
            productId: item.productId && /^\d+$/.test(item.productId) ? parseInt(item.productId, 10) : undefined,
            productSlug: item.productId && /^\d+$/.test(item.productId) ? item.productId : undefined,
            productName: item.name,
            quantity: item.quantity,
            price: item.price,
            imageUrl: item.image,
          })),
          total,
          aiAssisted,
          paymentMethod: selectedPayment,
          shippingAddress: selectedAddress,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.order?.orderNumber) dbOrderId = data.order.orderNumber;
        if (walletTxnId) markOrderPlaced(walletTxnId);
      }
    } catch (e) {
      console.warn('[checkout] DB order save failed (localStorage backup retained):', e);
      if (walletTxnId) markOrderFailed(walletTxnId, 'Order API call failed');
    }

    setOrderId(dbOrderId);
    localStorage.removeItem('cartFromAI');
    localStorage.removeItem('cart');
    window.dispatchEvent(new Event('cartUpdated'));
    setIsPlacingOrder(false);
    setOrderPlaced(true);
  };

  const isPaymentDetailsFilled = () => {
    if (isMockPayment) return true;
    switch (selectedPayment) {
      case 'upi': return upiId.includes('@') && upiId.length > 4;
      case 'card': {
        const digits = cardNumber.replace(/[\s-]/g, '');
        if (digits.length < 15 || digits.length > 19) return false;
        if (!cardExpiry.match(/^\d{2}\/\d{2}$/)) return false;
        const [mm, yy] = cardExpiry.split('/').map(Number);
        if (mm < 1 || mm > 12) return false;
        const now = new Date();
        if (new Date(2000 + yy, mm) < now) return false;
        if (cardCvv.length < 3 || cardCvv.length > 4) return false;
        if (cardName.trim().length < 2) return false;
        return true;
      }
      case 'netbanking': return !!selectedBank;
      case 'wallet': return walletBalance !== null && walletBalance >= total;
      case 'cod': return true;
      case 'emi': return !!selectedBank;
      default: return false;
    }
  };

  const canProceed = currentStep === 0 ? !!selectedAddressId
    : currentStep === 1 ? !!selectedShipping
      : currentStep === 2 ? (!!selectedPayment && isPaymentDetailsFilled())
        : true;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i < currentStep ? 'bg-green-600 text-white' : i === currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                {i < currentStep ? '✓' : i + 1}
              </div>
              <span className={`text-sm font-medium ${i === currentStep ? 'text-blue-600' : i < currentStep ? 'text-green-600' : 'text-gray-400'}`}>
                {step}
              </span>
              {i < STEPS.length - 1 && <ChevronRight size={16} className="text-gray-300 mx-1" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
            {/* Step 0: Address */}
            {currentStep === 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin size={20} className="text-blue-600" /> Delivery Address
                </h2>

                {addresses.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {addresses.map(addr => (
                      <label key={addr.id} className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${selectedAddressId === addr.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="radio" name="address" checked={selectedAddressId === addr.id} onChange={() => setSelectedAddressId(addr.id)} className="mt-1" />
                        <div>
                          <p className="font-semibold text-gray-900">{addr.name} <span className="text-gray-500 font-normal">· {addr.phone}</span></p>
                          <p className="text-sm text-gray-600">{addr.line1}, {addr.city}, {addr.state} - {addr.pincode}</p>
                          {addr.isDefault && <span className="text-xs text-blue-600 font-medium">Default</span>}
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {!showAddressForm && (
                  <button onClick={() => setShowAddressForm(true)} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
                    <Plus size={16} /> Add New Address
                  </button>
                )}

                {showAddressForm && (
                  <div className="border border-gray-200 rounded-lg p-4 space-y-3 mt-3">
                    <h3 className="font-semibold text-gray-800">New Address</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Full Name *" value={newAddr.name} onChange={e => setNewAddr({ ...newAddr, name: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <input placeholder="Phone Number *" value={newAddr.phone} onChange={e => setNewAddr({ ...newAddr, phone: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <input placeholder="Address Line 1 *" value={newAddr.line1} onChange={e => setNewAddr({ ...newAddr, line1: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <div className="grid grid-cols-3 gap-3">
                      <input placeholder="City *" value={newAddr.city} onChange={e => setNewAddr({ ...newAddr, city: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <input placeholder="State *" value={newAddr.state} onChange={e => setNewAddr({ ...newAddr, state: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <input placeholder="PIN Code *" value={newAddr.pincode} onChange={e => setNewAddr({ ...newAddr, pincode: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAddAddress} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Save Address</button>
                      <button onClick={() => setShowAddressForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Shipping */}
            {currentStep === 1 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Shipping Method</h2>
                <div className="space-y-3">
                  {SHIPPING_OPTIONS.map(opt => (
                    <label key={opt.id} className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${selectedShipping === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center gap-3">
                        <input type="radio" name="shipping" checked={selectedShipping === opt.id} onChange={() => setSelectedShipping(opt.id)} />
                        <div>
                          <p className="font-semibold text-gray-900">{opt.label}</p>
                          <p className="text-sm text-gray-500">{opt.days}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-gray-900">{opt.cost === 0 ? 'FREE' : `₹${opt.cost}`}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Payment */}
            {currentStep === 2 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard size={20} className="text-blue-600" /> Payment Method
                </h2>

                {/* Dev-only mock bypass banner */}
                {showMockToggle && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="mock-payment-bypass"
                        checked={mockBypass}
                        onChange={e => toggleMockBypass(e.target.checked)}
                        className="w-4 h-4 accent-amber-600 cursor-pointer"
                      />
                      <label htmlFor="mock-payment-bypass" className="flex-1 text-sm font-medium text-amber-800 cursor-pointer select-none">
                        {mockBypass
                          ? 'Bypass payment processing — payment will be simulated'
                          : 'Payment processing active — real details required'}
                      </label>
                      <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">DEV ONLY</span>
                    </div>
                    <p className="text-xs text-amber-600 mt-1.5 ml-7">
                      Toggle to {mockBypass ? 'show real payment form' : 'skip payment details'}. State saved in localStorage.
                    </p>
                  </div>
                )}

                {/* Payment method radio list */}
                <div className="space-y-3">
                  {PAYMENT_OPTIONS.map(opt => (
                    <label key={opt.id} className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${selectedPayment === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="payment" checked={selectedPayment === opt.id} onChange={() => setSelectedPayment(opt.id)} />
                      <span className="text-xl">{opt.icon}</span>
                      <span className="font-medium text-gray-900">{opt.label}</span>
                    </label>
                  ))}
                </div>

                {/* Wallet balance info */}
                {selectedPayment === 'wallet' && (
                  <div className={`mt-4 p-4 rounded-xl border ${walletBalance !== null && walletBalance >= total ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet size={18} className={walletBalance !== null && walletBalance >= total ? 'text-green-600' : 'text-amber-600'} />
                        <span className="text-sm font-medium text-gray-800">Wallet Balance</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">₹{(walletBalance ?? 0).toLocaleString('en-IN')}</span>
                    </div>
                    {walletBalance !== null && walletBalance < total && (
                      <p className="text-xs text-amber-700 mt-2">Insufficient balance. You need ₹{(total - walletBalance).toLocaleString('en-IN')} more. <Link href="/wallet" className="underline font-medium">Add funds →</Link></p>
                    )}
                    {walletBalance !== null && walletBalance >= total && (
                      <p className="text-xs text-green-700 mt-1">₹{total.toLocaleString('en-IN')} will be debited from your wallet.</p>
                    )}
                  </div>
                )}

                {/* Payment detail form — shown only in PROD mode (ENABLE_MOCK_PAYMENT=false) */}
                {!isMockPayment && selectedPayment !== 'cod' && selectedPayment !== 'wallet' && (
                  <div className="mt-5 p-4 border border-gray-200 rounded-xl bg-gray-50 space-y-3">
                    <p className="text-sm font-semibold text-gray-800">Payment Details</p>

                    {selectedPayment === 'upi' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">UPI ID</label>
                        <input
                          type="text"
                          placeholder="yourname@upi (e.g. test@okaxis)"
                          value={upiId}
                          onChange={e => setUpiId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">Enter a valid UPI ID to proceed</p>
                      </div>
                    )}

                    {selectedPayment === 'card' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Card Number</label>
                          <input
                            type="text"
                            placeholder="1234 5678 9012 3456"
                            maxLength={19}
                            value={cardNumber}
                            onChange={e => {
                              const v = e.target.value.replace(/\D/g, '').slice(0, 16);
                              setCardNumber(v.replace(/(\d{4})(?=\d)/g, '$1 '));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Expiry (MM/YY)</label>
                            <input
                              type="text"
                              placeholder="MM/YY"
                              maxLength={5}
                              value={cardExpiry}
                              onChange={e => {
                                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setCardExpiry(v.length > 2 ? v.slice(0, 2) + '/' + v.slice(2) : v);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">CVV</label>
                            <input
                              type="password"
                              placeholder="•••"
                              maxLength={4}
                              value={cardCvv}
                              onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Name on Card</label>
                            <input
                              type="text"
                              placeholder="Full Name"
                              value={cardName}
                              onChange={e => setCardName(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400">Use Razorpay test card: 4111 1111 1111 1111 / 12/26 / 123</p>
                      </div>
                    )}

                    {selectedPayment === 'netbanking' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Select Bank</label>
                        <select
                          value={selectedBank}
                          onChange={e => setSelectedBank(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">Choose your bank</option>
                          <option value="HDFC">HDFC Bank</option>
                          <option value="SBI">State Bank of India</option>
                          <option value="ICICI">ICICI Bank</option>
                          <option value="AXIS">Axis Bank</option>
                          <option value="KOTAK">Kotak Mahindra Bank</option>
                          <option value="PNB">Punjab National Bank</option>
                          <option value="BOB">Bank of Baroda</option>
                          <option value="YES">Yes Bank</option>
                        </select>
                      </div>
                    )}

                    {selectedPayment === 'emi' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Bank / Card Issuer</label>
                          <select
                            value={selectedBank}
                            onChange={e => setSelectedBank(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="">Select bank</option>
                            <option value="HDFC">HDFC Bank</option>
                            <option value="ICICI">ICICI Bank</option>
                            <option value="AXIS">Axis Bank</option>
                            <option value="KOTAK">Kotak Mahindra Bank</option>
                            <option value="SBI">SBI Card</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tenure</label>
                          <select
                            value={emiTenure}
                            onChange={e => setEmiTenure(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="3">3 months (No Cost)</option>
                            <option value="6">6 months (No Cost)</option>
                            <option value="9">9 months (No Cost)</option>
                            <option value="12">12 months</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-blue-600 mt-1">
                      ℹ️ To enable live payment processing, set{' '}
                      <code className="bg-blue-50 px-1 rounded">NEXT_PUBLIC_RAZORPAY_KEY_ID</code> in your environment.
                      Get your test key at{' '}
                      <span className="underline cursor-pointer">dashboard.razorpay.com</span>.
                    </p>
                  </div>
                )}

                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <p className="text-sm text-green-700">100% Secure payments powered by RazorPay</p>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {currentStep === 3 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Review Your Order</h2>
                <div className="space-y-4">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt={item.name} loading="lazy" className="w-12 h-12 object-cover rounded" onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<span class="text-lg">📦</span>'; }} />
                        ) : (
                          <span className="text-lg">📦</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate block">{item.name}</a>
                        ) : item.productId && /^\d+$/.test(item.productId) ? (
                          <Link href={`/products/${item.productId}`} className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate block">{item.name}</Link>
                        ) : (
                          <Link href={`/products?search=${encodeURIComponent(item.name)}`} className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate block">{item.name}</Link>
                        )}
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-gray-900">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                    </div>
                  ))}
                  <div className="border-t pt-4 space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Delivery to</span>
                      <span className="text-right">{selectedAddress?.name}, {selectedAddress?.city}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Shipping</span>
                      <span>{SHIPPING_OPTIONS.find(o => o.id === selectedShipping)?.label}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Payment</span>
                      <span>{PAYMENT_OPTIONS.find(o => o.id === selectedPayment)?.label}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-6 pt-4 border-t">
              {currentStep > 0 && (
                <button onClick={() => setCurrentStep(s => s - 1)} className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Back
                </button>
              )}
              {currentStep < STEPS.length - 1 ? (
                <button onClick={() => setCurrentStep(s => s + 1)} disabled={!canProceed} className="flex-1 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  Continue <ChevronRight size={18} />
                </button>
              ) : (
                <button onClick={handlePlaceOrder} disabled={isPlacingOrder} className="flex-1 px-5 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {isPlacingOrder ? <><Loader2 size={18} className="animate-spin" /> Placing Order...</> : '🎉 Place Order'}
                </button>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-xl shadow-sm p-6 h-fit sticky top-20">
            <h3 className="font-bold text-gray-900 mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm mb-4">
              {cartItems.map(item => (
                <div key={item.id} className="flex justify-between text-gray-600">
                  <span className="truncate pr-2">{item.name} ×{item.quantity}</span>
                  <span className="shrink-0">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span><span>{shippingCost === 0 ? 'FREE' : `₹${shippingCost}`}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>GST (18%)</span><span>₹{tax.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 text-base border-t pt-2">
                <span>Total</span><span>₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-xs text-gray-500">
              <p>✓ Free returns within 10 days</p>
              <p>✓ Secure 256-bit SSL encryption</p>
              <p>✓ 24/7 customer support</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
