'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, Minus, ShoppingBag, AlertCircle, ExternalLink } from 'lucide-react';
import { useApiErrorHandler } from '@/hooks/useApiErrorHandler';
import { useCartStore } from '@/lib/stores/cart-store';

export default function CartPage() {
  const router = useRouter();
  const { showSuccess, showWarning } = useApiErrorHandler();
  const { items: cartItems, updateQuantity, removeItem, clearCart, syncFromDB, reloadFromLocal } = useCartStore();

  // Sync cart from DB on mount
  useEffect(() => { syncFromDB(); }, []);

  // Listen for external cart mutations (smart-delegate, shopping-assistant write directly
  // to localStorage + fire 'cartUpdated') so the cart page reflects changes without reload.
  useEffect(() => {
    const handleCartUpdated = () => reloadFromLocal();
    window.addEventListener('cartUpdated', handleCartUpdated);
    // Also handle cross-tab updates via storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'cart') reloadFromLocal();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdated);
      window.removeEventListener('storage', handleStorage);
    };
  }, [reloadFromLocal]);

  // Update quantity
  const handleUpdateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) {
      handleRemoveItem(id);
      return;
    }

    const item = cartItems.find((i) => i.id === id);
    if (!item) return;

    if (newQuantity > item.stock) {
      showWarning(`Only ${item.stock} items available`);
      return;
    }

    updateQuantity(id, newQuantity);
    showSuccess(`Quantity updated`);
  };

  // Remove item
  const handleRemoveItem = (id: string) => {
    removeItem(id);
    showSuccess('Item removed from cart');
  };

  // Clear cart
  const handleClearCart = () => {
    if (confirm('Are you sure you want to clear your cart?')) {
      clearCart();
      showSuccess('Cart cleared');
    }
  };

  // Proceed to checkout
  const handleCheckout = () => {
    if (cartItems.length === 0) {
      showWarning('Cart is empty');
      return;
    }
    router.push('/checkout');
  };

  // Calculate totals
  const internalItems = cartItems.filter(i => i.source !== 'EXTERNAL');
  const externalItems = cartItems.filter(i => i.source === 'EXTERNAL');
  const hasExternalItems = externalItems.length > 0;
  const subtotal = internalItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.18 * 100) / 100;
  const total = subtotal + tax;

  // Proceed to checkout
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Shopping Cart</h1>
          <p className="text-gray-600 mt-2">
            {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} in cart
          </p>
        </div>

        {cartItems.length === 0 ? (
          // Empty Cart
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <ShoppingBag className="mx-auto mb-4 text-gray-400" size={48} />
            <h2 className="text-2xl font-semibold mb-2">Your cart is empty</h2>
            <p className="text-gray-600 mb-6">
              Start shopping and add items to your cart
            </p>
            <Link
              href="/products"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          // Cart Items
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Items List */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white rounded-lg shadow p-4 flex gap-4 hover:shadow-lg transition ${item.source === 'EXTERNAL' ? 'border-l-4 border-amber-400' : ''}`}
                >
                  {/* Image */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-24 h-24 object-cover rounded-lg"
                        onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = `<div class="w-24 h-24 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center rounded-lg"><span class="text-2xl">📦</span></div>`; }}
                      />
                    ) : (
                      <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center rounded-lg">
                        <span className="text-2xl">📦</span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-grow">
                    <div className="flex items-center gap-2">
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-lg text-blue-600 hover:text-blue-800 hover:underline">
                          {item.name}
                        </a>
                      ) : item.productId?.startsWith('synth-') || item.productId?.startsWith('sl-') ? (
                        <span className="font-semibold text-lg text-gray-900">
                          {item.name}
                        </span>
                      ) : (
                        <Link href={`/products/${item.productId}`} className="font-semibold text-lg text-blue-600 hover:text-blue-800 hover:underline">
                          {item.name}
                        </Link>
                      )}
                      {item.source === 'EXTERNAL' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                          <ExternalLink className="w-3 h-3" /> External
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mt-1">₹{item.price.toFixed(2)}</p>

                    {item.source === 'EXTERNAL' && item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-sm text-amber-600 hover:text-amber-700 font-medium">
                        <ExternalLink className="w-3.5 h-3.5" /> View on External Site
                      </a>
                    )}

                    {item.stock < 5 && item.stock > 0 && (
                      <p className="text-orange-600 text-sm mt-2">
                        Only {item.stock} left in stock
                      </p>
                    )}
                  </div>

                  {/* Quantity Control */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                      className="p-2 border rounded-lg hover:bg-gray-100 transition"
                      title="Decrease quantity"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-12 text-center font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                      className="p-2 border rounded-lg hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Increase quantity"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Price & Remove */}
                  <div className="flex flex-col items-end justify-between">
                    <p className="font-bold text-lg">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </p>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition"
                      title="Remove item"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Continue Shopping */}
              <Link
                href="/products"
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                ← Continue Shopping
              </Link>
            </div>

            {/* Summary Sidebar */}
            <div>
              {/* Order Summary Card */}
              <div className="bg-white rounded-lg shadow p-6 sticky top-20 space-y-4">
                <h2 className="text-lg font-semibold">Order Summary</h2>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax (18% GST)</span>
                    <span>₹{tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Free Shipping</span>
                    <span>₹0.00</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span>Total</span>
                    <span className="text-blue-600">₹{total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Important Note */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
                  <p className="text-blue-800">
                    ✓ Tax will be calculated at checkout based on your delivery location
                  </p>
                </div>

                {hasExternalItems && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs space-y-1">
                    <p className="text-amber-800 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> External products cannot be checked out
                    </p>
                    <p className="text-amber-700">
                      {externalItems.length} external item{externalItems.length > 1 ? 's' : ''} must be purchased on their original site.
                      Only internal products ({internalItems.length}) will proceed to checkout.
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={handleCheckout}
                    disabled={internalItems.length === 0}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {internalItems.length === 0 ? 'No Checkable Items' : `Proceed to Checkout${hasExternalItems ? ` (${internalItems.length} items)` : ''}`}
                  </button>
                  <button
                    onClick={handleClearCart}
                    className="w-full px-4 py-3 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition"
                  >
                    Clear Cart
                  </button>
                </div>

                {/* Secure Checkout Badge */}
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 111.414 1.414L7.414 9l3.293 3.293a1 1 0 11-1.414 1.414l-4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Secure checkout
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
