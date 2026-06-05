'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Heart, ArrowRight, Zap, Truck, Lock } from 'lucide-react';
import Image from 'next/image';
import { Product } from '@/types';
import { Card } from '@/components/ui/base';
import { getProductImage } from '@/lib/product-images';
import { useWishlistStore } from '@/lib/store/wishlist.store';

interface ProductCardProps {
  product: Product;
  onSelect?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  showHeart?: boolean;
  compact?: boolean;
}

// Refined animation variants for premium feel
const containerVariants = {
  rest: { y: 0 },
  hover: {
    y: -8,
    transition: { type: 'spring' as const, stiffness: 300, damping: 20 },
  },
};

const imageVariants = {
  rest: { scale: 1 },
  hover: {
    scale: 1.08,
    transition: { type: 'spring' as const, stiffness: 500, damping: 25 },
  },
};

const badgeVariants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { delay: 0.1, duration: 0.2 },
  },
};

export function ProductCard({
  product,
  onSelect,
  onAddToCart,
  showHeart = true,
  compact = false,
}: ProductCardProps) {
  const [isHovering, setIsHovering] = React.useState(false);
  const { isProductWishlisted, addItem, removeItem, fetchWishlists, loaded } = useWishlistStore();

  useEffect(() => {
    if (!loaded) fetchWishlists();
  }, [loaded, fetchWishlists]);

  const isWishlisted = isProductWishlisted(String(product.id));

  const handleHeartClick = async () => {
    if (isWishlisted) {
      await removeItem(String(product.id));
    } else {
      await addItem({
        id: String(product.id),
        name: product.name,
        price: product.price,
        imageUrl: product.image || getProductImage(product.name, (product as any).brand, product.id),
      });
    }
    window.dispatchEvent(new Event('wishlistUpdated'));
  };

  const ratingPercentage = (product.rating / 5) * 100;
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;
  const productImage = product.image || getProductImage(product.name, (product as any).brand, product.id);

  return (
    <motion.div
      variants={containerVariants}
      initial="rest"
      whileHover="hover"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="h-full"
    >
      <Card className={`h-full flex flex-col overflow-hidden backdrop-blur-sm border border-white/10 hover:border-primary-500/30 transition-colors duration-300 ${compact ? 'shadow-sm' : 'shadow-elevated hover:shadow-ai-glow'
        }`}>
        {/* Premium Image Container with Overlay Gradient */}
        <div className="relative overflow-hidden flex-shrink-0" style={{ height: compact ? '160px' : '200px' }}>
          {/* Image with Spring Animation */}
          <motion.div
            variants={imageVariants}
            initial="rest"
            whileHover="hover"
            className="w-full h-full"
          >
            {productImage ? (
              <Image
                src={productImage}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800">
                <span className="text-gray-400 text-sm">No image available</span>
              </div>
            )}
          </motion.div>

          {/* Premium Overlay Gradient on Hover */}
          {isHovering && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none"
            />
          )}

          {/* Discount Badge - Premium Style */}
          {discount > 0 && (
            <motion.div
              variants={badgeVariants}
              initial="hidden"
              animate="visible"
              className="absolute top-3 right-3 flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-bold shadow-lg backdrop-blur-md"
            >
              <Zap size={14} />
              {discount}% off
            </motion.div>
          )}

          {/* Wishlist Button - Premium Style */}
          {showHeart && (
            <motion.button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleHeartClick(); }}
              className="absolute top-3 left-3 p-2.5 rounded-full bg-white/80 hover:bg-white backdrop-blur-md transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart
                size={18}
                className={`transition-all duration-300 ${isWishlisted
                    ? 'fill-red-500 text-red-500'
                    : 'text-gray-400 hover:text-red-500'
                  }`}
              />
            </motion.button>
          )}

          {/* In Stock Badge */}
          {product.inStock && (
            <motion.div
              variants={badgeVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.05 }}
              className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/90 text-white text-xs font-medium backdrop-blur-md"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
              In Stock
            </motion.div>
          )}
        </div>

        {/* Content Section */}
        <div className={`flex-1 flex flex-col justify-between gap-3 ${compact ? 'p-3' : 'p-4'}`}>
          {/* Header - Category & Title */}
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-0.5">
              {product.category}
            </p>
            <h3 className={`font-semibold text-gray-900 dark:text-white line-clamp-2 ${compact ? 'text-sm' : 'text-base'
              }`}>
              {product.name}
            </h3>
          </div>

          {/* Rating Section */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Star
                      size={14}
                      className={`${i < Math.floor(product.rating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-gray-300 dark:text-gray-600'
                        }`}
                    />
                  </motion.div>
                ))}
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                {product.rating.toFixed(1)}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({product.reviews.toLocaleString()})
            </span>
          </div>

          {/* Price Section with Visual Hierarchy */}
          <div className="py-2 border-t border-gray-200 dark:border-gray-700/50">
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              {product.originalPrice && (
                <span className="text-sm text-gray-500 line-through font-medium">
                  ₹{product.originalPrice.toLocaleString('en-IN')}
                </span>
              )}
            </div>

            {/* Delivery Info with Icon */}
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <Truck size={14} className="flex-shrink-0" />
              <span>
                {product.delivery.daysMin}-{product.delivery.daysMax} days
                {product.delivery.free && ' • Free'}
              </span>
            </div>
          </div>

          {/* CTA Button - Premium Style */}
          <motion.button
            onClick={() => onSelect?.(product)}
            disabled={!product.inStock}
            className={`w-full py-2.5 px-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${product.inStock
                ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:shadow-lg hover:shadow-primary-500/40'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
              }`}
            whileHover={product.inStock ? { scale: 1.02 } : undefined}
            whileTap={product.inStock ? { scale: 0.98 } : undefined}
            aria-label={`View ${product.name} details`}
          >
            <span className={compact ? 'text-sm' : 'text-base'}>
              {product.inStock ? 'View Details' : 'Out of Stock'}
            </span>
            {product.inStock && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
          </motion.button>
        </div>
      </Card>
    </motion.div>
  );
}
