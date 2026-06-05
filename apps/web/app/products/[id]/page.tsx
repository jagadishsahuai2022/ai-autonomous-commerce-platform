'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchWithRetry } from '@/lib/safe-api';
import {
  ArrowLeft, ShoppingCart, Heart, Star, Truck, Shield, RefreshCw, Loader2,
  AlertCircle, Package, CheckCircle2, Tag, ChevronRight, Share2, Zap,
  ThumbsUp, MessageSquare, Award, BadgeCheck, ChevronLeft, Clock, MapPin,
  RotateCcw, Camera, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WishlistPickerModal } from '@/components/wishlist/WishlistPickerModal';
import { useWishlistStore } from '@/lib/store/wishlist.store';
import { VirtualTryOn } from '@/components/product/VirtualTryOn';
import { recordLearningEvent } from '@/lib/smart-intent/product-learning';
import { recordProductView } from '@/lib/smart-intent/session-personalization';
import { trackJourneyEvent } from '@/lib/journey-tracker';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function addToLocalStorageCart(product: any) {
  try {
    const raw = localStorage.getItem('cart');
    const cart: any[] = raw ? JSON.parse(raw) : [];
    const existing = cart.find((i) => i.productId === product.id);
    if (existing) { existing.quantity = (existing.quantity || 1) + 1; }
    else {
      cart.push({
        id: `cart-${product.id}-${Date.now()}`,
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.thumbnailUrl || product.image || (product.images && product.images[0]),
        stock: product.stock || 99,
      });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cartUpdated'));
    trackJourneyEvent('cart_added', { productId: product.id, productName: product.name, productCategory: product.category, productPrice: product.price });
  } catch { /* ignore */ }
}

function toggleLocalStorageWishlist(product: any): boolean {
  try {
    const raw = localStorage.getItem('wishlist');
    const wishlist: any[] = raw ? JSON.parse(raw) : [];
    const idx = wishlist.findIndex((i) => String(i.id) === String(product.id));
    if (idx !== -1) { wishlist.splice(idx, 1); localStorage.setItem('wishlist', JSON.stringify(wishlist)); window.dispatchEvent(new Event('wishlistUpdated')); return false; }
    wishlist.push({ id: product.id, name: product.name, price: product.price, image: product.thumbnailUrl || product.image });
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    window.dispatchEvent(new Event('wishlistUpdated'));
    return true;
  } catch { return false; }
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params?.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<'not_found' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [cartAdded, setCartAdded] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'specs' | 'reviews' | 'highlights'>('highlights');
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [pincode, setPincode] = useState('');
  const [deliveryMsg, setDeliveryMsg] = useState('');
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [showTryOn, setShowTryOn] = useState(false);
  const [rotateAngle, setRotateAngle] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const [showWishlistPicker, setShowWishlistPicker] = useState(false);

  const { isProductWishlisted, fetchWishlists, loaded: wishlistLoaded } = useWishlistStore();

  const [strictProdNoData, setStrictProdNoData] = useState(false);
  const [isCatalogPreview, setIsCatalogPreview] = useState(false);

  const fetchProduct = useCallback(async () => {
    if (!productId) return;
    setLoading(true); setErrorType(null); setStrictProdNoData(false); setIsCatalogPreview(false);
    const isStrictProd = typeof window !== 'undefined' && localStorage.getItem('dc-strict-prod-mode') === 'true';
    try {
      const res = await fetchWithRetry(`/api/products/${encodeURIComponent(productId)}${isStrictProd ? '?strictProd=true' : ''}`);
      if (!res.ok) {
        if (res.status === 404) {
          try { const body = await res.json(); if (body.strictProd) { setStrictProdNoData(true); } } catch { }
          setErrorType('not_found'); setLoading(false); return;
        }
        throw new Error(`API returned ${res.status}`);
      }
      const data = await res.json();
      // Handle catalog-preview response (DEMO products not in live DB)
      if (data.isCatalogPreview) {
        setIsCatalogPreview(true);
        setProduct(data);
        setLoading(false);
        return;
      }
      setProduct(data);
      recordLearningEvent(data.id, 'click');
      recordProductView(data.id, data.category || '', data.brand || '', data.price || 0);
      trackJourneyEvent('product_clicked', { productId: data.id, productName: data.name, productCategory: data.category, productPrice: data.price });
      // Wishlist state is handled by Zustand store
      if (!wishlistLoaded) fetchWishlists();
      try {
        const relRes = await fetchWithRetry(`/api/products?category=${encodeURIComponent(data.category)}&take=5`);
        if (relRes.ok) {
          const relData = await relRes.json();
          setRelatedProducts((relData.products || relData.data || []).filter((p: any) => String(p.id) !== String(data.id)).slice(0, 4));
        }
      } catch { /* ignore */ }
    } catch (err: any) {
      setErrorType('error'); setErrorMsg(err?.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  const handleAddToCart = () => {
    if (!product) return;
    addToLocalStorageCart(product);
    recordLearningEvent(product.id, 'add_to_cart');
    setCartAdded(true); setTimeout(() => setCartAdded(false), 2500);
  };

  const handleBuyNow = () => {
    if (!product) return;
    addToLocalStorageCart(product);
    recordLearningEvent(product.id, 'purchase');
    window.location.href = '/checkout';
  };

  const handleWishlist = () => {
    if (!product) return;
    setShowWishlistPicker(true);
  };

  // Derive wishlist state from Zustand store
  useEffect(() => {
    if (product && wishlistLoaded) {
      setInWishlist(isProductWishlisted(String(product.id)));
    }
  }, [product, wishlistLoaded, isProductWishlisted]);

  // Listen for wishlist updates
  useEffect(() => {
    const handler = () => {
      if (product) {
        setInWishlist(isProductWishlisted(String(product.id)));
      }
    };
    window.addEventListener('wishlistUpdated', handler);
    return () => window.removeEventListener('wishlistUpdated', handler);
  }, [product, isProductWishlisted]);

  const handleCheckDelivery = () => {
    if (pincode.length === 6) {
      setDeliveryMsg('Delivery available! Estimated delivery in 2-4 business days.');
    } else {
      setDeliveryMsg('Please enter a valid 6-digit pincode');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-slate-500 font-medium">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (errorType === 'not_found' || (!product && !isCatalogPreview)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
            <Package className="w-12 h-12 text-slate-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">
            {strictProdNoData ? 'No Product Data Available' : 'Product Not Found'}
          </h1>
          <p className="text-slate-500 mb-8">
            {strictProdNoData
              ? 'Strict PROD Data Source is enabled. Only real database products are shown. This product has no data in the production database.'
              : 'This product may have been removed or the link is incorrect.'}
          </p>
          {strictProdNoData && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg mb-6">
              Disable "Strict PROD Data Source" in Admin Dashboard to view mock/test data.
            </p>
          )}
          <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
            <ArrowLeft className="w-4 h-4" /> Browse Products
          </Link>
        </div>
      </div>
    );
  }

  if (errorType === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
            <AlertCircle className="w-12 h-12 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Something Went Wrong</h1>
          <p className="text-slate-500 mb-8">{errorMsg}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={fetchProduct} className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
            <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const images: string[] = (product?.images || []).filter((img: string) => img && !img.startsWith('📷') && !img.startsWith('🎧'));
  if (!images.length && product?.image) images.push(product.image);
  if (!images.length && product?.thumbnailUrl) images.push(product.thumbnailUrl);

  // ── Catalog Preview Page (for DEMO/CATALOG products not in live DB) ─────────
  if (isCatalogPreview) {
    const previewName = product?.name || decodeURIComponent(productId);
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
            <Package className="w-12 h-12 text-orange-400" />
          </div>
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full mb-4">
            <Tag className="w-3 h-3" /> DEMO CATALOG PRODUCT
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">{previewName}</h1>
          <p className="text-slate-500 mb-3 text-sm">
            This product was shown as a <strong>demo recommendation</strong> from our catalog preview.
            It is not currently available in our live product database.
          </p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-8">
            Our AI found this as a relevant match for your search. Once we stock this product, full details will appear here.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/shopping-assistant" className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-all shadow-lg shadow-violet-600/20">
              <MessageSquare className="w-4 h-4" /> Ask AI for Alternatives
            </Link>
            <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50">
              <ArrowLeft className="w-4 h-4" /> Browse Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayPrice = product.price || 0;
  const originalPrice = product.originalPrice;
  const discount = originalPrice && originalPrice > displayPrice ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100) : null;
  const rating = typeof product.rating === 'number' ? product.rating : 4.0;
  const reviewCount = product.reviewCount || product.reviews?.length || 0;
  const reviews = Array.isArray(product.reviews) ? product.reviews : [];
  const highlights = product.highlights || [];
  const specs = product.specifications || {};
  const isInStock = product.inStock !== false && (product.stock == null || product.stock > 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-2 text-sm text-slate-500 overflow-x-auto">
            <Link href="/" className="hover:text-blue-600 transition-colors whitespace-nowrap">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
            <Link href="/products" className="hover:text-blue-600 transition-colors whitespace-nowrap">Products</Link>
            {product.category && <>
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
              <Link href={`/products?category=${encodeURIComponent(product.category)}`} className="hover:text-blue-600 transition-colors whitespace-nowrap">{product.category}</Link>
            </>}
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-slate-700 font-medium truncate max-w-[200px]">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left: Image Gallery */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="lg:col-span-5">
            <div className="sticky top-24">
              {/* Main Image - Responsive with max-height */}
              <div
                className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group cursor-zoom-in"
                style={{ maxHeight: '420px', aspectRatio: '1/1' }}
                onClick={() => setImageModalOpen(true)}
                onMouseDown={(e) => { setIsDragging(true); dragStartX.current = e.clientX; }}
                onMouseMove={(e) => { if (isDragging) { const delta = e.clientX - dragStartX.current; setRotateAngle(prev => prev + delta * 0.5); dragStartX.current = e.clientX; } }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              >
                {images.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={images[selectedImage] || images[0]}
                    alt={product.name}
                    loading="eager"
                    className="w-full h-full object-contain p-4 transition-transform duration-300"
                    style={{ transform: `perspective(800px) rotateY(${rotateAngle}deg)` }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300">
                    <Package className="w-24 h-24" /><p className="text-sm mt-2">No image</p>
                  </div>
                )}
                {discount && (
                  <div className="absolute top-4 left-4 bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-lg">-{discount}% OFF</div>
                )}
                {images.length > 1 && (
                  <>
                    <button onClick={() => setSelectedImage(i => i > 0 ? i - 1 : images.length - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
                      <ChevronLeft className="w-5 h-5 text-slate-700" />
                    </button>
                    <button onClick={() => setSelectedImage(i => i < images.length - 1 ? i + 1 : 0)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
                      <ChevronRight className="w-5 h-5 text-slate-700" />
                    </button>
                  </>
                )}
                {images.length > 1 && (
                  <div className="absolute bottom-4 right-4 bg-black/60 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur">{selectedImage + 1} / {images.length}</div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2.5 mt-4 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <button key={idx} onClick={() => setSelectedImage(idx)}
                      className={`flex-shrink-0 w-16 h-16 rounded-xl border-2 overflow-hidden transition-all ${selectedImage === idx ? 'border-blue-500 shadow-md shadow-blue-500/20 scale-105' : 'border-slate-200 hover:border-slate-300'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* 3D & Try-On Controls */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setRotateAngle(prev => prev - 45)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors"
                  title="Rotate left"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 3D View
                </button>
                <button
                  onClick={() => setRotateAngle(0)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors"
                  title="Reset rotation"
                >
                  Reset
                </button>
                {(product.eligibleForVirtualTryOn || product.category === 'Fashion' || product.subCategory?.toLowerCase().includes('watch') || product.subCategory?.toLowerCase().includes('clothing') || product.subCategory?.toLowerCase().includes('shoe') || product.subCategory?.toLowerCase().includes('jewel') || product.subCategory?.toLowerCase().includes('glass') || product.subCategory?.toLowerCase().includes('furniture') || product.subCategory?.toLowerCase().includes('decor')) && (
                  <button
                    onClick={() => setShowTryOn(!showTryOn)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${showTryOn ? 'bg-violet-600 text-white' : 'bg-violet-100 hover:bg-violet-200 text-violet-700'}`}
                  >
                    <Camera className="w-3.5 h-3.5" /> Virtual Try-On
                  </button>
                )}
              </div>

              {/* Virtual Try-On Panel */}
              <AnimatePresence>
                {showTryOn && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden mt-3"
                  >
                    <VirtualTryOn
                      productImage={images[selectedImage] || images[0] || ''}
                      productName={product.name}
                      category={product.category || product.subCategory}
                      onClose={() => setShowTryOn(false)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Full-size Image Modal */}
          <AnimatePresence>
            {imageModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setImageModalOpen(false)}
              >
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.9 }}
                  className="relative max-w-4xl max-h-[90vh] w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  {images.length > 0 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={images[selectedImage] || images[0]}
                      alt={product.name}
                      className="w-full h-full max-h-[85vh] object-contain rounded-xl"
                    />
                  )}
                  <button
                    onClick={() => setImageModalOpen(false)}
                    className="absolute top-3 right-3 w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-700" />
                  </button>
                  {images.length > 1 && (
                    <>
                      <button onClick={() => setSelectedImage(i => i > 0 ? i - 1 : images.length - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 backdrop-blur rounded-full shadow-lg flex items-center justify-center hover:bg-white">
                        <ChevronLeft className="w-6 h-6 text-slate-700" />
                      </button>
                      <button onClick={() => setSelectedImage(i => i < images.length - 1 ? i + 1 : 0)} className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 backdrop-blur rounded-full shadow-lg flex items-center justify-center hover:bg-white">
                        <ChevronRight className="w-6 h-6 text-slate-700" />
                      </button>
                    </>
                  )}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {images.map((_, idx) => (
                      <button key={idx} onClick={() => setSelectedImage(idx)}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${selectedImage === idx ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/70'}`} />
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Right: Product Info */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="lg:col-span-7 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              {product.subCategory && <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold border border-blue-100">{product.subCategory}</span>}
              {product.brand && <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium"><BadgeCheck className="w-3 h-3" /> {product.brand}</span>}
              {product.isNewArrival && <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-100">New Arrival</span>}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{product.name}</h1>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                <Star className="w-4 h-4 fill-green-600 text-green-600" />
                <span className="text-sm font-bold text-green-700">{rating.toFixed(1)}</span>
              </div>
              {reviewCount > 0 && <button onClick={() => setActiveTab('reviews')} className="text-sm text-blue-600 hover:underline font-medium">{reviewCount.toLocaleString()} Ratings & Reviews</button>}
              {product.sellerName && <span className="text-sm text-slate-500 flex items-center gap-1"><Award className="w-3.5 h-3.5" /> Sold by <span className="font-medium text-slate-700">{product.sellerName}</span></span>}
            </div>

            {/* Price */}
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 rounded-2xl p-5 border border-blue-100">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-4xl font-extrabold text-slate-900">{formatCurrency(displayPrice)}</span>
                {originalPrice && originalPrice > displayPrice && (
                  <>
                    <span className="text-xl text-slate-400 line-through">{formatCurrency(originalPrice)}</span>
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-bold">Save {formatCurrency(originalPrice - displayPrice)}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                {product.gstIncluded && <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Inclusive of all taxes</span>}
                {displayPrice > 5000 && <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-blue-500" /> EMI from {formatCurrency(Math.round(displayPrice / 12))}/mo</span>}
              </div>
            </div>

            {isInStock ? (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm font-semibold text-green-700">In Stock</span>
                {product.stock && product.stock < 10 && <span className="text-sm text-orange-600 font-medium ml-2">Only {product.stock} left — order soon!</span>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <span className="text-sm font-semibold text-red-600">Currently Unavailable</span>
              </div>
            )}

            {product.description && <p className="text-slate-600 leading-relaxed">{product.description}</p>}

            {/* CTA */}
            <div className="flex gap-3">
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleAddToCart} disabled={!isInStock}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-base transition-all shadow-lg ${cartAdded ? 'bg-green-600 text-white shadow-green-600/30' : 'bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 disabled:border-slate-200 disabled:text-slate-400 disabled:shadow-none'}`}>
                {cartAdded ? <><CheckCircle2 className="w-5 h-5" /> Added to Cart</> : <><ShoppingCart className="w-5 h-5" /> Add to Cart</>}
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleBuyNow} disabled={!isInStock}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-base hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-600/30 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none">
                <Zap className="w-5 h-5" /> Buy Now
              </motion.button>
              <button onClick={handleWishlist}
                className={`hidden lg:flex p-4 rounded-xl border-2 transition-all ${inWishlist ? 'border-red-300 bg-red-50 text-red-500' : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-red-400'}`}>
                <Heart className={`w-5 h-5 ${inWishlist ? 'fill-red-500' : ''}`} />
              </button>
            </div>

            {/* Delivery */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" /> Delivery Options</h3>
              <div className="flex gap-2">
                <input type="text" value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter pincode" maxLength={6}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                <button onClick={handleCheckDelivery} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Check</button>
              </div>
              {deliveryMsg && <p className={`text-xs mt-2 ${deliveryMsg.includes('valid') ? 'text-red-500' : 'text-green-600'}`}>{deliveryMsg}</p>}
              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  { icon: Truck, title: 'Free Delivery', desc: displayPrice > 499 ? 'Eligible for this item' : 'Orders above ₹499' },
                  { icon: Clock, title: 'Fast Delivery', desc: '2-4 business days' },
                  { icon: RefreshCw, title: 'Easy Returns', desc: '30-day return policy' },
                  { icon: Shield, title: product.warranty || 'Brand Warranty', desc: 'Genuine product' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg">
                    <Icon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{title}</p>
                      <p className="text-[11px] text-slate-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {product.codAvailable !== false && <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-medium"><Tag className="w-3.5 h-3.5" /> Cash on Delivery</div>}
              {displayPrice > 5000 && <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-medium"><Zap className="w-3.5 h-3.5" /> No-cost EMI</div>}
              {product.trustScore && product.trustScore > 80 && <div className="flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg text-xs font-medium"><BadgeCheck className="w-3.5 h-3.5" /> Trusted Seller ({product.trustScore}%)</div>}
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="mt-12 lg:mt-16">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {([['highlights', 'Highlights'], ['specs', 'Specifications'], ['reviews', `Reviews (${reviews.length})`]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key as any)}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="mt-6">

              {activeTab === 'highlights' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8">
                  <h3 className="text-lg font-bold text-slate-900 mb-5">Product Highlights</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {highlights.map((h: string, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5"><CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /></div>
                        <span className="text-sm text-slate-700">{h}</span>
                      </div>
                    ))}
                  </div>
                  {product.description && (
                    <div className="mt-6 pt-6 border-t border-slate-100">
                      <h4 className="text-sm font-semibold text-slate-800 mb-2">Description</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'specs' && Object.keys(specs).length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="p-6 pb-0"><h3 className="text-lg font-bold text-slate-900 mb-5">Technical Specifications</h3></div>
                  <div className="divide-y divide-slate-100">
                    {Object.entries(specs).map(([key, value], i) => (
                      <div key={key} className={`flex px-6 py-3.5 text-sm ${i % 2 === 0 ? 'bg-slate-50/50' : ''}`}>
                        <span className="w-48 text-slate-500 flex-shrink-0 font-medium">{key.replace(/_/g, ' ')}</span>
                        <span className="text-slate-800 font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === 'specs' && Object.keys(specs).length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center"><p className="text-slate-500">No specifications available.</p></div>
              )}

              {activeTab === 'reviews' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row gap-6 items-start">
                    <div className="text-center flex-shrink-0">
                      <div className="text-5xl font-extrabold text-slate-900">{rating.toFixed(1)}</div>
                      <div className="flex gap-0.5 justify-center mt-2">
                        {[1, 2, 3, 4, 5].map(i => <Star key={i} className={`w-4 h-4 ${i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />)}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{reviewCount.toLocaleString()} ratings</p>
                    </div>
                    <div className="flex-1 w-full">
                      {[5, 4, 3, 2, 1].map(star => {
                        const count = reviews.filter((r: any) => r.rating === star).length;
                        const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                        return (
                          <div key={star} className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs text-slate-600 w-4">{star}</span>
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                            <span className="text-xs text-slate-400 w-8 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {(showAllReviews ? reviews : reviews.slice(0, 3)).map((review: any) => (
                    <div key={review.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">{(review.userName || 'A')[0].toUpperCase()}</div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{review.userName || 'Anonymous'}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map(i => <Star key={i} className={`w-3 h-3 ${i <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />)}</div>
                              {review.isVerified && <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Verified</span>}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      </div>
                      {review.title && <p className="text-sm font-semibold text-slate-800 mb-1">{review.title}</p>}
                      <p className="text-sm text-slate-600 leading-relaxed">{review.content}</p>
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                        <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600"><ThumbsUp className="w-3.5 h-3.5" /> Helpful ({review.helpful || 0})</button>
                      </div>
                    </div>
                  ))}
                  {reviews.length > 3 && !showAllReviews && (
                    <button onClick={() => setShowAllReviews(true)} className="w-full py-3 text-sm font-medium text-blue-600 bg-white border border-slate-200 rounded-xl hover:bg-blue-50 transition-all">Show All {reviews.length} Reviews</button>
                  )}
                  {reviews.length === 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                      <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">No reviews yet.</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-14">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">You May Also Like</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {relatedProducts.map((p: any) => (
                <Link key={p.id} href={`/products/${p.id}`}>
                  <div className="group bg-white rounded-2xl shadow-sm hover:shadow-lg border border-slate-200 transition-all duration-300 overflow-hidden hover:-translate-y-1">
                    <div className="aspect-square bg-slate-50 overflow-hidden">
                      {/* eslint-disable @next/next/no-img-element */}
                      {(p.image || p.thumbnailUrl) ? (
                        <img src={p.image || p.thumbnailUrl} alt={p.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : <div className="w-full h-full flex items-center justify-center"><Package className="w-12 h-12 text-slate-300" /></div>}
                      {/* eslint-enable @next/next/no-img-element */}
                    </div>
                    <div className="p-3.5">
                      <h3 className="font-semibold text-slate-900 text-sm line-clamp-2 mb-1.5 group-hover:text-blue-600 transition-colors">{p.name}</h3>
                      <p className="text-base font-bold text-slate-900">{formatCurrency(p.price)}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-xs text-slate-600">{((p.rating as number) || 4.0).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Trust Banner */}
        <div className="mt-12 mb-8 bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 rounded-2xl border border-blue-100 p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Shield, title: '100% Genuine', desc: 'Authentic products only' },
              { icon: RefreshCw, title: 'Easy Returns', desc: '30-day hassle-free returns' },
              { icon: Truck, title: 'Free Shipping', desc: 'On orders above ₹499' },
              { icon: Award, title: 'Best Prices', desc: 'Competitive pricing guaranteed' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{title}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wishlist Picker Modal */}
      {product && (
        <WishlistPickerModal
          isOpen={showWishlistPicker}
          onClose={() => setShowWishlistPicker(false)}
          product={{
            id: String(product.id),
            name: product.name,
            price: product.price,
            imageUrl: product.thumbnailUrl || product.image || (product.images && product.images[0]),
          }}
          onComplete={(action, collectionName) => {
            setInWishlist(action === 'added');
            setShowWishlistPicker(false);
            window.dispatchEvent(new Event('wishlistUpdated'));
            if (action === 'added') {
              trackJourneyEvent('wishlist_added', { productId: product?.id, productName: product?.name, productCategory: product?.category, productPrice: product?.price });
            } else {
              trackJourneyEvent('wishlist_removed', { productId: product?.id, productName: product?.name, productCategory: product?.category, productPrice: product?.price });
            }
          }}
        />
      )}

      {/* Mobile floating wishlist FAB */}
      <button
        onClick={handleWishlist}
        className={`lg:hidden fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${inWishlist ? 'bg-red-500 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}
      >
        <Heart className={`w-5 h-5 ${inWishlist ? 'fill-white' : ''}`} />
      </button>
    </div>
  );
}
