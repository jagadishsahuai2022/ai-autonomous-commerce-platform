'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { DecisionCard } from '@/components/decision/DecisionCard';
import { AlternativesPanel } from '@/components/decision/AlternativesPanel';
import { ComparisonTable } from '@/components/comparison/ComparisonTable';
import { Timeline } from '@/components/timeline/Timeline';
import { RankedProduct } from '@/types';

// Mock data
const mockTopProduct: RankedProduct = {
  id: '1',
  name: 'Sony WH-1000XM5 Wireless Headphones',
  description: 'Industry-leading noise cancellation with premium sound quality',
  price: 399,
  originalPrice: 449,
  rating: 4.9,
  reviews: 2541,
  image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop',
  category: 'Electronics',
  brand: 'Sony',
  inStock: true,
  delivery: { daysMin: 2, daysMax: 5, free: true },
  rank: 1,
  confidence: 92,
  score: 92,
  reasoning:
    'Best overall choice based on your preference for premium quality and noise cancellation. Excellent battery life (40 hours) and proven durability.',
  pros: [
    'Industry-leading ANC technology',
    'Exceptional battery life (40 hours)',
    'Superior sound quality',
    'Comfortable for extended wear',
  ],
  cons: [
    'Premium price point',
    'Bulkier design',
    'Limited color options',
  ],
  compareMetrics: [
    { label: 'Battery Life', value: 40, unit: 'hours' },
    { label: 'ANC Quality', value: 95 },
    { label: 'Comfort', value: 90 },
  ],
};

const mockAlternatives: RankedProduct[] = [
  {
    id: '2',
    name: 'Apple AirPods Pro',
    description: 'Premium wireless earbuds with adaptive audio and spatial audio',
    price: 249,
    rating: 4.7,
    reviews: 3125,
    image: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&h=600&fit=crop',
    category: 'Electronics',
    brand: 'Apple',
    inStock: true,
    delivery: { daysMin: 1, daysMax: 3, free: true },
    rank: 2,
    confidence: 85,
    score: 88,
    reasoning: 'Great alternative if you value portability and seamless Apple integration.',
    pros: [
      'Compact and portable',
      'Seamless Apple ecosystem',
      'Very good ANC',
      'Great sound quality',
    ],
    cons: ['Limited compatibility', 'Shorter battery life', 'No lossless quality'],
    compareMetrics: [
      { label: 'Battery Life', value: 30, unit: 'hours' },
      { label: 'ANC Quality', value: 85 },
      { label: 'Comfort', value: 85 },
    ],
  },
  {
    id: '3',
    name: 'Bose QuietComfort 45',
    description: 'Premium headphones with world-class noise cancellation',
    price: 379,
    rating: 4.6,
    reviews: 1852,
    image: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&h=600&fit=crop',
    category: 'Electronics',
    brand: 'Bose',
    inStock: true,
    delivery: { daysMin: 2, daysMax: 5, free: true },
    rank: 3,
    confidence: 78,
    score: 85,
    reasoning: 'Excellent noise cancellation and comfort, slightly less advanced features.',
    pros: [
      'Legendary noise cancellation',
      'Very comfortable',
      'Great build quality',
      'Good battery life',
    ],
    cons: [
      'Older design',
      'Limited customization',
      'No lossless audio',
    ],
    compareMetrics: [
      { label: 'Battery Life', value: 24, unit: 'hours' },
      { label: 'ANC Quality', value: 92 },
      { label: 'Comfort', value: 95 },
    ],
  },
];

// Next.js 15/16: params is a Promise for page-level client components.
interface DecisionPageProps {
  params: Promise<{ id: string }>;
}

export default function DecisionPage({ params }: DecisionPageProps) {
  const [selectedProduct, setSelectedProduct] = useState(mockTopProduct);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonProducts, setComparisonProducts] = useState<RankedProduct[]>([]);

  const handleCompare = (products: RankedProduct[]) => {
    setComparisonProducts(products);
    setShowComparison(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-indigo-50 to-purple-50">
      {/* Header */}
      <motion.div
        className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm px-6 py-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="max-w-6xl mx-auto flex items-center space-x-4">
          <Link
            href="/copilot"
            className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Back</span>
          </Link>
          <div className="border-l border-gray-200 pl-4">
            <h1 className="text-lg font-bold text-gray-900">Decision Details</h1>
            <p className="text-xs text-gray-500">Complete analysis and comparison</p>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Timeline currentStep={5} />
        </motion.div>

        {/* Top Recommendation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <DecisionCard
            product={selectedProduct}
            onSelect={(product) => {
              setSelectedProduct(product);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </motion.div>

        {/* Alternatives */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <AlternativesPanel
            alternatives={mockAlternatives}
            topPick={mockTopProduct}
            onSelect={(product) => setSelectedProduct(product)}
            onCompare={handleCompare}
          />
        </motion.div>

        {/* Comparison Table */}
        {showComparison && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              <ComparisonTable
                products={comparisonProducts}
                onClose={() => setShowComparison(false)}
              />
            </motion.div>
          </motion.div>
        )}

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-12 text-center text-white"
        >
          <h2 className="text-3xl font-bold mb-4">Ready to Purchase?</h2>
          <p className="text-lg mb-8 text-white/90">
            Click below to proceed with your order. It will go through our approval process for your safety.
          </p>
          <motion.button
            onClick={() => window.location.href = '/order/1'}
            className="px-8 py-4 rounded-xl bg-white text-indigo-600 font-bold hover:shadow-xl transition"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Proceed to Order
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
