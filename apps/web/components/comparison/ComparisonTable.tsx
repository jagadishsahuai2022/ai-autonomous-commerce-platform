'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, X, TrendingUp } from 'lucide-react';

interface ComparisonTableProps {
  products?: any[];
  highlightedIndex?: number;
  onClose?: () => void;
}

export function ComparisonTable({
  products = [],
  highlightedIndex = 0,
  onClose,
}: ComparisonTableProps) {
  const criteriaRows = [
    { label: 'Price', key: 'price' },
    { label: 'Rating', key: 'rating' },
    { label: 'Delivery Time', key: 'delivery_days' },
    { label: 'In Stock', key: 'inStock' },
    { label: 'AI Confidence', key: 'confidence' },
    { label: 'Score', key: 'score' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-4"
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900">Product Comparison</h1>
          <p className="text-sm text-slate-600 mt-1">Compare features and specifications</p>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* Header */}
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-4 text-left font-semibold text-slate-900 w-40">
                    Criteria
                  </th>
                  {products.map((product, idx) => (
                    <th
                      key={product.id}
                      className={`px-6 py-4 text-center font-semibold transition-all ${idx === highlightedIndex
                          ? 'bg-indigo-50 text-indigo-900 border-l-4 border-indigo-600'
                          : 'text-slate-900'
                        }`}
                    >
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        <div className="font-bold text-sm line-clamp-2 h-14 flex items-center justify-center">
                          {product.name}
                        </div>
                        {idx === 0 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.3, type: 'spring' }}
                            className="inline-block mt-2 px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-full"
                          >
                            Top Pick
                          </motion.div>
                        )}
                      </motion.div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Rows */}
              <tbody>
                {criteriaRows.map((row, rowIdx) => (
                  <motion.tr
                    key={row.key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: rowIdx * 0.05 }}
                    className="border-b border-slate-200 hover:bg-slate-50 transition"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-900 bg-slate-50">
                      {row.label}
                    </td>
                    {products.map((product, colIdx) => {
                      let value = product[row.key];
                      let displayValue = '';
                      let icon = null;

                      if (row.key === 'price') {
                        displayValue = `₹${value.toLocaleString()}`;
                      } else if (row.key === 'rating') {
                        displayValue = `${value.toFixed(1)}/5 ⭐`;
                      } else if (row.key === 'delivery_days') {
                        displayValue = `${value} days`;
                      } else if (row.key === 'inStock') {
                        icon = value ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <X className="w-5 h-5 text-red-600" />
                        );
                        displayValue = value ? 'Yes' : 'No';
                      } else if (row.key === 'confidence') {
                        displayValue = `${(value * 100).toFixed(0)}%`;
                      } else if (row.key === 'score') {
                        displayValue = `${(value * 100).toFixed(0)}%`;
                      }

                      const isHighlighted = colIdx === highlightedIndex;
                      const isBest =
                        (row.key === 'price' && value === Math.min(...products.map((p) => p.price))) ||
                        (row.key === 'rating' && value === Math.max(...products.map((p) => p.rating))) ||
                        (row.key === 'delivery_days' && value === Math.min(...products.map((p) => p.delivery_days)));

                      return (
                        <td
                          key={`${product.id}-${row.key}`}
                          className={`px-6 py-4 text-center font-medium transition-all ${isHighlighted
                              ? 'bg-indigo-50 text-indigo-900 border-l-4 border-indigo-600'
                              : 'text-slate-900'
                            }`}
                        >
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: colIdx * 0.1 + rowIdx * 0.05 }}
                            className="flex items-center justify-center gap-2"
                          >
                            {icon && icon}
                            <span className={isBest ? 'font-bold text-green-600' : ''}>
                              {displayValue}
                            </span>
                            {isBest && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold"
                              >
                                BEST
                              </motion.div>
                            )}
                          </motion.div>
                        </td>
                      );
                    })}
                  </motion.tr>
                ))}

                {/* Pros Row */}
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: criteriaRows.length * 0.05 }}
                  className="border-b border-slate-200 hover:bg-slate-50 transition"
                >
                  <td className="px-6 py-4 font-semibold text-slate-900 bg-slate-50">
                    Pros
                  </td>
                  {products.map((product, colIdx) => (
                    <td
                      key={`${product.id}-pros`}
                      className={`px-6 py-4 transition-all ${colIdx === highlightedIndex
                          ? 'bg-indigo-50 border-l-4 border-indigo-600'
                          : ''
                        }`}
                    >
                      <ul className="space-y-1 text-sm text-slate-700">
                        {product.pros?.slice(0, 2).map((pro, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-green-600 font-bold mt-0.5">✓</span>
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </motion.tr>

                {/* Cons Row */}
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: (criteriaRows.length + 1) * 0.05 }}
                  className="hover:bg-slate-50 transition"
                >
                  <td className="px-6 py-4 font-semibold text-slate-900 bg-slate-50">
                    Cons
                  </td>
                  {products.map((product, colIdx) => (
                    <td
                      key={`${product.id}-cons`}
                      className={`px-6 py-4 transition-all ${colIdx === highlightedIndex
                          ? 'bg-indigo-50 border-l-4 border-indigo-600'
                          : ''
                        }`}
                    >
                      <ul className="space-y-1 text-sm text-slate-700">
                        {product.cons?.slice(0, 2).map((con, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-amber-600 font-bold mt-0.5">!</span>
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </motion.tr>
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-12">
          {products.map((product, idx) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + idx * 0.1 }}
              className={`rounded-2xl p-6 border-2 transition-all cursor-pointer hover:shadow-lg ${idx === highlightedIndex
                  ? 'bg-indigo-50 border-indigo-600 shadow-lg'
                  : 'bg-white border-slate-200'
                }`}
              whileHover={{ y: -4 }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900">{product.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">{product.brand}</p>
                </div>
                {idx === 0 && (
                  <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-full">
                    Top Pick
                  </span>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <div>
                  <p className="text-xs text-slate-600 font-medium">PRICE</p>
                  <p className="text-2xl font-bold text-slate-900">
                    ₹{product.price.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 font-medium">CONFIDENCE</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-slate-200 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${product.confidence * 100}%`,
                        }}
                        transition={{ delay: 0.6 + idx * 0.1, duration: 1 }}
                        className="bg-gradient-to-r from-indigo-600 to-blue-600 h-full rounded-full"
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-900">
                      {(product.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full py-2 px-4 rounded-lg font-semibold transition-all ${idx === highlightedIndex
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  }`}
              >
                {idx === 0 ? 'Select This' : 'Select Alternative'}
              </motion.button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ComparisonTable;
