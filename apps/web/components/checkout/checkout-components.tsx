'use client';

import React, { useState } from 'react';
import { X, MapPin, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Address } from '@/hooks/useAddresses';

// Address Selection Component
interface AddressSelectionProps {
  addresses: Address[];
  selectedId?: string;
  onSelect: (addressId: string) => void;
  onAddNew?: () => void;
  isLoading?: boolean;
}

export function AddressSelection({
  addresses,
  selectedId,
  onSelect,
  onAddNew,
  isLoading = false,
}: AddressSelectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Select Delivery Address</h3>
        {onAddNew && (
          <button
            onClick={onAddNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Add New Address
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin w-6 h-6 text-blue-600" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
          <MapPin className="mx-auto mb-2 text-gray-400" size={24} />
          <p className="text-gray-600">No addresses found</p>
          {onAddNew && (
            <button onClick={onAddNew} className="mt-4 text-blue-600 hover:underline">
              Add your first address
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {addresses.map((address) => (
            <div
              key={address.id}
              onClick={() => onSelect(address.id)}
              className={`p-4 border rounded-lg cursor-pointer transition ${selectedId === address.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{address.label}</h4>
                    {address.isDefault && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {address.firstName} {address.lastName}
                  </p>
                  <p className="text-sm text-gray-600">
                    {address.addressLine1}
                    {address.addressLine2 && <>, {address.addressLine2}</>}
                  </p>
                  <p className="text-sm text-gray-600">
                    {address.city}, {address.state} {address.postalCode}
                  </p>
                  <p className="text-sm text-gray-600">{address.phone}</p>
                </div>
                {selectedId === address.id && (
                  <CheckCircle className="text-blue-600" size={24} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Shipping Method Selection
interface ShippingMethodSelectionProps {
  selected?: string;
  onSelect: (method: string, cost: number) => void;
}

export function ShippingMethodSelection({ selected, onSelect }: ShippingMethodSelectionProps) {
  const methods = [
    {
      id: 'standard',
      label: 'Standard',
      description: 'Delivery in 3-5 business days',
      cost: 0,
    },
    {
      id: 'express',
      label: 'Express',
      description: 'Delivery in 1-2 business days',
      cost: 100,
    },
    {
      id: 'premium',
      label: 'Premium',
      description: 'Same day delivery',
      cost: 200,
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Shipping Method</h3>
      <div className="grid grid-cols-1 gap-3">
        {methods.map((method) => (
          <div
            key={method.id}
            onClick={() => onSelect(method.id, method.cost)}
            className={`p-4 border rounded-lg cursor-pointer transition ${selected === method.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
              }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold">{method.label}</h4>
                <p className="text-sm text-gray-600">{method.description}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {method.cost === 0 ? 'Free' : `₹${method.cost}`}
                </p>
                {selected === method.id && (
                  <CheckCircle className="text-blue-600 inline-block mt-1" size={20} />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Order Summary
interface OrderSummaryProps {
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount?: number;
  total: number;
  itemCount?: number;
}

export function OrderSummary({
  subtotal,
  tax,
  shippingCost,
  discount = 0,
  total,
  itemCount = 0,
}: OrderSummaryProps) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
      <h3 className="font-semibold text-lg">Order Summary</h3>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal ({itemCount} items)</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Tax (GST 18%)</span>
          <span>₹{tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Shipping</span>
          <span>{shippingCost === 0 ? 'Free' : `₹${shippingCost.toFixed(2)}`}</span>
        </div>

        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span>
            <span>-₹{discount.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="border-t pt-4">
        <div className="flex justify-between items-center font-semibold text-lg">
          <span>Total</span>
          <span className="text-blue-600">₹{total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// Payment Method Selection
interface PaymentMethodSelectionProps {
  selected?: string;
  onSelect: (method: string) => void;
  isLoading?: boolean;
}

export function PaymentMethodSelection({
  selected,
  onSelect,
  isLoading = false,
}: PaymentMethodSelectionProps) {
  const methods = [
    { id: 'razorpay', label: 'Razorpay', description: 'Credit/Debit/UPI' },
    { id: 'wallet', label: 'Wallet', description: 'Use wallet balance' },
    { id: 'upi', label: 'UPI', description: 'Google Pay, PhonePe, etc' },
    { id: 'netbanking', label: 'Net Banking', description: 'All major banks' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Payment Method</h3>
      <div className="grid grid-cols-2 gap-3">
        {methods.map((method) => (
          <button
            key={method.id}
            onClick={() => onSelect(method.id)}
            disabled={isLoading}
            className={`p-4 border rounded-lg transition text-left ${selected === method.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <h4 className="font-semibold text-sm">{method.label}</h4>
            <p className="text-xs text-gray-600">{method.description}</p>
            {selected === method.id && (
              <CheckCircle className="text-blue-600 inline-block mt-2" size={16} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// Cart Item Display
interface CartItemDisplayProps {
  productName: string;
  quantity: number;
  price: number;
  imageUrl?: string;
}

export function CartItemDisplay({
  productName,
  quantity,
  price,
  imageUrl,
}: CartItemDisplayProps) {
  return (
    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={productName}
          className="w-16 h-16 object-cover rounded"
        />
      )}
      <div className="flex-grow">
        <p className="font-medium">{productName}</p>
        <p className="text-sm text-gray-600">Qty: {quantity}</p>
      </div>
      <p className="font-semibold">₹{(price * quantity).toFixed(2)}</p>
    </div>
  );
}

// Step Indicator
interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center flex-1">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${index < currentStep
                ? 'bg-green-600 text-white'
                : index === currentStep
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
          >
            {index < currentStep ? <CheckCircle size={20} /> : index + 1}
          </div>
          <p className={`ml-3 ${index <= currentStep ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
            {step}
          </p>
          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-1 mx-3 ${index < currentStep ? 'bg-green-600' : 'bg-gray-200'
                }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
