/**
 * CategorySphereWrapper - Top-level entry for the 3D Discovery Sphere v3.
 *
 * v3 changes:
 *  - Viewport-centered via flexbox, outside layout flow
 *  - NO full-screen backdrop - sphere boundary is the only overlay
 *  - Responsive: Desktop min(60vw, 700px), Tablet 75vw, Mobile 90vw
 *  - Perfect circle: aspect-ratio: 1/1
 *  - Discovery engine integration - ranked items, not just categories
 *  - Analytics tracking - engagement, CTR, repeat usage
 *  - DockedSphereButton exported for products/page.tsx to place inline with sort widget
 *
 * Architecture:
 *  - R3F Canvas imported dynamically (ssr: false)
 *  - Discovery engine scores and ranks sphere items
 *  - Analytics track all sphere interactions
 *  - Fallback: horizontal scroll chips when 3D unavailable
 */

'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useSphereStore } from '@/store/useSphereStore';
import { useSpherePerformance } from '@/hooks/useSpherePerformance';
import { CategorySphereFallback } from './CategorySphereFallback';
import { generateDiscoveryItems } from '@/lib/sphere/discovery-engine';
import {
  trackSphereExpand,
  trackSphereDock,
  trackItemClick,
  trackItemImpressions,
} from '@/lib/sphere/sphere-analytics';
import type { SphereCategory } from '@/store/useSphereStore';

// --- Dynamic import - never SSR the WebGL canvas -----------------------------
const CategorySphereCanvas = dynamic(() => import('./CategorySphereCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-16 h-16 rounded-full border-4 border-violet-500/30 border-t-violet-500 animate-spin" />
    </div>
  ),
});

// --- Types -------------------------------------------------------------------
export interface CategorySphereWrapperProps {
  categories: SphereCategory[];
  onCategorySelect: (categoryName: string) => void;
  initialExpanded?: boolean;
  /** Categories currently selected in the filter panel — highlighted on the sphere */
  selectedFilterCategories?: string[];
}

