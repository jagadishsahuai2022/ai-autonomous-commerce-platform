/**
 * Create/Edit Buy Request Form Page
 * /create-request - Create new buy request
 * /edit-request/[id] - Edit existing buy request
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Plus,
  X,
  DollarSign,
  Calendar,
  Star,
  Tag,
  FileText,
  Save,
  Loader2,
} from 'lucide-react';
import useBuyRequest from '@/hooks/useBuyRequest';

const CreateBuyRequestPage = () => {
  const router = useRouter();
  const params = useParams();
  const requestId = params?.id ? parseInt(params.id as string, 10) : null;

  const { create, update, fetchOne, selectedRequest, loading, error } =
    useBuyRequest({ userId: 1 }); // Replace with actual userId from auth

  // Form state
  const [formData, setFormData] = useState({
    productName: '',
    description: '',
    budgetMin: '',
    budgetMax: '',
    qualityScore: 7,
    preferredBrands: [] as string[],
    deliveryDate: '',
    autoExecute: false,
    notifyChannels: [] as string[],
  });

  const [brandInput, setBrandInput] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing request for edit
  useEffect(() => {
    if (requestId) {
      fetchOne(requestId);
    }
  }, [requestId, fetchOne]);

  // Populate form with loaded data
  useEffect(() => {
    if (selectedRequest && requestId) {
      setFormData({
        productName: selectedRequest.productName,
        description: selectedRequest.description || '',
        budgetMin: selectedRequest.budgetMin.toString(),
        budgetMax: selectedRequest.budgetMax.toString(),
        qualityScore: selectedRequest.qualityScore,
        preferredBrands: selectedRequest.preferredBrands || [],
        deliveryDate: selectedRequest.deliveryDate.split('T')[0], // Extract YYYY-MM-DD
        autoExecute: selectedRequest.autoExecute,
        notifyChannels: selectedRequest.notifyChannels || [],
      });
    }
  }, [selectedRequest, requestId]);

  // Validation logic
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.productName.trim()) {
      errors.productName = 'Product name is required';
    } else if (formData.productName.length < 3) {
      errors.productName = 'Product name must be at least 3 characters';
    }

    const budgetMin = parseFloat(formData.budgetMin);
    const budgetMax = parseFloat(formData.budgetMax);

    if (!formData.budgetMin || isNaN(budgetMin) || budgetMin < 0) {
      errors.budgetMin = 'Valid minimum budget is required';
    }

    if (!formData.budgetMax || isNaN(budgetMax) || budgetMax < 0) {
      errors.budgetMax = 'Valid maximum budget is required';
    }

    if (budgetMin > budgetMax) {
      errors.budgetMax = 'Maximum budget must be greater than minimum';
    }

    if (!formData.deliveryDate) {
      errors.deliveryDate = 'Delivery date is required';
    }

    if (!formData.autoExecute && formData.notifyChannels.length === 0) {
      errors.execution =
        'Either enable auto-buy or select at least one notification channel';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage('');

    try {
      const submitData = {
        ...formData,
        budgetMin: parseFloat(formData.budgetMin),
        budgetMax: parseFloat(formData.budgetMax),
        preferredBrands:
          formData.preferredBrands.length > 0
            ? formData.preferredBrands
            : undefined,
        notifyChannels:
          formData.notifyChannels.length > 0
            ? formData.notifyChannels
            : undefined,
      };

      let success = false;
      if (requestId) {
        success = await update(requestId, submitData);
      } else {
        success = await create(submitData);
      }

      if (success) {
        setSuccessMessage(
          requestId
            ? 'Buy request updated successfully!'
            : 'Buy request created successfully!'
        );

        setTimeout(() => {
          router.push('/buy-requests'); // Redirect to dashboard
        }, 1500);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add brand to list
  const handleAddBrand = () => {
    if (brandInput.trim() && formData.preferredBrands.length < 10) {
      setFormData((prev) => ({
        ...prev,
        preferredBrands: [...prev.preferredBrands, brandInput.trim()],
      }));
      setBrandInput('');
    }
  };

  // Remove brand from list
  const handleRemoveBrand = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      preferredBrands: prev.preferredBrands.filter((_, i) => i !== index),
    }));
  };

  // Toggle notification channel
  const handleToggleChannel = (channel: string) => {
    setFormData((prev) => ({
      ...prev,
      notifyChannels: prev.notifyChannels.includes(channel)
        ? prev.notifyChannels.filter((c) => c !== channel)
        : [...prev.notifyChannels, channel],
    }));
  };

  // Get tomorrow's date as minimum delivery date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {requestId ? 'Edit Buy Request' : 'Create Buy Request'}
          </h1>
          <p className="text-gray-600">
            {requestId
              ? 'Update your smart buy request'
              : 'Create a smart buy request and let us find the best products for you'}
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
          {/* Product Name */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Tag className="w-4 h-4 inline mr-2" />
              Product Name *
            </label>
            <input
              type="text"
              value={formData.productName}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  productName: e.target.value,
                }));
                if (validationErrors.productName)
                  setValidationErrors((prev) => ({
                    ...prev,
                    productName: '',
                  }));
              }}
              placeholder="e.g., Wireless Headphones"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                validationErrors.productName
                  ? 'border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:ring-blue-200'
              }`}
            />
            {validationErrors.productName && (
              <p className="text-red-600 text-sm mt-1">
                {validationErrors.productName}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Add any specific requirements or details..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Budget Range */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-2" />
                Min Budget *
              </label>
              <input
                type="number"
                value={formData.budgetMin}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    budgetMin: e.target.value,
                  }));
                  if (validationErrors.budgetMin)
                    setValidationErrors((prev) => ({
                      ...prev,
                      budgetMin: '',
                    }));
                }}
                placeholder="0"
                min="0"
                step="0.01"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  validationErrors.budgetMin
                    ? 'border-red-500 focus:ring-red-200'
                    : 'border-gray-300 focus:ring-blue-200'
                }`}
              />
              {validationErrors.budgetMin && (
                <p className="text-red-600 text-sm mt-1">
                  {validationErrors.budgetMin}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Max Budget *
              </label>
              <input
                type="number"
                value={formData.budgetMax}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    budgetMax: e.target.value,
                  }));
                  if (validationErrors.budgetMax)
                    setValidationErrors((prev) => ({
                      ...prev,
                      budgetMax: '',
                    }));
                }}
                placeholder="1000"
                min="0"
                step="0.01"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  validationErrors.budgetMax
                    ? 'border-red-500 focus:ring-red-200'
                    : 'border-gray-300 focus:ring-blue-200'
                }`}
              />
              {validationErrors.budgetMax && (
                <p className="text-red-600 text-sm mt-1">
                  {validationErrors.budgetMax}
                </p>
              )}
            </div>
          </div>

          {/* Quality Score Slider */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Star className="w-4 h-4 inline mr-2" />
              Minimum Quality Score: {formData.qualityScore}/10
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.qualityScore}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  qualityScore: parseInt(e.target.value, 10),
                }))
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>Poor (1)</span>
              <span>Excellent (10)</span>
            </div>
          </div>

          {/* Preferred Brands */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Preferred Brands
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={brandInput}
                onChange={(e) => setBrandInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddBrand();
                  }
                }}
                placeholder="Enter brand name"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button
                type="button"
                onClick={handleAddBrand}
                disabled={
                  !brandInput.trim() || formData.preferredBrands.length >= 10
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {/* Brand Tags */}
            <div className="flex flex-wrap gap-2">
              {formData.preferredBrands.map((brand, index) => (
                <div
                  key={index}
                  className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full flex items-center gap-2 text-sm"
                >
                  {brand}
                  <button
                    type="button"
                    onClick={() => handleRemoveBrand(index)}
                    className="hover:text-blue-900"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Date */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Delivery Date *
            </label>
            <input
              type="date"
              value={formData.deliveryDate}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  deliveryDate: e.target.value,
                }));
                if (validationErrors.deliveryDate)
                  setValidationErrors((prev) => ({
                    ...prev,
                    deliveryDate: '',
                  }));
              }}
              min={minDate}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                validationErrors.deliveryDate
                  ? 'border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:ring-blue-200'
              }`}
            />
            {validationErrors.deliveryDate && (
              <p className="text-red-600 text-sm mt-1">
                {validationErrors.deliveryDate}
              </p>
            )}
          </div>

          {/* Execution Settings */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-4">
              How should we notify you?
            </h3>

            {/* Auto-Execute Toggle */}
            <div className="mb-4 flex items-center gap-3">
              <input
                type="checkbox"
                id="autoExecute"
                checked={formData.autoExecute}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    autoExecute: e.target.checked,
                  }))
                }
                className="w-4 h-4 text-blue-600 cursor-pointer"
              />
              <label htmlFor="autoExecute" className="cursor-pointer flex-1">
                <span className="font-medium text-gray-900">Auto-Buy</span>
                <p className="text-sm text-gray-600">
                  Automatically purchase matching products within budget
                </p>
              </label>
            </div>

            {/* Notification Channels */}
            <div>
              <p className="font-medium text-gray-900 mb-3">
                OR notify me via:
              </p>
              <div className="space-y-2">
                {['email', 'whatsapp', 'sms', 'push'].map((channel) => (
                  <label
                    key={channel}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.notifyChannels.includes(channel)}
                      onChange={() => handleToggleChannel(channel)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-800 capitalize">{channel}</span>
                  </label>
                ))}
              </div>
            </div>

            {validationErrors.execution && (
              <p className="text-red-600 text-sm mt-3">
                {validationErrors.execution}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-4 justify-between">
            <button
              type="button"
              onClick={() => router.push('/buy-requests')}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {requestId ? 'Update' : 'Create'} Buy Request
                </>
              )}
            </button>
          </div>
        </form>

        {/* Loading State */}
        {loading && !formData.productName && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading buy request...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateBuyRequestPage;
