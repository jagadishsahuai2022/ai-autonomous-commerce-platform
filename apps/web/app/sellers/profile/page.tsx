/**
 * Seller Profile/Settings Page
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function SellerProfilePage() {
  const [profile, setProfile] = useState({
    storeName: 'TechHub Store',
    storeDescription: 'Premium electronics and gadgets at best prices',
    category: 'electronics',
    autoGenListings: true,
    usePricingSuggestions: true,
    useDemandPrediction: true,
    vendorTier: 'premium',
  });

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    // API call
    setTimeout(() => {
      setSaved(true);
      setLoading(false);
      setTimeout(() => setSaved(false), 3000);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="border-b border-indigo-200 bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link href="/sellers/dashboard" className="text-indigo-600 hover:text-indigo-700 mb-3 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Store Settings</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Store Info */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Store Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Store Name</label>
                <input
                  type="text"
                  value={profile.storeName}
                  onChange={e => setProfile({ ...profile, storeName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Store Description</label>
                <textarea
                  rows={4}
                  value={profile.storeDescription}
                  onChange={e => setProfile({ ...profile, storeDescription: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Primary Category</label>
                  <select
                    value={profile.category}
                    onChange={e => setProfile({ ...profile, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option>Electronics</option>
                    <option>Fashion</option>
                    <option>Home</option>
                    <option>Books</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Vendor Tier</label>
                  <select
                    value={profile.vendorTier}
                    onChange={e => setProfile({ ...profile, vendorTier: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* AI Features */}
          <div className="bg-white rounded-lg border border-indigo-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">🤖 AI Features</h2>

            <div className="space-y-4">
              {[
                {
                  key: 'autoGenListings',
                  label: 'Auto-Generate Listings',
                  desc: 'AI automatically generates professional product descriptions',
                },
                {
                  key: 'usePricingSuggestions',
                  label: 'Price Optimization',
                  desc: 'Get AI recommendations for optimal pricing',
                },
                {
                  key: 'useDemandPrediction',
                  label: 'Demand Forecasting',
                  desc: 'Predict demand trends and optimize inventory',
                },
              ].map(feature => (
                <label key={feature.key} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(profile as any)[feature.key]}
                    onChange={e =>
                      setProfile({ ...profile, [(feature.key as any)]: e.target.checked })
                    }
                    className="mt-1 w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">{feature.label}</p>
                    <p className="text-sm text-gray-600">{feature.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Account Status */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Account Status</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Verification Status</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">✅ Verified</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Member Since</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">Jan 2024</p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href="/sellers/dashboard"
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition text-center"
            >
              Cancel
            </Link>
          </div>

          {saved && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-center font-semibold">
              ✅ Settings saved successfully!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
