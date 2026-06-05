/**
 * Buy Request Detail Page
 * /buy-requests/[id] - View individual buy request details
 */

'use client';

import React, { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Tag,
  FileText,
  DollarSign,
  Star,
  Zap,
  Bell,
  Calendar,
  AlertCircle,
  Loader2,
  Edit2,
  Trash2,
} from 'lucide-react';
import useBuyRequest from '@/hooks/useBuyRequest';

type StatusColor = 'pending' | 'matched' | 'purchased' | 'cancelled';

const statusConfig: Record<StatusColor, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Pending' },
  matched: { bg: 'bg-green-100', text: 'text-green-800', label: 'Matched' },
  purchased: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Purchased' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' },
};

const BuyRequestDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const requestId = params?.id ? parseInt(params.id as string, 10) : null;

  const storedUserId = typeof window !== 'undefined' ? Number(localStorage.getItem('userId')) || 1 : 1;

  const { selectedRequest, loading, error, fetchOne, cancel } = useBuyRequest({
    userId: storedUserId,
  });

  // Fetch on mount
  useEffect(() => {
    if (requestId) {
      fetchOne(requestId);
    }
  }, [requestId, fetchOne]);

  // Handle delete
  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this buy request?'
    );
    if (confirmed && requestId) {
      try {
        await cancel(requestId);
        router.push('/buy-requests');
      } catch (err) {
        console.error('Failed to delete buy request:', err);
      }
    }
  };

  // Format helpers
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status config
  const getStatusConfig = (status: string) => {
    return statusConfig[status as StatusColor] || {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      label: status,
    };
  };

  if (loading || !selectedRequest) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">
            {error ? 'Failed to load' : 'Loading buy request...'}
          </p>
        </div>
      </div>
    );
  }

  const statusConfig_local = getStatusConfig(selectedRequest.status);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">
              {selectedRequest.productName}
            </h1>
            <p className="text-gray-600 mt-1">
              Created {formatDate(selectedRequest.createdAt)} at{' '}
              {formatTime(selectedRequest.createdAt)}
            </p>
          </div>
          <div>
            {(() => {
              const config = getStatusConfig(selectedRequest.status);
              return (
                <span
                  className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${config.bg} ${config.text}`}
                >
                  {config.label}
                </span>
              );
            })()}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {selectedRequest.description && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Description
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  {selectedRequest.description}
                </p>
              </div>
            )}

            {/* Budget & Quality */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  Budget Range
                </h3>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(selectedRequest.budgetMin)}
                </div>
                <div className="text-lg text-gray-600 mt-2">
                  to {formatCurrency(selectedRequest.budgetMax)}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  Quality Score
                </h3>
                <div className="text-2xl font-bold text-gray-900">
                  {selectedRequest.qualityScore}
                </div>
                <div className="text-sm text-gray-600 mt-2">out of 10</div>
              </div>
            </div>

            {/* Delivery Date */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Delivery Date
              </h3>
              <div className="text-lg font-semibold text-gray-900">
                {formatDate(selectedRequest.deliveryDate)}
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {new Date(selectedRequest.deliveryDate) > new Date()
                  ? `${Math.ceil(
                      (new Date(selectedRequest.deliveryDate).getTime() -
                        new Date().getTime()) /
                        (1000 * 60 * 60 * 24)
                    )} days from now`
                  : 'Delivery date has passed'}
              </div>
            </div>

            {/* Preferred Brands */}
            {selectedRequest.preferredBrands &&
              selectedRequest.preferredBrands.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-blue-600" />
                    Preferred Brands ({selectedRequest.preferredBrands.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedRequest.preferredBrands.map((brand, index) => (
                      <span
                        key={index}
                        className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-medium"
                      >
                        {brand}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {/* Matched Products */}
            {selectedRequest.matchedProducts &&
              selectedRequest.matchedProducts.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Matched Products
                  </h3>
                  <div className="space-y-3">
                    {(Array.isArray(selectedRequest.matchedProducts)
                      ? selectedRequest.matchedProducts
                      : [selectedRequest.matchedProducts]
                    ).map((product: any, index: number) => (
                      <div
                        key={index}
                        className="p-3 border border-gray-200 rounded-lg flex justify-between items-start"
                      >
                        <div>
                          <p className="font-semibold text-gray-900">
                            {product.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {product.brand}
                          </p>
                        </div>
                        <p className="font-bold text-green-600">
                          {formatCurrency(product.price)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Execution Method */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Execution Method
              </h3>
              {selectedRequest.autoExecute ? (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold text-blue-900">Auto-Buy Enabled</p>
                      <p className="text-sm text-blue-800 mt-1">
                        Products matching your criteria will be purchased automatically
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-3">
                    <Bell className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold text-green-900">Notifications</p>
                      <p className="text-sm text-green-800 mt-1">
                        You'll be notified via:{' '}
                        {selectedRequest.notifyChannels?.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Information
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Request ID</p>
                  <p className="font-mono text-gray-900">#{selectedRequest.id}</p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="capitalize text-gray-900">
                    {selectedRequest.status}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Created</p>
                  <p className="text-gray-900">
                    {formatDate(selectedRequest.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Last Updated</p>
                  <p className="text-gray-900">
                    {formatDate(selectedRequest.updatedAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Link
                href={`/edit-request/${selectedRequest.id}`}
                className="block w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-center font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit Request
              </Link>

              <button
                onClick={handleDelete}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Request
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyRequestDetailPage;
