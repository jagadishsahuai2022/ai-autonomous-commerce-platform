/**
 * Buy Requests Dashboard
 * /buy-requests - List all user's buy requests
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  ChevronRight,
  Calendar,
  DollarSign,
  Star,
  Loader2,
  AlertCircle,
  Trash2,
  Edit2,
  Eye,
} from 'lucide-react';
import useBuyRequest from '@/hooks/useBuyRequest';

type StatusColor = 'pending' | 'matched' | 'purchased' | 'cancelled';

const statusConfig: Record<StatusColor, { bg: string; text: string; label: string }> = {
  pending: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'Pending',
  },
  matched: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Matched',
  },
  purchased: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    label: 'Purchased',
  },
  cancelled: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    label: 'Cancelled',
  },
};

const BuyRequestsDashboardPage = () => {
  const storedUserId = typeof window !== 'undefined' ? Number(localStorage.getItem('userId')) || 1 : 1;
  const { buyRequests, loading, error, fetchAll, cancel, setCurrentPage } =
    useBuyRequest({ autoFetch: true, userId: storedUserId });

  const [filterStatus, setFilterStatus] = useState<string>(''); // Empty = all
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Re-fetch when filter changes
  useEffect(() => {
    fetchAll({ status: filterStatus || undefined });
  }, [filterStatus, fetchAll]);

  // Handle delete with confirmation
  const handleDelete = async (id: number) => {
    if (showDeleteConfirm && deletingId === id) {
      await cancel(id);
      setShowDeleteConfirm(false);
      setDeletingId(null);
    } else {
      setShowDeleteConfirm(true);
      setDeletingId(id);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get status config or return generic
  const getStatusConfig = (status: string) => {
    return statusConfig[status as StatusColor] || {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      label: status,
    };
  };

  const [setDeleteConfirm] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Buy Requests</h1>
            <p className="text-gray-600 mt-2">
              Manage your smart buy requests and auto-purchase settings
            </p>
          </div>
          <Link
            href="/create-request"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Request
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {['', 'pending', 'matched', 'purchased', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setFilterStatus(status);
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status ? (
                <span className="capitalize">
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              ) : (
                'All Requests'
              )}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && buyRequests.length === 0 && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading buy requests...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && buyRequests.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No buy requests found
            </h3>
            <p className="text-gray-600 mb-4">
              {filterStatus
                ? 'No requests match the selected filter'
                : 'Create your first smart buy request to get started'}
            </p>
            {!filterStatus && (
              <Link
                href="/create-request"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Buy Request
              </Link>
            )}
          </div>
        )}

        {/* Buy Requests Grid */}
        {buyRequests.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {buyRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-4 border-b border-gray-200 flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                      {request.productName}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {request.description ? (
                        <span className="line-clamp-2">{request.description}</span>
                      ) : (
                        <span className="text-gray-400">No description</span>
                      )}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="ml-2">
                    {(() => {
                      const config = getStatusConfig(request.status);
                      return (
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}
                        >
                          {config.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Budget */}
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-gray-700">
                      Budget:{' '}
                      <span className="font-semibold">
                        {formatCurrency(request.budgetMin)} -{' '}
                        {formatCurrency(request.budgetMax)}
                      </span>
                    </span>
                  </div>

                  {/* Quality */}
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="text-gray-700">
                      Quality: <span className="font-semibold">{request.qualityScore}/10</span>
                    </span>
                  </div>

                  {/* Delivery Date */}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-gray-700">
                      By: <span className="font-semibold">{formatDate(request.deliveryDate)}</span>
                    </span>
                  </div>

                  {/* Execution Method */}
                  <div className="text-sm bg-blue-50 p-2 rounded">
                    {request.autoExecute ? (
                      <span className="text-blue-800">
                        ⚡ <strong>Auto-Buy enabled</strong> - Will purchase automatically
                      </span>
                    ) : (
                      <span className="text-blue-800">
                        🔔 <strong>Notification enabled</strong> - Will notify via{' '}
                        {request.notifyChannels?.join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Brands */}
                  {request.preferredBrands && request.preferredBrands.length > 0 && (
                    <div className="text-sm">
                      <p className="text-gray-600 font-medium mb-1">Preferred Brands:</p>
                      <div className="flex flex-wrap gap-1">
                        {request.preferredBrands.slice(0, 3).map((brand, idx) => (
                          <span
                            key={idx}
                            className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs"
                          >
                            {brand}
                          </span>
                        ))}
                        {request.preferredBrands.length > 3 && (
                          <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">
                            +{request.preferredBrands.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer - Actions */}
                <div className="p-4 border-t border-gray-200 flex gap-2">
                  <Link
                    href={`/buy-requests/${request.id}`}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 rounded transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </Link>

                  <Link
                    href={`/edit-request/${request.id}`}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 text-gray-600 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </Link>

                  <button
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setDeletingId(request.id);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>

                {/* Delete Confirmation */}
                {showDeleteConfirm && deletingId === request.id && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg z-10">
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-gray-800 font-medium mb-4">
                        Are you sure you want to delete this buy request?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(request.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyRequestsDashboardPage;
