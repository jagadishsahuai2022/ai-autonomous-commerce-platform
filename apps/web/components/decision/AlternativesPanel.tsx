'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CheckCircle, XCircle, Scale } from 'lucide-react';
import Image from 'next/image';
import { RankedProduct } from '@/types';
import { Badge, Card } from '@/components/ui/base';

interface AlternativesPanelProps {
  alternatives: RankedProduct[];
  topPick: RankedProduct;
  onSelect?: (product: RankedProduct) => void;
  onCompare?: (products: RankedProduct[]) => void;
}

export function AlternativesPanel({
  alternatives,
  topPick,
  onSelect,
  onCompare,
}: AlternativesPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(
    new Set()
  );

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const updated = new Set(prev);
      updated.has(id) ? updated.delete(id) : updated.add(id);
      return updated;
    });
  };

  const toggleCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      const updated = new Set(prev);
      updated.has(id) ? updated.delete(id) : updated.add(id);
      return updated;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-4"
    >
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Also Recommended
        </h2>
        <p className="text-sm text-gray-600">
          {alternatives.length} other great options for you
        </p>
      </div>

      {/* Alternatives List */}
      <div className="space-y-3">
        {alternatives.map((product, idx) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="p-4">
              <div className="flex items-start space-x-4">
                {/* Product Image */}
                <div className="relative w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                      No image
                    </div>
                  )}
                  {/* Rank Badge */}
                  <div className="absolute top-1 right-1 bg-gray-900/80 text-white px-2 py-0.5 rounded text-xs font-bold">
                    #{product.rank}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {product.name}
                      </h3>
                      <p className="text-sm text-gray-600">{product.brand}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-gray-900">
                        ₹{product.price?.toLocaleString('en-IN')}
                      </p>
                      <Badge variant="default">
                        {product.confidence}% match
                      </Badge>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex items-center space-x-4 text-sm mb-3">
                    <span className="text-gray-600">
                      ⭐ {product.rating} ({product.reviews} reviews)
                    </span>
                    <span className="text-gray-600">
                      🚚 {product.delivery.daysMin}-{product.delivery.daysMax}d
                    </span>
                  </div>

                  {/* Expandable Details */}
                  <motion.button
                    onClick={() => toggleExpanded(product.id)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-indigo-600">
                        {expandedIds.has(product.id)
                          ? 'Hide details'
                          : 'Show pros & cons'}
                      </span>
                    </div>
                    <motion.div
                      animate={{ rotate: expandedIds.has(product.id) ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    </motion.div>
                  </motion.button>
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {expandedIds.has(product.id) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-gray-200 mt-4 pt-4 space-y-4"
                  >
                    {/* Pros */}
                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">
                        ✅ Pros
                      </p>
                      <ul className="space-y-1">
                        {product.pros.slice(0, 3).map((pro, i) => (
                          <li
                            key={i}
                            className="flex items-start space-x-2 text-sm text-gray-700"
                          >
                            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Cons */}
                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-2">
                        ⚠️ Cons
                      </p>
                      <ul className="space-y-1">
                        {product.cons.slice(0, 3).map((con, i) => (
                          <li
                            key={i}
                            className="flex items-start space-x-2 text-sm text-gray-700"
                          >
                            <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
                      <motion.button
                        onClick={() => {
                          onSelect?.(product);
                        }}
                        className="flex-1 px-3 py-2 text-sm rounded-lg bg-indigo-100 text-indigo-700 font-medium hover:bg-indigo-200 transition"
                        whileHover={{ scale: 1.02 }}
                      >
                        Choose This
                      </motion.button>
                      <motion.button
                        onClick={() => toggleCompare(product.id)}
                        className={`px-3 py-2 text-sm rounded-lg font-medium transition ${
                          selectedForCompare.has(product.id)
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        whileHover={{ scale: 1.02 }}
                      >
                        <Scale className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Compare Float Bar */}
      {selectedForCompare.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-0 right-0 flex justify-center"
        >
          <motion.button
            onClick={() => {
              const productsToCompare = alternatives.filter((p) =>
                selectedForCompare.has(p.id)
              );
              onCompare?.([topPick, ...productsToCompare]);
            }}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-lg hover:shadow-xl transition"
            whileHover={{ scale: 1.05 }}
          >
            <Scale className="w-4 h-4 inline mr-2" />
            Compare {selectedForCompare.size} Products
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
