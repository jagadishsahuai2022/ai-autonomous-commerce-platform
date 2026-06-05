'use client';

import React from 'react';
import { Star, Heart, ShoppingCart, Zap, CreditCard, TrendingUp, TrendingDown, Minus, Shield, Clock, Eye } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Product } from '@/types';
import { formatPrice } from '@/lib/formatting';

function computeDeliveryETA(product: Product): string {
  if (product.deliveryETA) return product.deliveryETA;
  const min = product.delivery?.daysMin ?? 1;
  if (min === 0) return 'Today';
  if (min === 1) return 'Tomorrow';
  if (min <= 3) return `${min}–${product.delivery?.daysMax ?? min + 1} days`;
  return `${min}–${product.delivery?.daysMax ?? min + 2} days`;
}

function TrustBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-600 bg-green-50' : score >= 60 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';
  return (
    <div className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${color}`}>
      <Shield size={9} />
      {score}%
    </div>
  );
}

function PriceTrendBadge({ trend, pct }: { trend: 'up' | 'down' | 'stable'; pct?: number }) {
  if (trend === 'down') return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-600">
      <TrendingDown size={10} />{pct ? `${pct}%` : ''}
    </span>
  );
  if (trend === 'up') return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-500">
      <TrendingUp size={10} />{pct ? `+${pct}%` : ''}
    </span>
  );
  return <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400"><Minus size={10} /></span>;
}

export interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
  onBuyNow?: (product: Product) => void;
  onWishlist?: (product: Product) => void;
  isFavorited?: boolean;
  /** Fallback image URL when product.image is missing */
  fallbackImage?: string;
}

export function ProductCard({
  product,
  onAddToCart,
  onBuyNow,
  onWishlist,
  isFavorited = false,
  fallbackImage,
}: ProductCardProps) {
  const [showActions, setShowActions] = React.useState(false);
  const [cartFeedback, setCartFeedback] = React.useState(false);
  const isWishlisted = isFavorited;

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onWishlist?.(product);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAddToCart?.(product);
    setCartFeedback(true);
    setTimeout(() => setCartFeedback(false), 1200);
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onBuyNow?.(product);
  };

  return (
    <Link href={`/products/${product.id}`}>
      <motion.div
        data-testid="product-card"
        className="group border border-gray-200 rounded-lg overflow-hidden bg-white h-full flex flex-col cursor-pointer relative"
        whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.10)' }}
        transition={{ duration: 0.15 }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >

        {/* Image Container - Fixed Height */}
        <div className="relative bg-gray-50 overflow-hidden h-40">
          {(() => {
            const imgSrc = product.image || fallbackImage;
            if (imgSrc) {
              return imgSrc.startsWith('http') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgSrc}
                  alt={product.name}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.dataset.fallbackTried) {
                      img.dataset.fallbackTried = '1';
                      const seed = Math.abs(String(product.id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 1000;
                      img.src = `https://picsum.photos/seed/${seed}/600/400`;
                    }
                  }}
                />
              ) : (
                <Image
                  src={imgSrc}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                />
              );
            }
            return (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 text-xs text-gray-400">
                No Image
              </div>
            );
          })()}

          {/* Discount Badge */}
          {discount > 0 && (
            <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">
              {discount}% OFF
            </div>
          )}

          {/* AI+ Badge */}
          <div className="absolute top-2 right-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 shadow-sm">
            <Zap size={10} /> AI+
          </div>

          {/* Hover Action Icons */}
          <AnimatePresence>
            {showActions && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full px-2 py-1.5 shadow-lg border border-gray-200"
              >
                <motion.button
                  onClick={handleAddToCart}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${cartFeedback ? 'bg-green-500 text-white' : 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'}`}
                  title="Add to Cart"
                >
                  <ShoppingCart size={14} />
                </motion.button>
                <motion.button
                  onClick={handleWishlist}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-full bg-white hover:bg-red-50 border border-gray-200 flex items-center justify-center transition-colors"
                  title="Save to Wishlist"
                >
                  <Heart size={14} className={isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-500'} />
                </motion.button>
                <motion.button
                  onClick={handleBuyNow}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white flex items-center justify-center shadow-sm"
                  title="Buy Now"
                >
                  <CreditCard size={13} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content Section */}
        <div className="p-3 flex flex-col flex-1">

          {/* Product Title - 2 line clamp */}
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
            {product.name}
          </h3>

          {/* Rating */}
          <div className="flex items-center gap-1 mb-1">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  className={
                    i < Math.floor(product.rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }
                />
              ))}
            </div>
            <span className="text-xs text-gray-500">
              {product.rating.toFixed(1)} ({product.reviewCount || 0})
            </span>
          </div>

          {/* Price Section */}
          <div className="mb-1">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-gray-900">
                  {formatPrice(product.price)}
                </span>
                {product.originalPrice && (
                  <span className="text-xs text-gray-400 line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
              </div>
              {product.priceTrend && product.priceTrend !== 'stable' && (
                <PriceTrendBadge trend={product.priceTrend} pct={product.priceTrendPct} />
              )}
            </div>
          </div>

          {/* Delivery ETA + Trust Score row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1 text-xs text-green-700 font-medium">
              <Clock size={10} />
              {computeDeliveryETA(product)}
            </div>
            {product.trustScore !== undefined && (
              <TrustBadge score={product.trustScore} />
            )}
          </div>

          {/* India-specific tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            {product.codAvailable && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                COD
              </span>
            )}
            {product.hasEMI && (
              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                EMI
              </span>
            )}
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            className={`mt-auto w-full font-semibold py-2 rounded text-sm transition-all flex items-center justify-center gap-1 ${cartFeedback
              ? 'bg-green-500 text-white'
              : 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
              }`}
          >
            <ShoppingCart size={14} />
            {cartFeedback ? 'Added!' : 'Add to Cart'}
          </button>
        </div>
      </motion.div>
    </Link>
  );
}

// Backward-compat alias
export { ProductCard as ExternalProductCard };
export default ProductCard;
