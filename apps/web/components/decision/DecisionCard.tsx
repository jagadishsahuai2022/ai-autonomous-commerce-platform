'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  TrendingUp,
  Star,
  Truck,
  Check,
  AlertCircle,
} from 'lucide-react';
import Image from 'next/image';
import { RankedProduct } from '@/types';
import { Badge, Card } from '@/components/ui/base';

interface DecisionCardProps {
  product: RankedProduct;
  onSelect?: (product: RankedProduct) => void;
}

export function DecisionCard({ product, onSelect }: DecisionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const confidenceColor =
    product.confidence >= 80
      ? 'text-emerald-600'
      : product.confidence >= 60
        ? 'text-amber-600'
        : 'text-rose-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Card className="overflow-hidden">
        {/* Top Border Gradient */}
        <div className="h-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600" />

        {/* Product Image & Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
          {/* Image */}
          <div className="relative h-80 bg-gray-100 rounded-xl overflow-hidden">
            {product.image ? (
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No image
              </div>
            )}

            {/* Badge */}
            <div className="absolute top-4 right-4">
              <Badge variant="success">✨ AI Top Pick</Badge>
            </div>
          </div>

          {/* Details */}
          <div className="md:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{product.brand}</p>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {product.name}
                  </h3>
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {product.description}
              </p>

              {/* Specs Row */}
              <div className="grid grid-cols-3 gap-4 mb-6 py-4 border-y border-gray-200">
                <div>
                  <p className="text-xs text-gray-600">Rating</p>
                  <div className="flex items-center space-x-1 mt-1">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold">{product.rating.toFixed(1)}</span>
                    <span className="text-xs text-gray-500">
                      ({product.reviews})
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-600">Delivery</p>
                  <div className="flex items-center space-x-1 mt-1">
                    <Truck className="w-4 h-4 text-indigo-600" />
                    <span className="font-semibold text-sm">
                      {product.delivery.daysMin}-{product.delivery.daysMax}d
                    </span>
                    {product.delivery.free && (
                      <Badge variant="success">Free</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-600">In Stock</p>
                  <div className="flex items-center space-x-1 mt-1">
                    <Check
                      className={`w-4 h-4 ${
                        product.inStock
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    />
                    <span className="font-semibold text-sm">
                      {product.inStock ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Price & CTA */}
            <div className="space-y-4">
              <div className="flex items-end space-x-3">
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    ₹{product.price.toLocaleString('en-IN')}
                  </p>
                  {product.originalPrice && (
                    <p className="text-sm text-gray-500 line-through">
                      ₹{product.originalPrice.toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
                {product.originalPrice && (
                  <Badge variant="warning">
                    {Math.round(
                      ((product.originalPrice - product.price) /
                        product.originalPrice) *
                        100
                    )}
                    % off
                  </Badge>
                )}
              </div>

              <motion.button
                onClick={() => onSelect?.(product)}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:shadow-lg transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                View & Compare
              </motion.button>
            </div>
          </div>
        </div>

        {/* Why AI Chose This */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-t border-gray-200">
          <motion.button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <span className="font-semibold text-gray-900">
                Why AI chose this
              </span>
            </div>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-5 h-5 text-gray-600" />
            </motion.div>
          </motion.button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 space-y-4"
              >
                {/* Confidence Score Visualization */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">
                      Confidence Score
                    </p>
                    <span className={`text-lg font-bold ${confidenceColor}`}>
                      {product.confidence}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <motion.div
                      className="h-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${product.confidence}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                {/* Score Breakdown */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Score Breakdown
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: 'Price', value: 92 },
                      { label: 'Quality', value: 88 },
                      { label: 'Delivery', value: 95 },
                      { label: 'Brand', value: 85 },
                      { label: 'Reviews', value: 91 },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{item.label}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 bg-gray-200 rounded-full h-1.5">
                            <motion.div
                              className="h-1.5 rounded-full bg-indigo-600"
                              initial={{ width: 0 }}
                              animate={{ width: `${item.value}%` }}
                              transition={{
                                duration: 0.6,
                                delay: i * 0.1,
                              }}
                            />
                          </div>
                          <span className="font-semibold w-6 text-right">
                            {item.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reasoning */}
                <div className="pt-4 border-t border-indigo-200">
                  <p className="text-sm text-gray-700 bg-white/50 rounded-lg p-3">
                    <span className="font-medium">Reasoning: </span>
                    {product.reasoning}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  );
}
