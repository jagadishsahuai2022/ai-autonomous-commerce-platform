/**
 * ChatMessage Component
 * Individual chat message display with product recommendations
 */

'use client';

import React, { useState } from 'react';
import { Clock, ShoppingCart, Tag, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  rating?: number;
  reviews?: number;
  description?: string;
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string | Date;
  products?: Product[];
  intent?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  content,
  timestamp,
  products,
  intent,
}) => {
  const isUser = role === 'user';

  const formatTime = (time: string | Date | undefined) => {
    if (!time) return null;
    try {
      const date = typeof time === 'string' ? new Date(time) : time;
      return format(date, 'HH:mm');
    } catch {
      return null;
    }
  };

  const renderProductCard = (product: Product) => {
    const [inCart, setInCart] = React.useState(() => {
      try {
        const raw = localStorage.getItem('cart');
        const cart: Array<{ productId: string }> = raw ? JSON.parse(raw) : [];
        return cart.some((i) => i.productId === String(product.id));
      } catch { return false; }
    });

    // Listen for cartUpdated events to sync state
    React.useEffect(() => {
      const sync = () => {
        try {
          const raw = localStorage.getItem('cart');
          const cart: Array<{ productId: string }> = raw ? JSON.parse(raw) : [];
          setInCart(cart.some((i) => i.productId === String(product.id)));
        } catch { /* ignore */ }
      };
      window.addEventListener('cartUpdated', sync);
      return () => window.removeEventListener('cartUpdated', sync);
    }, [product.id]);

    const handleToggleCart = () => {
      try {
        const raw = localStorage.getItem('cart');
        const cart: Array<{
          id: string; productId: string; name: string;
          price: number; quantity: number; stock: number;
        }> = raw ? JSON.parse(raw) : [];

        if (inCart) {
          // Remove from cart
          const updated = cart.filter((i) => i.productId !== String(product.id));
          localStorage.setItem('cart', JSON.stringify(updated));
        } else {
          // Add to cart
          const existing = cart.find((i) => i.productId === String(product.id));
          if (!existing) {
            cart.push({
              id: `cart-${product.id}-${Date.now()}`,
              productId: String(product.id),
              name: product.name,
              price: product.price,
              quantity: 1,
              stock: 99,
            });
            localStorage.setItem('cart', JSON.stringify(cart));
          }
        }
        window.dispatchEvent(new Event('cartUpdated'));
      } catch {}
      setInCart(!inCart);
    };

    return (
    <div
      key={product.id}
      className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-sm text-gray-800 line-clamp-2">
          {product.name}
        </h4>
        <Tag className="w-4 h-4 text-blue-600 flex-shrink-0 ml-2" />
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-bold text-blue-600">
          ₹{product.price.toLocaleString('en-IN')}
        </span>
        {product.rating && (
          <div className="flex items-center gap-1">
            <span className="text-yellow-400">★</span>
            <span className="text-xs text-gray-600">
              {product.rating}
              {product.reviews && ` (${product.reviews})`}
            </span>
          </div>
        )}
      </div>

      {product.category && (
        <div className="mb-2">
          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
            {product.category}
          </span>
        </div>
      )}

      {product.description && (
        <p className="text-xs text-gray-600 line-clamp-2">
          {product.description}
        </p>
      )}

      <button
        onClick={handleToggleCart}
        className={`mt-3 w-full text-white text-xs py-2 rounded transition-colors flex items-center justify-center gap-1 ${
          inCart ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {inCart ? (
          <><CheckCircle className="w-3 h-3" /> Remove from Cart</>
        ) : (
          <><ShoppingCart className="w-3 h-3" /> Add to Cart</>
        )}
      </button>
    </div>
    );
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs lg:max-w-md ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Avatar indicator */}
        <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
              isUser ? 'bg-blue-600' : 'bg-green-600'
            }`}
          >
            {isUser ? 'You' : 'AI'}
          </div>

          <div>
            {/* Message Bubble */}
            <div
              className={`rounded-lg p-3 ${
                isUser
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
              }`}
            >
              <p className="text-sm leading-relaxed">{content}</p>

              {/* Intent Badge */}
              {!isUser && intent && (
                <div className="mt-2 text-xs opacity-70">
                  Intent: <span className="font-semibold">{intent}</span>
                </div>
              )}
            </div>

            {/* Timestamp */}
            {timestamp && (
              <div
                className={`flex items-center gap-1 mt-1 text-xs text-gray-500 ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                <Clock className="w-3 h-3" />
                {formatTime(timestamp)}
              </div>
            )}
          </div>
        </div>

        {/* Products Grid */}
        {products && products.length > 0 && !isUser && (
          <div className="mt-3 grid grid-cols-2 gap-2 ml-10">
            {products.slice(0, 4).map((product) => renderProductCard(product))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