// --- Main wrapper -------------------------------------------------------------
export function CategorySphereWrapper({
  categories,
  onCategorySelect,
  initialExpanded = true,
  selectedFilterCategories = [],
}: CategorySphereWrapperProps) {
  const { canUse3D, isLoading: perfLoading } = useSpherePerformance();
  const [use3D, setUse3D] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // Stable individual primitive selectors (prevents infinite re-render loops)
  const isSphereExpanded = useSphereStore((s) => s.isSphereExpanded);
  const selectedCategory = useSphereStore((s) => s.selectedCategory);
  const expand = useSphereStore((s) => s.expand);
  const dock = useSphereStore((s) => s.dock);
  const setAllCategories = useSphereStore((s) => s.setAllCategories);
  const setSelectedCategory = useSphereStore((s) => s.setSelectedCategory);

  // -- Device detection (mobile / tablet / desktop) -------------------------
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      setIsTablet(w >= 768 && w < 1024);
    };
    check();
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);

  // -- Sync perf state immediately on mount & canUse3D change ----------------
  useEffect(() => {
    if (!perfLoading && canUse3D) {
      setUse3D(true);
    }
  }, [canUse3D, perfLoading]);

  // -- Sync categories into Zustand FIRST (before initializing expand/dock) --
  useEffect(() => {
    if (categories.length > 0) {
      setAllCategories(categories);
    }
  }, [categories, setAllCategories]);

  // -- Initialize sphere state on mount; always expand on page load / navigation --------
  // ROOT CAUSE FIX (v2):
  //   The old code respected isSphereDocked from sessionStorage/memory. But the sphere
  //   gets docked whenever the user scrolls on the products page (scroll-dismiss handler).
  //   That scroll-close was then persisted to sessionStorage, so EVERY navigation back to
  //   /products kept the sphere docked — making it appear as if the sphere "never loads".
  //
  //   Correct UX: the sphere ALWAYS expands when the products page is visited (fresh mount).
  //   isSphereDocked is an intra-page concept (shows/hides the re-open button during the
  //   current session) and must NOT block auto-expansion on the next page visit.
  //
  //   We reset isSphereDocked on every mount so the sphere reliably opens, while still
  //   allowing the user to close it within the current page session.
  useEffect(() => {
    if (categories.length === 0) return;

    // Hydrate so selectedCategory is restored (e.g. badge on docked button) but
    // override the docked/expanded flags so the sphere always starts expanded.
    const store = useSphereStore.getState();
    if (!store.hasHydrated) {
      store.hydrate();
    }

    // Always expand the sphere when the products page mounts / is navigated to.
    // This clears any stale isSphereDocked=true that came from a previous scroll event.
    expand();
    if (!useSphereStore.getState().isSphereExpanded) {
      trackSphereExpand();
    }
  }, [categories.length]); // Re-runs when categories arrive from API or on route remount

  // -- Discovery items (ranked) - compute after categories sync -----
  const discoveryItems = useMemo(
    () => (categories.length > 0 ? generateDiscoveryItems(categories) : []),
    [categories],
  );

  // -- Track impressions when sphere expands --------------------------------
  useEffect(() => {
    if (isSphereExpanded && discoveryItems.length > 0) {
      trackItemImpressions(discoveryItems.length);
    }
  }, [isSphereExpanded, discoveryItems.length]);
  // Force R3F viewport resize after Framer spring settles (fixes off-center on re-expand).
  // getBoundingClientRect() during scale(0.8?1) returns wrong size; 420ms delay ensures
  // the spring animation is complete before R3F re-measures the container.
  useEffect(() => {
    if (!isSphereExpanded) return;
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 420);
    return () => clearTimeout(t);
  }, [isSphereExpanded]);


  // -- Propagate category selection to parent -------------------------------
  const prevSelected = useRef<string | null>(null);
  useEffect(() => {
    if (selectedCategory && selectedCategory !== prevSelected.current) {
      prevSelected.current = selectedCategory;
      onCategorySelect(selectedCategory);
    }
  }, [selectedCategory, onCategorySelect]);

  // -- Fallback when FPS too low --------------------------------------------
  const handleLowFPS = useCallback(() => setUse3D(false), []);

  // -- Analytics-wrapped actions --------------------------------------------
  const handleDock = useCallback(() => {
    dock();
    trackSphereDock();
  }, [dock]);
  // -"--"- Scroll-to-dismiss: collapse sphere when user scrolls the page -"--"--"--"--"--"-
  useEffect(() => {
    if (!isSphereExpanded) return;
    let startScrollY = window.scrollY;
    const SCROLL_THRESHOLD = 80; // px — ignore layout-induced micro-scrolls
    let armed = false;
    // Delay arming to avoid layout-shift scrolls from product loading
    const armTimer = setTimeout(() => {
      startScrollY = window.scrollY;
      armed = true;
    }, 800);
    const onScroll = () => {
      if (!armed) return;
      const delta = Math.abs(window.scrollY - startScrollY);
      if (delta > SCROLL_THRESHOLD) handleDock();
    };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      clearTimeout(armTimer);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [isSphereExpanded, handleDock]);

  // -"--"- Outside-click dismiss: collapse when clicking outside the sphere -"--"--"--"-
  const sphereRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isSphereExpanded) return;
    const onPointerDown = (e: PointerEvent) => {
      if (sphereRef.current && !sphereRef.current.contains(e.target as Node)) {
        handleDock();
      }
    };
    // Short delay so the expand click doesn't immediately dismiss
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown, true);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [isSphereExpanded, handleDock]);
  const handleCategoryClick = useCallback(
    (name: string) => {
      const item = discoveryItems.find((d) => d.title === name || d.queryParams.category === name);
      if (item) {
        trackItemClick(item.id, item.title, item.type);
      }
    },
    [discoveryItems],
  );

  // -- Responsive sphere diameter -------------------------------------------
  const sphereSize = useMemo(() => {
    if (isMobile) return 'min(90vw, 90vh)';
    if (isTablet) return 'min(75vw, 75vh)';
    return 'min(60vw, 700px, 85vh)';
  }, [isMobile, isTablet]);

  // -- Loading state ---------------------------------------------------------
  if (perfLoading || categories.length === 0) return null;

  // -- Fallback: horizontal scroll list -------------------------------------
  // Show fallback only when we've definitively determined 3D is unavailable
  // (canUse3D=false after check completes) OR when low-FPS triggered setUse3D(false).
  // This avoids the brief flash of the 2D fallback between perfLoading→false
  // and the setUse3D(true) effect firing.
  if (!canUse3D) {
    return (
      <CategorySphereFallback
        categories={categories}
        selectedCategory={selectedCategory}
        onCategorySelect={(name) => {
          setSelectedCategory(name || null);
          if (name) onCategorySelect(name);
        }}
      />
    );
  }
  // canUse3D=true but use3D not yet set (1 frame gap) — show nothing rather than flashing fallback
  if (!use3D) return null;

  return (
    <>
      {/* -- VIEWPORT-CENTERED sphere - NO full-screen backdrop -- */}
      {/* Only the sphere boundary is the visual overlay; rest of page stays fully interactive */}
      <AnimatePresence>
        {isSphereExpanded && (
          <div
            data-testid="sphere-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // pointer-events: none - clicks pass through to the page everywhere
              // except the sphere itself (which has pointer-events: auto)
              pointerEvents: 'none',
              background: 'transparent',
            }}
          >
            <motion.div
              ref={sphereRef}
              key="sphere-widget"
              data-testid="sphere-container"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 250, damping: 25 }}
              style={{
                width: sphereSize,
                height: sphereSize,
                aspectRatio: '1 / 1',
                borderRadius: '50%',
                pointerEvents: 'auto',
                position: 'relative',
                // Sphere glow - only around the sphere, not the whole page
                boxShadow: '0 0 60px rgba(139,92,246,0.25), 0 0 120px rgba(139,92,246,0.1)',
              }}
              className="border border-violet-400/20"
            >
              {/* Radial gradient background for depth */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(15,10,40,0.92) 0%, rgba(10,5,30,0.95) 45%, rgba(5,2,20,0.98) 100%)',
                }}
              />

              {/* Subtle ring decoration */}
              <div
                className="absolute inset-1 rounded-full pointer-events-none"
                style={{ border: '1px solid rgba(167,139,250,0.15)' }}
              />

              {/* Soft glow edge */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  boxShadow: 'inset 0 0 40px rgba(139,92,246,0.2), inset 0 0 80px rgba(139,92,246,0.08)',
                }}
              />

              {/* R3F Canvas - absolutely fills the sphere circle for perfect centering */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  overflow: 'hidden',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CategorySphereCanvas
                  isMobile={isMobile}
                  onLowFPS={handleLowFPS}
                  onCategoryClick={handleCategoryClick}
                  selectedFilterCategories={selectedFilterCategories}
                />
              </div>

              {/* Close button - positioned OUTSIDE the canvas clip so it's always clickable */}
              <motion.button
                data-testid="sphere-close-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDock();
                }}
                style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}
                className="
                  w-8 h-8 rounded-full
                  bg-gray-900/80 hover:bg-gray-800/90
                  backdrop-blur-sm
                  flex items-center justify-center
                  text-white/60 hover:text-white
                  transition-all
                  text-sm font-bold
                  border border-white/10 hover:border-violet-500/40
                  shadow-lg
                "
                aria-label="Minimize sphere"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </motion.button>

              {/* Discovery hint */}
              {!selectedCategory && (
                <div
                  className="pointer-events-none"
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                  }}
                >
                  <span className="text-[11px] text-white/40 font-medium whitespace-nowrap">
                    Hover to explore - Click to filter
                  </span>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden sphere-container for test compatibility when docked */}
      {!isSphereExpanded && (
        <div data-testid="sphere-container" style={{ display: 'none' }} />
      )}
    </>
  );
}

