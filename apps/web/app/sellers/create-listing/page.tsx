/**
 * Create Listing with AI Generation
 * Auto-generate product descriptions and optimize listings
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface GeneratedListing {
  title: string;
  description: string;
  bulletPoints: string[];
  suggestedPrice: number;
  basePrice: number;
  listingScore: number;
  recommendations: {
    titleTip: string;
    descriptionTip: string;
    priceTip: string;
    keywordsTip: string;
  };
  generatedMetadata: {
    keywords: string[];
    tone: string;
  };
}

export default function CreateListingPage() {
  const [step, setStep] = useState<'input' | 'review' | 'publish'>('input');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<GeneratedListing | null>(null);

  const [form, setForm] = useState({
    title: '',
    basePrice: '',
    category: 'electronics',
    description: '',
    costPrice: '',
    quantity: '',
    images: [] as string[],
    keywords: '',
  });

  const handleGenerateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate API call to generate listing
    setTimeout(() => {
      const mockGenerated: GeneratedListing = {
        title: `${form.title} - Premium Quality ${form.category}`,
        description: `High-quality ${form.category.toLowerCase()} perfect for everyday use and professional applications. Features modern design and reliable performance. Backed by manufacturer warranty. Check our store for more items. Fast shipping and secure packaging guaranteed.`,
        bulletPoints: [
          '✓ Premium quality product',
          '✓ Fast and secure shipping',
          '✓ Latest technology and features',
          '✓ Warranty coverage included',
          '✓ Expert technical support',
        ],
        suggestedPrice: parseInt(form.basePrice) * 1.35,
        basePrice: parseInt(form.basePrice),
        listingScore: 87,
        recommendations: {
          titleTip: 'Title is well-optimized for search visibility',
          descriptionTip: 'Description is comprehensive and well-written',
          priceTip: 'Suggested price 54050 could increase conversions by optimizing for market demand',
          keywordsTip: 'Include keywords: premium, quality, warranty for better visibility',
        },
        generatedMetadata: {
          keywords: ['premium', 'quality', 'warranty', 'fast shipping', 'original'],
          tone: 'professional',
        },
      };

      setGenerated(mockGenerated);
      setStep('review');
      setLoading(false);
    }, 1000);
  };

  const handlePublish = async () => {
    setLoading(true);
    // Simulate API call to publish
    setTimeout(() => {
      alert('Listing published successfully!');
      setStep('publish');
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="border-b border-indigo-200 bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link href="/sellers/dashboard" className="text-indigo-600 hover:text-indigo-700 mb-3 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create New Listing</h1>
          <p className="text-gray-600 mt-1">AI-powered listing generation for optimal visibility and conversions</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex gap-4 mb-12">
          {['input', 'review', 'publish'].map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 transition ${
                    step === s
                      ? 'bg-indigo-600 text-white'
                      : ['input', 'review', 'publish'].indexOf(step) > i
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {['input', 'review', 'publish'].indexOf(step) > i ? '✓' : i + 1}
                </div>
                <p className="text-sm font-medium text-gray-700">
                  {s === 'input' ? 'Details' : s === 'review' ? 'Review' : 'Publish'}
                </p>
              </div>
              {i < 2 && <div className="flex-1 border-t-2 border-gray-200 mt-5" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Input Details */}
        {step === 'input' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">📝 Product Details</h2>

            <form onSubmit={handleGenerateListing} className="space-y-6">
              {/* Product Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Product Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Samsung 55 inch 4K TV"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Be specific and descriptive for better search visibility
                </p>
              </div>

              {/* Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Category *
                  </label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="electronics">Electronics</option>
                    <option value="fashion">Fashion</option>
                    <option value="books">Books</option>
                    <option value="home">Home & Garden</option>
                    <option value="sports">Sports</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="0"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="0"
                    value={form.basePrice}
                    onChange={e => setForm({ ...form, basePrice: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Optional - helps AI suggest better prices"
                    value={form.costPrice}
                    onChange={e => setForm({ ...form, costPrice: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">For margin calculation</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Basic Description
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe your product or any key features. AI will enhance this into a professional description."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g., 4K, smart TV, Samsung, 55 inch"
                  value={form.keywords}
                  onChange={e => setForm({ ...form, keywords: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Submit */}
              <div className="pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading || !form.title || !form.basePrice}
                  className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Generating with AI... ✨' : 'Generate Listing with AI ✨'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Review Generated Listing */}
        {step === 'review' && generated && (
          <div className="space-y-6">
            {/* Listing Score */}
            <div className="bg-white rounded-lg border border-indigo-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Generated Listing Quality</h3>
                <div className="text-center">
                  <p className="text-4xl font-bold text-indigo-600">{generated.listingScore}</p>
                  <p className="text-sm text-gray-600">/100</p>
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all"
                  style={{ width: `${generated.listingScore}%` }}
                />
              </div>

              <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>AI Insight:</strong> Your listing has excellent potential for visibility and conversions.
                </p>
              </div>
            </div>

            {/* Title & Description */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Product Title</h3>
              <p className="text-gray-800 text-lg font-semibold mb-6">{generated.title}</p>

              <h3 className="text-lg font-bold text-gray-900 mb-4">Product Description</h3>
              <p className="text-gray-700 whitespace-pre-wrap mb-6">{generated.description}</p>

              <h3 className="text-lg font-bold text-gray-900 mb-4">Key Features</h3>
              <ul className="space-y-2">
                {generated.bulletPoints.map((point, i) => (
                  <li key={i} className="text-gray-700 flex gap-3">
                    <span className="flex-shrink-0">{point.split(' ')[0]}</span>
                    <span>{point.substring(2)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pricing & Keywords */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">💵 Pricing</h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-700">Your Set Price</span>
                    <span className="font-semibold text-gray-900">₹{generated.basePrice}</span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-gray-700">AI Suggested</span>
                    <span className="font-semibold text-green-600">₹{Math.round(generated.suggestedPrice)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-3">
                    <span className="text-gray-700">Potential Increase</span>
                    <span className="font-semibold text-green-600">
                      +{Math.round(((generated.suggestedPrice - generated.basePrice) / generated.basePrice) * 100)}%
                    </span>
                  </div>
                </div>

                <p className="mt-4 text-sm text-gray-600">{generated.recommendations.priceTip}</p>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">🏷️ Keywords & SEO</h3>

                <div className="flex flex-wrap gap-2 mb-4">
                  {generated.generatedMetadata.keywords.map((keyword, i) => (
                    <span key={i} className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-full">
                      {keyword}
                    </span>
                  ))}
                </div>

                <p className="text-sm text-gray-600">{generated.recommendations.keywordsTip}</p>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-amber-50 rounded-lg border border-amber-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">💡 AI Recommendations</h3>

              <div className="space-y-2">
                <div className="flex gap-3 items-start">
                  <span className="text-xl">📝</span>
                  <p className="text-gray-700">{generated.recommendations.titleTip}</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-xl">📄</span>
                  <p className="text-gray-700">{generated.recommendations.descriptionTip}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={() => {
                  setStep('input');
                  setGenerated(null);
                }}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
              >
                ← Edit
              </button>
              <button
                onClick={handlePublish}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {loading ? 'Publishing...' : 'Publish Listing ✓'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'publish' && (
          <div className="bg-white rounded-lg border border-green-200 shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Listing Published!</h2>
            <p className="text-gray-600 mb-8">
              Your product is now live and ready for customers to discover
            </p>

            <div className="bg-green-50 rounded-lg p-6 mb-8 inline-block">
              <p className="text-sm text-gray-600 mb-1">Listing Quality Score</p>
              <p className="text-3xl font-bold text-green-600">{generated?.listingScore}</p>
            </div>

            <div className="flex gap-4 justify-center">
              <Link
                href="/sellers/dashboard"
                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
              >
                Go to Dashboard
              </Link>
              <button
                onClick={() => {
                  setStep('input');
                  setGenerated(null);
                  setForm({
                    title: '',
                    basePrice: '',
                    category: 'electronics',
                    description: '',
                    costPrice: '',
                    quantity: '',
                    images: [],
                    keywords: '',
                  });
                }}
                className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
              >
                Create Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
