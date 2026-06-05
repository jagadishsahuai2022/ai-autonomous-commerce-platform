'use client';

import { motion } from 'framer-motion';
import { Product } from '@/lib/types/commerce';
import { Star, Truck, BadgeCheck, Check } from 'lucide-react';
import Image from 'next/image';
import { getProductImage } from '@/lib/product-images';

interface ProductCardProps {
  product: Product;
  isSelected?: boolean;
  onClick?: () => void;
  showBadge?: boolean;
  isLoading?: boolean;
}

export function ProductCard({
  product,
  isSelected = false,
  onClick,
  showBadge = true,
  isLoading = false,
}: ProductCardProps) {
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const containerVariants = {
    rest: {
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    },
    hover: {
      y: -8,
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    },
  };

  const imageVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.08 },
  };

  const badgeVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: { scale: 1, rotate: 0 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="rest"
      whileHover={!isLoading ? 'hover' : 'rest'}
      whileTap={!isLoading ? { scale: 0.98 } : { scale: 1 }}
      onClick={!isLoading ? onClick : undefined}
      className={`relative group rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
        isSelected
          ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-2xl'
          : 'bg-white shadow-base hover:shadow-xl'
      } ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
      style={{
        backgroundColor: '#ffffff',
      }}
    >
      {/* Glassmorphic Overlay on Hover */}
      <motion.div
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 0.02 }}
        className="absolute inset-0 bg-gradient-to-br from-white via-transparent to-slate-50 pointer-events-none z-10"
      />

      {/* Image Container with Gradient Background */}
      <div className="relative h-48 bg-gradient-to-br from-indigo-50 via-blue-50 to-slate-100 overflow-hidden">
        <Image
          src={product.image || getProductImage(product.name, (product as any).brand, String(product.id))}
          alt={product.name}
          fill
          className="object-cover"
          priority
        />

        {/* Image Overlay Gradient */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-slate-900/5 via-transparent to-transparent"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
        />

        {/* Enhanced Discount Badge */}
        {showBadge && discount > 0 && (
          <motion.div
            variants={badgeVariants}
            initial="hidden"
            animate="visible"
            className="absolute top-3 right-3 bg-gradient-to-br from-red-500 to-rose-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm"
          >
            <span className="text-sm font-extrabold">-{discount}%</span>
          </motion.div>
        )}

        {/* Enhanced Stock Badge */}
        {product.inStock && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-3 left-3 flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-lg backdrop-blur-sm"
          >
            <BadgeCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span>In Stock</span>
          </motion.div>
        )}

        {/* Selection Checkmark */}
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute bottom-3 right-3 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg"
          >
            <Check className="w-5 h-5 text-white" strokeWidth={3} />
          </motion.div>
        )}
      </div>

      {/* Content Container */}
      <div className="p-4 space-y-3 relative z-20">
        {/* Brand & Source */}
        <div className="flex items-center justify-between gap-2">
          <motion.span
            className="text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600 uppercase tracking-widest"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {product.brand}
          </motion.span>
          <span className="text-xs text-slate-400 capitalize bg-slate-100 px-2 py-1 rounded-md font-medium">
            {product.source}
          </span>
        </div>

        {/* Product Name */}
        <motion.h3
          className="text-sm font-bold text-slate-900 line-clamp-2 leading-tight"
          whileHover={{ color: '#4f46e5' }}
          transition={{ duration: 0.2 }}
        >
          {product.name}
        </motion.h3>

        {/* Features with Enhanced Styling */}
        <div className="pt-1">
          <ul className="space-y-1.5">
            {product.key_features.slice(0, 2).map((feature, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="text-xs text-slate-600 flex items-start gap-2"
              >
                <span className="w-1 h-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                <span className="leading-tight">{feature}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        {/* Rating Section */}
        <motion.div
          className="flex items-center gap-2 pt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.15 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <Star
                  className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                  strokeWidth={2}
                />
              </motion.div>
            ))}
          </div>
          <span className="text-xs text-slate-500 font-medium">
            ({product.reviewCount.toLocaleString()})
          </span>
        </motion.div>

        {/* Delivery Info */}
        <motion.div
          className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg w-fit"
          whileHover={{ backgroundColor: '#d1fae5' }}
        >
          <Truck className="w-4 h-4 text-emerald-600" strokeWidth={2} />
          <span>
            {product.delivery_days === 1 ? '🚀 Tomorrow' : `📦 ${product.delivery_days}d`}
          </span>
        </motion.div>

        {/* Price Section with Gradient */}
        <div className="pt-2 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900">
              ₹{product.price.toLocaleString()}
            </span>
            {product.originalPrice && (
              <motion.span
                className="text-xs text-slate-400 line-through font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                ₹{product.originalPrice.toLocaleString()}
              </motion.span>
            )}
          </div>
          {product.originalPrice && (
            <div className="text-xs font-semibold text-emerald-600">
              Save ₹{(product.originalPrice - product.price).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Gradient Accent Line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-transparent opacity-0 group-hover:opacity-100"
        transition={{ duration: 0.3 }}
      />

      {/* Selection Border */}
      {isSelected && (
        <motion.div
          layoutId={`selectedBorder-${product.id}`}
          className="absolute inset-0 rounded-2xl border-2 border-indigo-500 pointer-events-none"
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.div>
  );
}
