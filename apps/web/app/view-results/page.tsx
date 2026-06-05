'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ShoppingCart, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';

interface MatchedProduct {
  name: string;
  brand: string;
  price: number;
  rating: number;
  matchScore: number;
  estimatedDelivery: string;
  emiAvailable: boolean;
  url: string;
}

interface SearchResult {
  productName: string;
  budget: number | null;
  matches: MatchedProduct[];
}

function ViewResultsContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('No token provided'); setLoading(false); return; }

    fetch(`/api/magic-link?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Invalid or expired link');
        return res.json();
      })
      .then((data) => {
        setQuery(data.query || 'Shopping List');
        setResults(Array.isArray(data.results) ? data.results : []);
        setSummary(data.summary || {});
        setCreatedAt(data.createdAt || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading your search results…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link Not Found</h2>
          <p className="text-gray-600 mb-6">{error}. This link may have expired or is invalid.</p>
          <Link href="/shopping-list" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors">
            Create New Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">AI Search Results</h1>
              <p className="text-slate-500 text-sm">Shared via DelegateCart · No sign-in required</p>
            </div>
          </div>
          {query && <p className="text-slate-700 mt-2"><span className="font-medium">Query:</span> {query}</p>}
          {createdAt && (
            <p className="text-xs text-slate-400 mt-1">
              Searched on {new Date(createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {summary.totalMatches && (
            <div className="mt-3 flex gap-4 flex-wrap text-sm">
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                {String(summary.totalItems || '')} item{Number(summary.totalItems) !== 1 ? 's' : ''} searched
              </span>
              <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
                {String(summary.totalMatches)} matches found
              </span>
              {summary.estimatedSavings && (
                <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-medium">
                  Est. savings: {String(summary.estimatedSavings)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="space-y-6">
          {results.map((result, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white">
                <h2 className="text-lg font-bold">{result.productName}</h2>
                {result.budget && (
                  <p className="text-blue-100 text-sm">Budget: ₹{Number(result.budget).toLocaleString('en-IN')}</p>
                )}
              </div>

              <div className="p-4 space-y-3">
                {result.matches.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No matches found</p>
                ) : (
                  result.matches.map((product, j) => (
                    <div key={j} className="flex items-center gap-4 p-3 border border-slate-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.brand} · Delivery: {product.estimatedDelivery}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                            ★ {product.rating}
                          </span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                            {product.matchScore}% match
                          </span>
                          {product.emiAvailable && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">EMI</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-blue-700 text-lg">
                          ₹{Number(product.price).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm mb-3">Want to search for more products?</p>
          <Link href="/shopping-list" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
            <ShoppingCart className="w-4 h-4" />
            Create New Shopping List
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ViewResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <ViewResultsContent />
    </Suspense>
  );
}
