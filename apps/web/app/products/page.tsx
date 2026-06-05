'use client';

import { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Loader2, Search, SlidersHorizontal, X, ChevronDown, Check, ArrowUpDown } from 'lucide-react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useInfiniteProducts, useSearchProducts } from '@/hooks/useProducts';
import { useCategories, STATIC_CATEGORIES } from '@/hooks/useCategories';
import { ProductCard } from '@/components/product/DCProductCard';
import { ProductFilters, FilterState, INITIAL_FILTER_STATE } from '@/components/product/ProductFilters';
import { CategorySphereWrapper } from '@/components/sphere/CategorySphereWrapper';
import { useSphereStore } from '@/store/useSphereStore';
import { useProductPageStore } from '@/lib/stores/product-page-store';
import { trackSphereExpand } from '@/lib/sphere/sphere-analytics';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product } from '@/types';
import { recordLearningEvent, recordImpressions } from '@/lib/smart-intent/product-learning';
import { recordProductView, recordCategoryBrowse } from '@/lib/smart-intent/session-personalization';
import { trackJourneyEvent } from '@/lib/journey-tracker';
import { useWishlistStore } from '@/lib/store/wishlist.store';
import { WishlistPickerModal } from '@/components/wishlist/WishlistPickerModal';
import { getProductImage } from '@/lib/product-images';

const SORT_OPTIONS = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'price-low', label: 'Price: Low to High' },
  { id: 'price-high', label: 'Price: High to Low' },
  { id: 'rating', label: 'Highest Rated' },
  { id: 'newest', label: 'Newest' },
];


function addToLocalStorageCart(product: Product) {
  try {
    const raw = localStorage.getItem('cart');
    const cart: any[] = raw ? JSON.parse(raw) : [];
    const existing = cart.find((i) => i.productId === product.id);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      cart.push({
        id: `cart-${product.id}-${Date.now()}`,
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image,
        stock: product.inStock ? 99 : 0,
      });
    }
    trackJourneyEvent('cart_added', {
      productId: String(product.id),
      productName: product.name,
      productCategory: product.category,
      productPrice: product.price,
    });
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cartUpdated'));
  } catch { }
}

function toggleLocalStorageWishlist(product: Product) {
  // Legacy: kept for localStorage fallback only — primary flow uses Zustand store + API
  try {
    const raw = localStorage.getItem('wishlist');
    const wishlist: any[] = raw ? JSON.parse(raw) : [];
    const idx = wishlist.findIndex((i) => i.id === product.id);
    if (idx !== -1) {
      wishlist.splice(idx, 1);
    } else {
      wishlist.push({
        id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.image,
        rating: product.rating,
        reviewCount: product.reviewCount,
        category: product.category,
        brand: product.brand,
        inStock: product.inStock,
        delivery: product.delivery,
        codAvailable: product.codAvailable,
        hasEMI: product.hasEMI,
      });
    }
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
  } catch { }
}

/** Helper: get image for a product, using client-side fallback when product.image is missing */
function getImageForProduct(product: Product): string | undefined {
  if (product.image) return undefined; // AmazonProductCard will use product.image directly
  return getProductImage(product.name, product.brand, product.id);
}

/** Invisible component that fires recordImpressions when search results change */
function SearchImpressionTracker({ products }: { products: any[] }) {
  const trackedRef = useRef('');
  useEffect(() => {
    if (!products.length) return;
    const key = products.map((p) => p.id).join(',');
    if (key === trackedRef.current) return;
    trackedRef.current = key;
    recordImpressions(products.map((p) => p.id));
  }, [products]);
  return null;
}

function handleBuyNow(product: Product, router: ReturnType<typeof useRouter>) {
  addToLocalStorageCart(product);
  router.push('/checkout');
}

