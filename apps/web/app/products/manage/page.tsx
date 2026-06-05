'use client';

import { Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Upload } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProducts } from '@/hooks/useProducts';
import { toast } from '@/hooks/useToast';

function ProductListTable() {
  const { data: productsData, isLoading, refetch } = useProducts({});
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const products = productsData?.data || [];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Product</th>
              <th className="px-6 py-3 text-left font-semibold">Category</th>
              <th className="px-6 py-3 text-left font-semibold">Price</th>
              <th className="px-6 py-3 text-left font-semibold">Stock</th>
              <th className="px-6 py-3 text-left font-semibold">Status</th>
              <th className="px-6 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products?.slice(0, 10).map((product: any) => (
              <tr key={product.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td className="px-6 py-3 font-medium">{product.name}</td>
                <td className="px-6 py-3">{product.category}</td>
                <td className="px-6 py-3">₹{product.price?.toLocaleString('en-IN') || '0'}</td>
                <td className="px-6 py-3">{product.stock || '-'}</td>
                <td className="px-6 py-3">
                  <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100 rounded text-xs font-semibold">
                    Active
                  </span>
                </td>
                <td className="px-6 py-3 flex gap-2">
                  <button
                    onClick={() => setEditingId(product.id)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-xs"
                  >
                    <Edit size={16} />
                  </button>
                  <button className="text-red-600 hover:text-red-700 font-medium text-xs">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ProductManagement() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Product Management</h1>
            <p className="text-slate-600 dark:text-gray-400">Manage your product listings</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            Add Product
          </button>
        </motion.div>

        {/* New Product Form (collapsed by default) */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 mb-8"
          >
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Create New Product</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input type="text" placeholder="Product Name" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
              <input type="number" placeholder="Price" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
              <input type="text" placeholder="Category" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
              <input type="number" placeholder="Stock" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            </div>
            <button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
              Create Product
            </button>
          </motion.div>
        )}

        {/* Products Table */}
        <Suspense fallback={<div className="animate-pulse h-96 bg-slate-200 rounded" />}>
          <ProductListTable />
        </Suspense>
      </div>
    </div>
  );
}
