'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Star, ShoppingCart, Heart, Truck, Shield, Tag, Package,
    Loader2, AlertCircle, ChevronRight, Zap, Award, CheckCircle2,
    Globe, Store, ExternalLink,
} from 'lucide-react';
import { fetchWithRetry } from '@/lib/safe-api';
import { getProductImage } from '@/lib/product-images';
import type { RankedProduct } from '@/types/shopping-assistant';

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

interface ProductDetailModalProps {
    /** Product ID to fetch details for */
    productId: string | null;
    /** Optional RankedProduct to show AI analysis */
    rankedProduct?: RankedProduct | null;
    /** Close callback */
    onClose: () => void;
    /** Optional: add-to-cart callback */
    onAddToCart?: (product: any) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
    productId,
    rankedProduct,
    onClose,
    onAddToCart,
}) => {
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [cartAdded, setCartAdded] = useState(false);
    const [selectedImage, setSelectedImage] = useState(0);

    const fetchProduct = useCallback(async () => {
        if (!productId) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetchWithRetry(`/api/products/${productId}`);
            if (!res.ok) {
                if (res.status === 404) {
                    // Use rankedProduct data as fallback
                    if (rankedProduct) {
                        setProduct(buildFallbackProduct(rankedProduct));
                        setLoading(false);
                        return;
                    }
                    throw new Error('Product not found');
                }
                throw new Error(`Failed to load (${res.status})`);
            }
            const data = await res.json();
            setProduct(data);
        } catch (err: any) {
            // Use rankedProduct data as fallback if API fails
            if (rankedProduct) {
                setProduct(buildFallbackProduct(rankedProduct));
            } else {
                setError(err.message || 'Failed to load product');
            }
        } finally {
            setLoading(false);
        }
    }, [productId, rankedProduct]);

    useEffect(() => {
        if (productId) fetchProduct();
    }, [fetchProduct, productId]);

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!productId) return null;

    const handleAddToCart = () => {
        if (!product) return;
        try {
            const raw = localStorage.getItem('cart');
            const cart: any[] = raw ? JSON.parse(raw) : [];
            const existing = cart.find((i: any) => String(i.productId) === String(product.id));
            if (existing) {
                existing.quantity = (existing.quantity || 1) + 1;
            } else {
                cart.push({
                    id: `cart-${product.id}-${Date.now()}`,
                    productId: product.id,
                    name: product.name,
                    price: product.price,
                    quantity: 1,
                    image: product.thumbnailUrl || product.image || (product.images?.[0]),
                    brand: product.brand,
                    source: product.source || 'DelegateCart',
                    aiRecommended: !!rankedProduct,
                });
            }
            localStorage.setItem('cart', JSON.stringify(cart));
            window.dispatchEvent(new Event('cartUpdated'));
            setCartAdded(true);
            setTimeout(() => setCartAdded(false), 2500);
            onAddToCart?.(product);
        } catch { /* ignore */ }
    };

    const images: string[] = product
        ? (product.images || []).filter((img: string) => img && !img.startsWith('📷') && !img.startsWith('🎧'))
        : [];
    if (product && !images.length && product.image) images.push(product.image);
    if (product && !images.length && product.thumbnailUrl) images.push(product.thumbnailUrl);
    if (product && !images.length) {
        images.push(getProductImage(product.name || '', product.brand || '', product.id));
    }

    const displayPrice = product?.price || rankedProduct?.product.price || 0;
    const originalPrice = product?.originalPrice || product?.original_price || rankedProduct?.product.original_price;
    const discount = originalPrice && originalPrice > displayPrice ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100) : null;
    const rating = product ? (typeof product.rating === 'number' ? product.rating : 4.0) : (rankedProduct?.product.rating || 4.0);
    const reviewCount = product?.reviewCount || product?.review_count || rankedProduct?.product.review_count || 0;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
                onClick={onClose}
                data-testid="product-detail-modal-overlay"
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                    data-testid="product-detail-modal"
                >
                    {/* Loading state */}
                    {loading && (
                        <div className="flex-1 flex items-center justify-center min-h-[300px]">
                            <div className="text-center">
                                <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-3" />
                                <p className="text-sm text-gray-500">Loading product details...</p>
                            </div>
                        </div>
                    )}

                    {/* Error state */}
                    {!loading && error && (
                        <div className="flex-1 flex items-center justify-center min-h-[300px] p-6">
                            <div className="text-center">
                                <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                                <p className="text-sm text-red-600 font-medium">{error}</p>
                                <button
                                    onClick={fetchProduct}
                                    className="mt-4 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition"
                                >
                                    Retry
                                </button>
                            </div>
                            <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-xl">
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                    )}

                    {/* Product detail content */}
                    {!loading && !error && product && (
                        <>
                            {/* Sticky header */}
                            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs text-violet-600 dark:text-violet-400 font-semibold">Product Details</span>
                                        {rankedProduct && (
                                            <span className="text-xs bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full font-bold">
                                                #{rankedProduct.rank} Pick
                                            </span>
                                        )}
                                        {(product.isExternal || rankedProduct?.product?.source === 'Amazon') ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-full">
                                                <Globe className="w-2.5 h-2.5" />External
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full">
                                                <Store className="w-2.5 h-2.5" />DelegateCart
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight">
                                        {product.name}
                                    </h2>
                                    {product.brand && (
                                        <p className="text-xs text-gray-500 mt-0.5">{product.brand}</p>
                                    )}
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-white/60 dark:hover:bg-gray-700 rounded-xl transition-colors flex-shrink-0 ml-2"
                                    data-testid="product-detail-modal-close"
                                >
                                    <X className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>

                            {/* Scrollable body */}
                            <div className="flex-1 overflow-auto p-4 space-y-4">
                                {/* Image gallery */}
                                {images.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="w-full bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center" style={{ height: 220 }}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={images[selectedImage] || images[0]}
                                                alt={product.name}
                                                className="max-w-full max-h-full object-contain p-2"
                                                loading="lazy"
                                            />
                                        </div>
                                        {images.length > 1 && (
                                            <div className="flex gap-2 overflow-x-auto pb-1">
                                                {images.slice(0, 5).map((img, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => setSelectedImage(i)}
                                                        className={`w-14 h-14 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${selectedImage === i ? 'border-violet-500 ring-2 ring-violet-200' : 'border-gray-200 hover:border-gray-300'
                                                            }`}
                                                    >
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={img} alt="" className="w-full h-full object-contain" loading="lazy" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Price & Rating */}
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div>
                                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                            {formatCurrency(displayPrice)}
                                        </span>
                                        {originalPrice && originalPrice > displayPrice && (
                                            <span className="text-sm text-gray-400 line-through ml-2">{formatCurrency(originalPrice)}</span>
                                        )}
                                        {discount && (
                                            <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
                                                -{discount}%
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex items-center gap-0.5 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-lg">
                                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{rating.toFixed(1)}</span>
                                        </div>
                                        {reviewCount > 0 && (
                                            <span className="text-xs text-gray-400">({reviewCount.toLocaleString()} reviews)</span>
                                        )}
                                    </div>
                                </div>

                                {/* Quick info badges */}
                                <div className="flex flex-wrap gap-2">
                                    {product.deliveryDays || product.delivery_time ? (
                                        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-full">
                                            <Truck className="w-3.5 h-3.5 text-blue-500" />
                                            {product.delivery_time || `${product.deliveryDays} days`}
                                        </div>
                                    ) : null}
                                    <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-full">
                                        <Shield className="w-3.5 h-3.5 text-green-500" />
                                        Secure Purchase
                                    </div>
                                    {product.stock > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-full">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            In Stock
                                        </div>
                                    )}
                                </div>

                                {/* Description */}
                                {product.description && (
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">About this product</p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-4">{product.description}</p>
                                    </div>
                                )}

                                {/* AI Analysis (shown when rankedProduct is provided) */}
                                {rankedProduct && (
                                    <div className="space-y-3">
                                        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-3">
                                            <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-1 flex items-center gap-1.5">
                                                <Zap className="w-3.5 h-3.5" /> AI Analysis
                                            </p>
                                            <p className="text-xs text-violet-800 dark:text-violet-200">{rankedProduct.explanation.summary}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-xs font-medium text-violet-600">
                                                    Score: {(rankedProduct.score * 100).toFixed(0)}%
                                                </span>
                                                <span className="text-xs font-medium text-violet-600">
                                                    Confidence: {(rankedProduct.confidence * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Score breakdown bars */}
                                        <div className="space-y-2">
                                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Score Breakdown</p>
                                            {[
                                                { label: 'Budget', v: rankedProduct.explanation.budget_fit_score?.score ?? 0, reason: rankedProduct.explanation.budget_fit_score?.reason },
                                                { label: 'Quality', v: rankedProduct.explanation.quality_score?.score ?? 0, reason: rankedProduct.explanation.quality_score?.reason },
                                                { label: 'Brand', v: rankedProduct.explanation.brand_preference_score?.score ?? 0, reason: rankedProduct.explanation.brand_preference_score?.reason },
                                                { label: 'Delivery', v: rankedProduct.explanation.delivery_speed_score?.score ?? 0, reason: rankedProduct.explanation.delivery_speed_score?.reason },
                                                { label: 'Ratings', v: rankedProduct.explanation.ratings_score?.score ?? 0, reason: rankedProduct.explanation.ratings_score?.reason },
                                            ].map(b => (
                                                <div key={b.label}>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-gray-600 dark:text-gray-400">{b.label}</span>
                                                        <span className="text-[11px] font-bold">{(b.v * 100).toFixed(0)}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mt-0.5">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${b.v >= 0.8 ? 'bg-green-400' : b.v >= 0.6 ? 'bg-blue-400' : 'bg-amber-400'}`}
                                                            style={{ width: `${b.v * 100}%` }}
                                                        />
                                                    </div>
                                                    {b.reason && <p className="text-[10px] text-gray-400 mt-0.5">{b.reason}</p>}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Strengths & Weaknesses */}
                                        {(rankedProduct.explanation.key_strengths?.length > 0 || rankedProduct.explanation.key_weaknesses?.length > 0) && (
                                            <div className="grid grid-cols-2 gap-2">
                                                {rankedProduct.explanation.key_strengths?.length > 0 && (
                                                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
                                                        <p className="text-[11px] font-semibold text-green-700 dark:text-green-300 mb-1.5">✓ Strengths</p>
                                                        <ul className="space-y-1">
                                                            {rankedProduct.explanation.key_strengths.map((s, i) => (
                                                                <li key={i} className="text-[11px] text-green-800 dark:text-green-200">• {s}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {rankedProduct.explanation.key_weaknesses?.length > 0 && (
                                                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                                                        <p className="text-[11px] font-semibold text-red-700 dark:text-red-300 mb-1.5">✗ Weaknesses</p>
                                                        <ul className="space-y-1">
                                                            {rankedProduct.explanation.key_weaknesses.map((w, i) => (
                                                                <li key={i} className="text-[11px] text-red-800 dark:text-red-200">• {w}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Key features */}
                                {(product.key_features?.length > 0 || product.features?.length > 0 || product.highlights?.length > 0) && (
                                    <div>
                                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Key Features</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(product.key_features || product.features || product.highlights || []).slice(0, 10).map((f: string, i: number) => (
                                                <span key={i} className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
                                                    {f}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Specifications */}
                                {product.specifications && Object.keys(product.specifications).length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Specifications</p>
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl divide-y divide-gray-100 dark:divide-gray-700">
                                            {Object.entries(product.specifications).slice(0, 8).map(([k, v]) => (
                                                <div key={k} className="flex justify-between px-3 py-2">
                                                    <span className="text-[11px] text-gray-500">{k}</span>
                                                    <span className="text-[11px] font-medium text-gray-800 dark:text-gray-200">{String(v)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer actions */}
                            <div className="flex-shrink-0 p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex gap-2">
                                <button
                                    onClick={handleAddToCart}
                                    disabled={cartAdded}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${cartAdded
                                        ? 'bg-green-500 text-white'
                                        : 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/20'
                                        }`}
                                    data-testid="product-detail-add-to-cart"
                                >
                                    {cartAdded ? (
                                        <><CheckCircle2 className="w-4 h-4" /> Added to Cart</>
                                    ) : (
                                        <><ShoppingCart className="w-4 h-4" /> Add to Cart</>
                                    )}
                                </button>
                                <a
                                    href={`/products/${product.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    data-testid="product-detail-full-page-link"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Full Page
                                </a>
                            </div>
                        </>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

/** Build a fake product object from RankedProduct data when the API isn't available */
function buildFallbackProduct(rp: RankedProduct) {
    const p = rp.product;
    return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        price: p.price,
        originalPrice: p.original_price,
        original_price: p.original_price,
        rating: p.rating,
        reviewCount: p.review_count,
        review_count: p.review_count,
        discount_percent: p.discount_percent,
        delivery_time: p.delivery_time,
        key_features: p.key_features,
        stock: 99,
        description: rp.explanation.summary,
        source: p.source,
        isExternal: (p as any).isExternal,
        imageUrl: p.imageUrl || getProductImage(p.name, p.brand, p.id),
        images: p.imageUrl ? [p.imageUrl] : [],
    };
}

export default ProductDetailModal;