/** Debounce hook */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function ProductsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [sortBy, setSortBy] = useState('relevance');
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // ── Wishlist: Zustand store + picker modal ──
  const { isProductWishlisted, fetchWishlists, loaded: wishlistLoaded } = useWishlistStore();
  const [wishlistPickerProduct, setWishlistPickerProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!wishlistLoaded) fetchWishlists();
    const onWishlistUpdated = () => fetchWishlists();
    window.addEventListener('wishlistUpdated', onWishlistUpdated);
    return () => window.removeEventListener('wishlistUpdated', onWishlistUpdated);
  }, [wishlistLoaded, fetchWishlists]);

  const handleWishlistClick = useCallback((product: Product) => {
    setWishlistPickerProduct(product);
  }, []);

  // ── Unified filter state (lives here, NOT inside ProductFilters to survive remounts) ──
  const [filterState, setFilterState] = useState<FilterState>(INITIAL_FILTER_STATE);

  // ── Hydration gate — prevents initial query from firing before state is restored ──
  const [isHydrated, setIsHydrated] = useState(false);

  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isDemoUser, setIsDemoUser] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const pageSize = 20;

  // ── Sphere state — read from Zustand to render docked button inline with sort widget ──
  const isSphereExpanded = useSphereStore((s) => s.isSphereExpanded);
  const isSphereDocked = useSphereStore((s) => s.isSphereDocked);
  const sphereSelectedCategory = useSphereStore((s) => s.selectedCategory);
  const sphereExpand = useSphereStore((s) => s.expand);

  // ── Dynamic categories ──
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();
  const categories = categoriesData ?? STATIC_CATEGORIES;

  // ── Product Page Store — session-persistent filter/scroll state ──
  // IMPORTANT: Do NOT subscribe to full store (const ppStore = useProductPageStore()).
  // Full subscription causes excessive re-renders that break filter/sphere reactivity.
  // Use getState() in effects only for reading/writing without triggering re-renders.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);

  // ── Persist filter/sort/search changes to store (defined BEFORE hydration effect) ──
  // This ordering ensures these effects see hasMountedRef.current = false on first mount
  // (before hydration runs), preventing stale initial values from overwriting session data.
  useEffect(() => {
    if (!hasMountedRef.current) return;
    useProductPageStore.getState().setSearchQuery(searchQuery);
  }, [searchQuery]);
  useEffect(() => {
    if (!hasMountedRef.current) return;
    useProductPageStore.getState().setSortBy(sortBy);
  }, [sortBy]);
  useEffect(() => {
    if (!hasMountedRef.current) return;
    useProductPageStore.getState().setFilterState(filterState as unknown as Record<string, any>);
  }, [filterState]);

  // ── Saved scroll target — populated by hydration, consumed after data loads ──
  const savedScrollYRef = useRef(0);
  const scrollRestoredRef = useRef(false);

  // ── Hydrate from sessionStorage on mount (defined AFTER persistence effects) ──
  // When this effect runs, persistence effects above have already run with hasMountedRef=false
  // (so they skipped correctly). Setting hasMountedRef=true here enables future persistence.
  useEffect(() => {
    const store = useProductPageStore.getState();
    store.hydrate();
    // Re-read after hydrate (Zustand set is synchronous)
    const s = useProductPageStore.getState();
    if (s.searchQuery) setSearchQuery(s.searchQuery);
    if (s.sortBy && s.sortBy !== 'relevance') setSortBy(s.sortBy);
    if (s.filterState) setFilterState(s.filterState as unknown as FilterState);

    // Hydrate sphere store — restores selectedCategory, docked/expanded state.
    // Must happen here (not inside CategorySphereWrapper) because the products page
    // hydration feeds filterState *back* to the sphere through initialExpanded.
    useSphereStore.getState().hydrate();

    // Restore sphere category to the filter display (docked button badge)
    if (s.sphereCategory) {
      // useSphereStore.hydrate() already restores selectedCategory from its own session.
      // If sphere session is empty (first visit in new tab), fall back to product store's value.
      if (!useSphereStore.getState().selectedCategory) {
        useSphereStore.getState().setSelectedCategory(s.sphereCategory);
      }
    }

    // Record scroll target; actual scroll happens after products data loads (see below).
    savedScrollYRef.current = s.scrollY;
    hasMountedRef.current = true;
    setIsHydrated(true);
  }, []);

  // Save scroll position on unmount
  useEffect(() => {
    return () => {
      useProductPageStore.getState().setScrollY(window.scrollY);
    };
  }, []);

  // Detect demo user (for product count visibility)
  useEffect(() => {
    try {
      const email = localStorage.getItem('userEmail') || '';
      setIsDemoUser(email === 'demo@example.com');
    } catch { }
    const onAuth = () => {
      try {
        const email = localStorage.getItem('userEmail') || '';
        setIsDemoUser(email === 'demo@example.com');
      } catch { }
    };
    window.addEventListener('authUpdated', onAuth);
    return () => window.removeEventListener('authUpdated', onAuth);
  }, []);

  // Close sort menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Listen for search island events from the global nav
  useEffect(() => {
    const onGlobalSearch = (e: Event) => {
      const query = (e as CustomEvent<{ query: string }>).detail?.query ?? '';
      setSearchQuery(query);
    };
    const onToggleFilters = () => {
      setShowFilters(prev => !prev);
    };
    window.addEventListener('globalSearch', onGlobalSearch);
    window.addEventListener('toggleFilters', onToggleFilters);
    return () => {
      window.removeEventListener('globalSearch', onGlobalSearch);
      window.removeEventListener('toggleFilters', onToggleFilters);
    };
  }, []);

  // Initialize search + filters from URL params on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q) setSearchQuery(q);
      const filtersOpen = params.get('filters');
      if (filtersOpen === 'open') setShowFilters(true);
      // Pre-select category from URL (e.g. /products?category=Electronics)
      const cat = params.get('category');
      if (cat) {
        setFilterState(prev => ({ ...prev, categories: [cat] }));
        recordCategoryBrowse(cat);
      }
    } catch { }
  }, []);

  // Scroll-aware filter panel: hide on scroll, auto-reshow after 5s idle
  const scrollHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollY = useRef(0);
  const filterWasOpen = useRef(false);
  const showFiltersRef = useRef(showFilters);
  useEffect(() => { showFiltersRef.current = showFilters; }, [showFilters]);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = Math.abs(currentY - lastScrollY.current);
      if (delta > 30) {
        if (showFiltersRef.current) filterWasOpen.current = true;
        setShowFilters(false);
        if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
        scrollHideTimer.current = setTimeout(() => {
          if (window.innerWidth >= 1024 && filterWasOpen.current) {
            setShowFilters(true);
            filterWasOpen.current = false;
          }
        }, 5000);
        lastScrollY.current = currentY;
      }
    };
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => { handleScroll(); ticking = false; });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
    };
  }, []);

  // Virtual scrolling refs and state
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // Responsive column count matching the grid CSS breakpoints
  const [columns, setColumns] = useState(5);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setColumns(w >= 1280 ? 5 : w >= 1024 ? 4 : w >= 768 ? 3 : 2);
    };
    update();
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);

  const searchTrimmed = debouncedSearch.trim();

  // ── Build server-side filter params from filterState ──────────────────────
  // All filters sent to backend; products page gets truly filtered server results.
  const serverFilters = useMemo(() => {
    const f: Record<string, string | number | boolean | undefined> = {};
    if (filterState.categories.length === 1) f.category = filterState.categories[0];
    if (filterState.priceMin > 0) f.minPrice = filterState.priceMin;
    if (filterState.priceMax < 500000) f.maxPrice = filterState.priceMax;
    if (filterState.rating === '4plus') f.minRating = 4;
    else if (filterState.rating === '3plus') f.minRating = 3;
    else if (filterState.rating === '2plus') f.minRating = 2;
    // Discount: send the minimum of selected tiers
    if (filterState.discountRange.length > 0) {
      const tiers: Record<string, number> = { '50plus': 50, '30plus': 30, '10plus': 10 };
      const minTier = Math.min(...filterState.discountRange.map(t => tiers[t] ?? 10));
      f.minDiscount = minTier;
    }
    // Delivery options map to backend boolean params
    if (filterState.deliveryOptions.includes('free')) f.freeDelivery = true;
    if (filterState.deliveryOptions.includes('express')) f.expressDelivery = true;
    if (filterState.deliveryOptions.includes('cod')) f.codAvailable = true;
    if (sortBy && sortBy !== 'relevance') f.sortBy = sortBy;
    return f;
  }, [filterState, sortBy]);

  // Infinite scroll for browsing (no search) — uses all active filters
  const {
    data: infiniteData,
    isLoading: allLoading,
    error: allError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProducts(
    {
      category: serverFilters.category as string | undefined,
      minPrice: serverFilters.minPrice as number | undefined,
      maxPrice: serverFilters.maxPrice as number | undefined,
      minRating: serverFilters.minRating as number | undefined,
      minDiscount: serverFilters.minDiscount as number | undefined,
      freeDelivery: serverFilters.freeDelivery as boolean | undefined,
      expressDelivery: serverFilters.expressDelivery as boolean | undefined,
      codAvailable: serverFilters.codAvailable as boolean | undefined,
      sortBy: serverFilters.sortBy as 'price' | 'rating' | 'relevance' | 'price-low' | 'price-high' | 'newest' | 'popular' | undefined,
      limit: pageSize,
    }
    , pageSize
    , isHydrated // Don't fire the query until sessionStorage state is restored
  );

  const { data: searchResults, isLoading: searchLoading, error: searchError } =
    useSearchProducts(searchTrimmed);

  const isLoading = searchTrimmed ? searchLoading : allLoading;
  const error = searchTrimmed ? searchError : allError;

  // Flatten paginated data
  const allLoadedProducts: any[] = useMemo(() => {
    if (searchTrimmed) {
      return Array.isArray(searchResults) ? searchResults : [];
    }
    return infiniteData?.pages.flatMap((page) => page.data) ?? [];
  }, [searchTrimmed, searchResults, infiniteData]);

  const totalProducts = infiniteData?.pages[0]?.total ?? allLoadedProducts.length;

  // All filtering is server-side → only client-side sort needed for search mode.
  // In browse mode the server already returns sorted+filtered data.
  const filteredProducts = useMemo(() => {
    let result = [...allLoadedProducts];
    // In search mode, apply client-side sort since the intent engine doesn't sort
    if (searchTrimmed) {
      switch (sortBy) {
        case 'price-low': result.sort((a: any, b: any) => a.price - b.price); break;
        case 'price-high': result.sort((a: any, b: any) => b.price - a.price); break;
        case 'rating': result.sort((a: any, b: any) => b.rating - a.rating); break;
        case 'newest': result.sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()); break;
        default: break;
      }
    }
    return result;
  }, [allLoadedProducts, sortBy, searchTrimmed]);

  // Calculate the grid list's absolute offset from the page top (used for windowed virtualizer).
  // Only re-run when products first appear (not on every isFetchingNextPage toggle) to prevent
  // all virtual items from re-translating mid-scroll (flicker root cause #1).
  const scrollMarginMeasuredRef = useRef(false);
  useLayoutEffect(() => {
    if (!listRef.current) return;
    if (scrollMarginMeasuredRef.current) return; // measure only once
    const margin = listRef.current.getBoundingClientRect().top + window.scrollY;
    if (margin > 0) {
      scrollMarginMeasuredRef.current = true;
      setScrollMargin(margin);
    }
  });

  // Virtual row count: for browsing mode (not search)
  const rowCount = searchTrimmed ? 0 : Math.ceil(filteredProducts.length / columns);

  // Window-level virtualizer for the product grid rows
  const rowVirtualizer = useWindowVirtualizer({
    count: !searchTrimmed && hasNextPage ? rowCount + 1 : rowCount,
    estimateSize: () => 340, // accurate row height: card h-40(160px) + text ~110px + gap/padding 70px
    overscan: 6, // more pre-rendered rows = smoother scroll, fewer visible gaps
    scrollMargin,
  });

  // Extract virtual items at render time so we get a stable primitive (lastVirtualItem.index)
  // instead of passing getVirtualItems() array as a useEffect dependency (which returns a new
  // array reference every render → effect fires on every scroll frame → flicker root cause #2).
  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastVirtualItem = virtualItems[virtualItems.length - 1];

  // Trigger fetch when virtual window approaches the last loaded row
  useEffect(() => {
    if (searchTrimmed || !hasNextPage || isFetchingNextPage) return;
    if (!lastVirtualItem) return;
    if (lastVirtualItem.index >= rowCount - 5) {
      fetchNextPage();
    }
  }, [lastVirtualItem?.index, rowCount, hasNextPage, isFetchingNextPage, searchTrimmed]);

  // Restore scroll position AFTER products first load (fix timing issue with virtual scroll).
  // The virtualizer can only render rows it knows about; scrollTo needs rows to exist.
  // Waiting for !allLoading ensures the first page is rendered before we scroll.
  useEffect(() => {
    if (allLoading) return; // data still loading
    if (scrollRestoredRef.current) return; // already restored
    if (!hasMountedRef.current) return; // hydration hasn't run yet
    const y = savedScrollYRef.current;
    if (y <= 0) return;
    scrollRestoredRef.current = true;
    // 200ms allows the virtual list to measure row heights after data arrives
    const t = setTimeout(() => {
      window.scrollTo({ top: y, behavior: 'instant' });
    }, 200);
    return () => clearTimeout(t);
  }, [allLoading]);

  const handleFilterStateChange = (next: FilterState) => {
    setFilterState(next);
    if (next.categories.length > 0) recordCategoryBrowse(next.categories[0]);

    // ── Sync filter categories → sphere store so the docked button reflects selections ──
    const sphereStore = useSphereStore.getState();
    if (next.categories.length === 0) {
      // No categories selected → clear sphere
      if (sphereStore.selectedCategory) {
        sphereStore.setSelectedCategory(null);
        useProductPageStore.getState().setSphereCategory('');
      }
    } else {
      // Set first selected category on sphere (docked button shows all via tooltip)
      const first = next.categories[0];
      if (sphereStore.selectedCategory !== first) {
        sphereStore.setSelectedCategory(first);
        useProductPageStore.getState().setSphereCategory(first);
      }
    }
  };

  /** Called when user clicks a category node on the 3D sphere */
  const handleSphereCategory = useCallback((categoryName: string) => {
    if (!categoryName) {
      // Clear category filter
      setFilterState(prev => ({ ...prev, categories: [] }));
      // Persist cleared sphere category so docked button badge clears on reload
      useProductPageStore.getState().setSphereCategory('');
      return;
    }
    setFilterState({ ...INITIAL_FILTER_STATE, categories: [categoryName] });
    setSortBy('price-low'); // cheapest first as per spec
    recordCategoryBrowse(categoryName);
    // Persist sphere category so it can be restored after navigation/reload
    useProductPageStore.getState().setSphereCategory(categoryName);
  }, []);

  const activeFilterCount = (
    filterState.categories.length +
    (filterState.rating ? 1 : 0) +
    filterState.discountRange.length +
    filterState.deliveryOptions.length +
    (filterState.priceMin > 0 || filterState.priceMax < 500000 ? 1 : 0)
  );

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        {/* Ambient background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-1/3 w-96 h-96 bg-violet-100/40 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-cyan-100/40 rounded-full blur-3xl" />
        </div>

        {/* ── 3D Category Sphere (fixed overlay) ── */}
        <CategorySphereWrapper
          categories={categories}
          onCategorySelect={handleSphereCategory}
          initialExpanded={filterState.categories.length === 0}
          selectedFilterCategories={filterState.categories}
        />

        {/* ── Top-right control bar: [sphere dock] [sort widget] ── */}
        {/* Both share same fixed position row so sphere icon appears left of Relevance */}
        <div className="fixed top-[61px] right-4 sm:right-6 lg:right-8 z-40 flex items-center gap-2">

          {/* ── Minimized sphere docked button — only shown when sphere is docked ── */}
          <AnimatePresence>
            {isSphereDocked && !isSphereExpanded && (
              <motion.button
                key="sphere-dock-btn"
                data-testid="sphere-docked-icon"
                initial={{ opacity: 0, scale: 0.7, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.7, x: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                onClick={() => { sphereExpand(); trackSphereExpand(); }}
                title={
                  filterState.categories.length > 1
                    ? `Categories: ${filterState.categories.join(', ')}`
                    : filterState.categories.length === 1
                      ? filterState.categories[0]
                      : 'Open category sphere'
                }
                aria-label="Open category sphere"
                className="
                flex items-center gap-1.5 px-2.5 py-2 rounded-xl
                bg-gray-900/95 backdrop-blur-md
                border border-violet-500/30
                shadow-lg shadow-violet-900/30
                hover:border-violet-400/60 hover:shadow-violet-500/20
                transition-all group
              "
              >
                {/* Animated sphere globe icon */}
                <span
                  className="text-[15px] leading-none group-hover:scale-110 transition-transform"
                  style={{ display: 'inline-block', animation: 'spin 5s linear infinite' }}
                  aria-hidden="true"
                >
                  🌐
                </span>
                {/* Selected category badges — show first + count for multi-select */}
                {filterState.categories.length > 0 ? (
                  <span className="flex items-center gap-1 max-w-[120px]">
                    <span className="text-[11px] text-violet-300 font-medium truncate">
                      {filterState.categories[0]}
                    </span>
                    {filterState.categories.length > 1 && (
                      <span className="text-[9px] text-violet-400/80 bg-violet-500/20 px-1 py-0.5 rounded-full font-bold flex-shrink-0">
                        +{filterState.categories.length - 1}
                      </span>
                    )}
                  </span>
                ) : sphereSelectedCategory ? (
                  <span className="text-[11px] text-violet-300 font-medium max-w-[80px] truncate">
                    {sphereSelectedCategory}
                  </span>
                ) : null}
              </motion.button>
            )}
          </AnimatePresence>

          {/* ── Sort widget ── */}
          <div ref={sortMenuRef} className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-all shadow-lg shadow-slate-200/60 dark:shadow-gray-900/40 text-sm font-medium"
            >
              <ArrowUpDown size={13} className="text-violet-500" />
              <span className="hidden sm:inline text-xs">{SORT_OPTIONS.find(o => o.id === sortBy)?.label ?? 'Sort'}</span>
              {/* Always show loaded/total count so users know scroll progress */}
              {!searchTrimmed ? (
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 text-[9px] font-bold ml-0.5">
                  {allLoadedProducts.length.toLocaleString()}
                  {totalProducts > 0 && (
                    <span className="text-violet-400">/{totalProducts.toLocaleString()}</span>
                  )}
                </span>
              ) : filteredProducts.length > 0 && (
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 text-[9px] font-bold ml-0.5">
                  {filteredProducts.length.toLocaleString()}
                </span>
              )}
              <ChevronDown size={11} className={`flex-shrink-0 self-center transition-transform duration-200 ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-xl shadow-slate-200/60 dark:shadow-gray-900/60 z-50 py-1.5 overflow-hidden"
                >
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => { setSortBy(option.id); setShowSortMenu(false); }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors ${sortBy === option.id
                        ? 'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-800'
                        }`}
                    >
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border ${sortBy === option.id ? 'bg-violet-600 border-violet-600' : 'border-slate-300 dark:border-gray-600'
                        }`}>
                        {sortBy === option.id && <Check size={9} className="text-white" />}
                      </span>
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Sticky mini header: mobile filter toggle only ── */}
        <div className="sticky top-[61px] z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-gray-700/80 shadow-sm">
          <div className="max-w-full mx-auto px-4 py-2 flex items-center gap-2 min-w-0">
            {/* Mobile filter toggle (lg+ uses island filter icon) */}
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="lg:hidden flex-shrink-0 p-2 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 text-slate-500 relative"
            >
              <SlidersHorizontal size={18} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-600 text-white text-[10px] rounded-full flex items-center justify-center" aria-label={`${activeFilterCount} active filters`}>
                  {activeFilterCount}
                </span>
              )}
            </button>
            <div className="flex-1" />
            {/* Right spacer so content doesn't hide under floating sort */}
            <div className="w-28 flex-shrink-0" />
          </div>
        </div>

        <div className="relative z-10">
          {/* ── Floating Dark Filter Panel - Desktop ───────────────────────── */}
          <AnimatePresence>
            {showFilters && (
              <>
                {/* Backdrop (click to close) */}
                <motion.div
                  key="filter-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 hidden lg:block"
                  onClick={() => setShowFilters(false)}
                />
                {/* Dark floating panel */}
                <motion.div
                  key="filter-panel"
                  initial={{ x: -20, opacity: 0, scale: 0.97 }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  exit={{ x: -20, opacity: 0, scale: 0.97 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                  className="fixed left-4 z-50 hidden lg:flex flex-col"
                  style={{ top: 'calc(var(--header-h, 130px) + 8px)', maxHeight: 'calc(100vh - var(--header-h, 130px) - 24px)', width: 280 }}
                >
                  <div className="flex flex-col rounded-2xl bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40 overflow-hidden">
                    {/* Panel header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal size={15} className="text-violet-400" />
                        <span className="text-sm font-semibold text-white">Filters</span>
                        {activeFilterCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-violet-500 text-white text-[10px] font-bold">
                            {activeFilterCount}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setShowFilters(false)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {/* Panel content — no inner scroll, let the panel height scroll naturally */}
                    <div className="overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                      <ProductFilters
                        isOpen={true}
                        filterState={filterState}
                        onFilterChange={handleFilterStateChange}
                        categories={categories}
                        categoriesLoading={categoriesLoading}
                      />
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Mobile Filter Overlay */}
          <AnimatePresence>
            {showMobileFilters && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                  onClick={() => setShowMobileFilters(false)}
                />
                <motion.div
                  initial={{ x: -280 }}
                  animate={{ x: 0 }}
                  exit={{ x: -280 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="fixed inset-y-0 left-0 z-50 w-[280px] bg-white dark:bg-gray-900 shadow-2xl lg:hidden flex flex-col"
                >
                  <ProductFilters
                    isOpen={true}
                    filterState={filterState}
                    onFilterChange={handleFilterStateChange}
                    categories={categories}
                    categoriesLoading={categoriesLoading}
                    onClose={() => setShowMobileFilters(false)}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Product Grid */}
          <div className="min-w-0">
            <div className="max-w-full px-4 py-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-3"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-700 font-medium">
                      Failed to load products. Please try again.
                    </p>
                    <button
                      onClick={() => window.location.reload()}
                      className="text-red-600 hover:underline text-xs font-medium mt-1"
                    >
                      Try again
                    </button>
                  </div>
                </motion.div>
              )}

              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-64 rounded-2xl bg-slate-100 border border-slate-200 animate-pulse" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 flex items-center justify-center">
                    <Search className="w-10 h-10 text-slate-400" />
                  </div>
                  <p className="text-base text-slate-500 mb-4">
                    No products found matching your search
                  </p>
                  <button
                    onClick={() => { setSearchQuery(''); setFilterState(INITIAL_FILTER_STATE); }}
                    className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-sm rounded-xl font-medium hover:from-violet-500 hover:to-cyan-500 transition-all"
                  >
                    Clear All Filters
                  </button>
                </motion.div>
              ) : searchTrimmed ? (
                /* Search results: render all (typically small result set) */
                <>
                  <SearchImpressionTracker products={filteredProducts} />
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {filteredProducts.map((product: any, index: number) => (
                      <motion.div
                        key={`${product.id}-${index}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.02, 0.5) }}
                      >
                        <ProductCard
                          product={product}
                          onAddToCart={() => { addToLocalStorageCart(product); recordLearningEvent(product.id, 'add_to_cart'); }}
                          onBuyNow={() => handleBuyNow(product, router)}
                          onWishlist={() => handleWishlistClick(product)}
                          isFavorited={isProductWishlisted(String(product.id))}
                          fallbackImage={getImageForProduct(product)}
                        />
                      </motion.div>
                    ))}
                  </div>
                </>
              ) : (
                /* Browsing mode: windowed virtual grid — only visible rows are in the DOM */
                <div ref={listRef}>
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {virtualItems.map((virtualRow) => {
                      const isLoaderRow = virtualRow.index >= rowCount;
                      const start = virtualRow.index * columns;
                      const rowProducts = filteredProducts.slice(start, start + columns);

                      return (
                        <div
                          key={virtualRow.key}
                          data-index={virtualRow.index}
                          ref={rowVirtualizer.measureElement}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                          }}
                        >
                          {isLoaderRow ? (
                            <div className="flex justify-center items-center gap-2 py-6 text-sm text-gray-500">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Loading more products…
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-3">
                              {rowProducts.map((product: any) => (
                                <ProductCard
                                  key={product.id}
                                  product={product}
                                  onAddToCart={() => { addToLocalStorageCart(product); recordLearningEvent(product.id, 'add_to_cart'); }}
                                  onBuyNow={() => handleBuyNow(product, router)}
                                  onWishlist={() => handleWishlistClick(product)}
                                  isFavorited={isProductWishlisted(String(product.id))}
                                  fallbackImage={getImageForProduct(product)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Footer status */}
                  {!hasNextPage && allLoadedProducts.length > 0 && (
                    <div className="flex flex-col items-center gap-2 py-6">
                      {allLoadedProducts.length < totalProducts ? (
                        <>
                          <span className="px-3 py-1 rounded-full bg-violet-100 border border-violet-200 text-xs text-violet-700 font-medium">
                            Showing {allLoadedProducts.length.toLocaleString()} of {totalProducts.toLocaleString()} products
                          </span>
                          <span className="text-xs text-slate-400">
                            Use search or category filters to find specific products
                          </span>
                        </>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-500">
                          All {filteredProducts.length.toLocaleString()} products loaded
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Wishlist Picker Modal */}
      {wishlistPickerProduct && (
        <WishlistPickerModal
          isOpen={!!wishlistPickerProduct}
          onClose={() => setWishlistPickerProduct(null)}
          product={{
            id: String(wishlistPickerProduct.id),
            name: wishlistPickerProduct.name,
            price: wishlistPickerProduct.price,
            imageUrl: wishlistPickerProduct.image || getImageForProduct(wishlistPickerProduct),
          }}
          onComplete={() => {
            trackJourneyEvent('wishlist_added', {
              productId: String(wishlistPickerProduct.id),
              productName: wishlistPickerProduct.name,
              productCategory: wishlistPickerProduct.category,
              productPrice: wishlistPickerProduct.price,
            });
            setWishlistPickerProduct(null);
            // Also sync to localStorage for backward compatibility
            toggleLocalStorageWishlist(wishlistPickerProduct);
          }}
        />
      )}
    </>
  );
}
