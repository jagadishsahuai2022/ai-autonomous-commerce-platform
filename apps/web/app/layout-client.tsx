'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ShoppingCart, LogOut, Wallet, Brain, ScanSearch, SlidersHorizontal, X, Search, Camera, Mic, MicOff, Package, Heart, Settings, ChevronDown, User, Menu, Crown, BarChart3, CheckCircle, Activity, UserCog, Scale } from 'lucide-react';
import { Logo, FooterLogo } from '@/components/ui/Logo';
import { QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { queryClient } from '@/lib/queries/queryClient';
import { ThemeProvider } from '@/lib/contexts/ThemeContext';
import { FeatureFlagsProvider } from '@/lib/contexts/FeatureFlagsContext';
import { ToastProvider, ToastContainer } from '@/lib/contexts/ToastContext';
import { ErrorBoundary, AsyncErrorHandler } from '@/components/error/ErrorBoundary';
import { getCurrentUserRole, DEMO_USERS, getEffectiveDemoUser, type AppRole } from '@/lib/admin-auth';
import { clearUserSession } from '@/lib/session';
import { captureUserActivity } from '@/lib/wallet-transactions';
import './globals.css';

// ── Navigation Activity Tracker ─────────────────────────────────────────
function NavigationTracker() {
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      try { captureUserActivity(pathname, 'navigation'); } catch { /* silent */ }
    }
  }, [pathname]);
  return null;
}

// ── Dynamic Island Search Component ─────────────────────────────────────────
function NavSearchIsland() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    setVoiceSupported(!!(
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    ));
  }, []);

  // Sync query from URL when navigating to /products
  useEffect(() => {
    if (pathname === '/products') {
      try {
        const params = new URLSearchParams(window.location.search);
        setQuery(params.get('q') || '');
      } catch { }
    }
  }, [pathname]);

  const startCollapseTimer = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => {
      setIsExpanded(false);
    }, 5000);
  };

  const handleExpand = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setIsExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const handleClose = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setIsExpanded(false);
    setIsListening(false);
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { } }
  };

  const handleBlur = () => { startCollapseTimer(); };
  const handleFocus = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
  };

  const dispatchSearch = useCallback((q: string) => {
    if (pathname === '/products') {
      window.dispatchEvent(new CustomEvent('globalSearch', { detail: { query: q } }));
      try {
        const url = new URL(window.location.href);
        if (q.trim()) url.searchParams.set('q', q);
        else url.searchParams.delete('q');
        window.history.replaceState(null, '', url.pathname + url.search);
      } catch { }
    }
  }, [pathname]);

  const handleQueryChange = (q: string) => {
    setQuery(q);
    dispatchSearch(q);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (pathname === '/products') {
      dispatchSearch(q);
    } else if (q) {
      router.push(`/products?q=${encodeURIComponent(q)}`);
    }
    startCollapseTimer();
  };

  const handleClear = () => {
    setQuery('');
    dispatchSearch('');
    inputRef.current?.focus();
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
  };

  const handleFilterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pathname === '/products') {
      window.dispatchEvent(new CustomEvent('toggleFilters'));
    } else {
      router.push('/products?filters=open');
    }
  };

  // ── Voice Search ──────────────────────────────────────────────────────────
  const handleVoiceSearch = useCallback(() => {
    if (!voiceSupported) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening) {
      try { recognitionRef.current?.stop(); } catch { }
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      dispatchSearch(transcript);
      if (pathname !== '/products') {
        router.push(`/products?q=${encodeURIComponent(transcript)}`);
      }
    };

    try { recognition.start(); } catch { }
  }, [voiceSupported, isListening, dispatchSearch, pathname, router]);

  // ── Image Search ──────────────────────────────────────────────────────────
  const handleImageSearch = () => {
    fileInputRef.current?.click();
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/search/image', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const q = data.query || data.category || '';
        if (q) {
          setQuery(q);
          if (pathname === '/products') {
            dispatchSearch(q);
          } else {
            router.push(`/products?q=${encodeURIComponent(q)}`);
          }
        }
      }
    } catch { }
  };

  if (!mounted) return <div className="w-48 h-9 rounded-full bg-gray-200 animate-pulse" />;

  return (
    <div className="relative flex items-center">
      {/* Hidden image file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageFile}
        className="sr-only"
        aria-hidden="true"
      />

      {/* ── Collapsed island pill — always mounted, shown/hidden via opacity ── */}
      <div className="relative w-48 h-9 flex-shrink-0">
        <div
          onClick={handleExpand}
          className={`absolute inset-0 flex items-center gap-2 px-3 rounded-full bg-gray-900 dark:bg-gray-800 border border-gray-800 dark:border-gray-700 cursor-pointer group hover:border-violet-700/60 shadow-lg transition-all duration-300 ease-out origin-center
            ${isExpanded ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100 pointer-events-auto'}`}
          role="button"
          aria-label="Open search"
          aria-hidden={isExpanded}
        >
          <div className="w-5 h-5 rounded-full bg-violet-600/25 border border-violet-500/50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600/50 transition-colors">
            <ScanSearch className="w-2.5 h-2.5 text-violet-300" />
          </div>
          <span className="text-xs text-gray-500 group-hover:text-gray-300 flex-1 truncate transition-colors">
            {query || 'Search products...'}
          </span>
          <button
            onClick={handleFilterClick}
            className="flex-shrink-0 p-0.5 hover:text-violet-400 text-gray-600 transition-colors"
            aria-label="Toggle filters"
            tabIndex={isExpanded ? -1 : 0}
          >
            <SlidersHorizontal className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── Expanded island overlay — always mounted, shown/hidden via opacity ── */}
      <div
        className={`fixed inset-x-0 top-0 z-[9999] flex items-center pointer-events-none transition-all duration-500 ease-in-out
          ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
        style={{ height: '61px' }}
        aria-label="Expanded search"
        aria-hidden={!isExpanded}
      >
        {/* Mirror nav max-width + padding exactly so spacers align with logo/CTA */}
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-full gap-2">
          {/* Left spacer: DC icon only on mobile, full brand on sm+ */}
          <div className="flex-shrink-0 w-[52px] sm:w-[168px]" aria-hidden="true" />
          {/* Search form fills the center — pointer-events-auto only when expanded */}
          <form
            onSubmit={handleSubmit}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            className={`flex-1 min-w-0 flex items-center gap-2 h-10 px-3 rounded-2xl bg-white dark:bg-gray-900 border-2 border-violet-400/70 dark:border-violet-600/70 shadow-2xl shadow-violet-500/25 ring-4 ring-violet-500/15 transition-all duration-500 ease-in-out
                ${isExpanded ? 'pointer-events-auto opacity-100 scale-100 translate-y-0' : 'pointer-events-none opacity-0 scale-95 -translate-y-1'}`}
          >
            {/* Lens icon */}
            <div className="w-6 h-6 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
              <ScanSearch className="w-3 h-3 text-violet-500" />
            </div>

            {/* Search input */}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onBlur={handleBlur}
              onFocus={handleFocus}
              placeholder="Search products, brands, categories..."
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none min-w-0"
              autoComplete="off"
            />

            {/* Clear button */}
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Divider — hidden below md to save space for input */}
            <div className="hidden md:block h-5 w-px bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

            {/* Camera / Image search — hidden below md to save input width on sm */}
            <button
              type="button"
              onClick={handleImageSearch}
              className="hidden md:flex flex-shrink-0 p-1.5 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              title="Search by image"
              aria-label="Search by image"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>

            {/* Mic / Voice search */}
            <button
              type="button"
              onClick={handleVoiceSearch}
              className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${isListening
                ? 'text-red-500 bg-red-50 dark:bg-red-900/20 animate-pulse'
                : 'text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20'
                }`}
              title={isListening ? 'Listening… click to stop' : 'Search by voice'}
              aria-label={isListening ? 'Stop voice search' : 'Start voice search'}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>

            {/* Filter toggle — hidden below lg to prioritise input width on tablet */}
            <button
              type="button"
              onClick={handleFilterClick}
              className="hidden lg:flex flex-shrink-0 p-1.5 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors border border-transparent hover:border-violet-200 dark:hover:border-violet-700"
              aria-label="Toggle filters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* Submit / Go */}
            <button
              type="submit"
              className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors shadow-sm"
            >
              {pathname === '/products' ? 'Filter' : 'Go'}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={handleClose}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
          {/* Right spacer: cart only on mobile, CTA section on sm+, full CTA on lg+ */}
          <div className="flex-shrink-0 w-[52px] sm:w-[188px] lg:w-[210px]" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function NavbarCTA() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [resolvedDisplayName, setResolvedDisplayName] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const refreshAuth = () => {
    setAuthToken(localStorage.getItem('authToken'));
    setUserEmail(localStorage.getItem('userEmail'));
    setResolvedDisplayName(null);
  };

  const refreshCart = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      setCartCount(cart.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0));
    } catch {
      setCartCount(0);
    }
  };

  useEffect(() => {
    setMounted(true);
    refreshAuth();
    refreshCart();
    window.addEventListener('storage', refreshAuth);
    window.addEventListener('authUpdated', refreshAuth);
    window.addEventListener('cartUpdated', refreshCart);
    return () => {
      window.removeEventListener('storage', refreshAuth);
      window.removeEventListener('authUpdated', refreshAuth);
      window.removeEventListener('cartUpdated', refreshCart);
    };
  }, []);

  useEffect(() => {
    if (!authToken || !userEmail) {
      setResolvedDisplayName(null);
      return;
    }

    let cancelled = false;

    const resolveDisplayName = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'X-User-Email': userEmail,
          },
          cache: 'no-store',
        });

        if (!res.ok) return;
        const body = await res.json();
        const nextName = body.displayName || body.name || null;
        if (!cancelled && nextName) {
          setResolvedDisplayName(nextName);
        }
      } catch {
        /* keep fallback display name */
      }
    };

    resolveDisplayName();

    return () => {
      cancelled = true;
    };
  }, [authToken, userEmail]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    setMenuOpen(false);
    clearUserSession();
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    setAuthToken(null);
    setUserEmail(null);
    setResolvedDisplayName(null);
    router.push('/');
  };

  /** Impersonate another user (admin-only). Saves admin session for resume. */
  const handleImpersonate = async (targetEmail: string) => {
    // Persist admin credentials for later resume
    localStorage.setItem('dc-admin-original-email', userEmail || '');
    localStorage.setItem('dc-admin-original-token', authToken || '');
    localStorage.setItem('dc-admin-original-role', localStorage.getItem('dc-user-role') || 'admin');
    localStorage.setItem('dc-admin-original-subscription', localStorage.getItem('dc-user-subscription') || 'AI_PLUS');

    // Create session for target user via passwordless login
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('authToken', data.token);
      }
    } catch { /* fallback to demo token */ }

    const targetUser = getEffectiveDemoUser(targetEmail) || DEMO_USERS.find(u => u.email === targetEmail);
    localStorage.setItem('userEmail', targetEmail);
    localStorage.setItem('dc-user-role', targetUser?.role || 'basic');
    localStorage.setItem('dc-user-subscription', targetUser?.subscription || 'BASIC');
    localStorage.setItem('dc-impersonating', 'true');
    window.dispatchEvent(new Event('authUpdated'));
    setMenuOpen(false);
    setImpersonateOpen(false);
    router.push('/dashboard');
  };

  /** Resume admin session from impersonation */
  const handleResumeAdmin = async () => {
    const origEmail = localStorage.getItem('dc-admin-original-email') || 'admin@delegatecart.com';
    const origRole = localStorage.getItem('dc-admin-original-role') || 'admin';
    const origSub = localStorage.getItem('dc-admin-original-subscription') || 'AI_PLUS';

    // Create fresh session for admin
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: origEmail }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('authToken', data.token);
      }
    } catch { /* fallback */ }

    localStorage.setItem('userEmail', origEmail);
    localStorage.setItem('dc-user-role', origRole);
    localStorage.setItem('dc-user-subscription', origSub);
    localStorage.removeItem('dc-impersonating');
    localStorage.removeItem('dc-admin-original-email');
    localStorage.removeItem('dc-admin-original-token');
    localStorage.removeItem('dc-admin-original-role');
    localStorage.removeItem('dc-admin-original-subscription');
    window.dispatchEvent(new Event('authUpdated'));
    setMenuOpen(false);
    router.push('/admin/dashboard');
  };

  const isImpersonating = typeof window !== 'undefined' && localStorage.getItem('dc-impersonating') === 'true';

  if (!mounted) return <div className="flex items-center gap-3 h-10 w-52" />;

  if (authToken) {
    // Prefer live profile/auth identity, then demo metadata, then email prefix.
    const demoUser = userEmail ? DEMO_USERS.find(u => u.email.toLowerCase() === (userEmail || '').toLowerCase()) : null;
    const displayName = resolvedDisplayName || demoUser?.displayName || userEmail?.split('@')[0] || 'Account';
    const initials = displayName.slice(0, 2).toUpperCase();
    const isOAuth = authToken.startsWith('oauth-');
    const provider = authToken.startsWith('oauth-google') ? 'G' : authToken.startsWith('oauth-microsoft') ? 'M' : null;

    const menuItems = [
      { icon: User, label: 'My Profile', href: '/profile', color: 'text-violet-500' },
      { icon: Settings, label: 'My Account', href: '/account', color: 'text-blue-500' },
      { icon: Package, label: 'My Orders', href: '/orders', color: 'text-orange-500' },
      { icon: Heart, label: 'Wishlist', href: '/wishlist', color: 'text-pink-500' },
      { icon: Wallet, label: 'Wallet', href: '/wallet', color: 'text-cyan-500' },
    ];

    // Add role-based dashboard links — strict RBAC enforcement
    const role = getCurrentUserRole();
    // User Management — admin only (no email-substring heuristic)
    if (role === 'admin') {
      menuItems.splice(2, 0, { icon: UserCog, label: 'User Management', href: '/admin/dashboard', color: 'text-red-500' });
    }
    // AI Preferences — not available to basic / customer roles
    if (['admin', 'analytics', 'observability', 'reinforced-learning', 'aiplus'].includes(role)) {
      menuItems.push({ icon: Brain, label: 'AI Preferences', href: '/ai-preferences', color: 'text-indigo-500' });
    }
    // Observability Dashboard — admin, analytics, observability
    if (['admin', 'analytics', 'observability'].includes(role)) {
      menuItems.push({ icon: Activity, label: 'Observability Dashboard', href: '/observability', color: 'text-indigo-500' });
    }
    // Self-Learning Dashboard — admin, analytics, reinforced-learning
    if (['admin', 'analytics', 'reinforced-learning'].includes(role)) {
      menuItems.push({ icon: Brain, label: 'Self-Learning Dashboard', href: '/admin/learning', color: 'text-purple-500' });
    }
    // Scoring Dimensions — admin only
    if (role === 'admin') {
      menuItems.push({ icon: Scale, label: 'Scoring Dimensions', href: '/admin/scoring-dimensions', color: 'text-violet-500' });
    }
    // Metrics Validation — admin, analytics (full view) + basic, aiplus (self-only limited view)
    if (['admin', 'analytics', 'basic', 'aiplus'].includes(role)) {
      menuItems.push({ icon: CheckCircle, label: 'Metrics Validation', href: '/shopping-assistant/metrics/validation', color: 'text-amber-500' });
    }

    return (
      <div className="flex items-center gap-2">
        {/* Cart */}
        <Link href="/cart" aria-label="Cart" className="relative p-2 text-slate-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          <ShoppingCart className="w-5 h-5" />
          <span className="sr-only">Cart</span>
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </Link>

        {/* User dropdown trigger */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all group border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            {/* Avatar */}
            <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-violet-300/40 ring-2 ring-white dark:ring-gray-900">
              {initials}
              {provider && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center text-[8px] font-bold border border-gray-200 shadow-sm">
                  {provider}
                </span>
              )}
            </div>
            {/* Name & email */}
            <div className="hidden sm:block text-left min-w-0">
              <p className="text-xs font-semibold text-slate-800 dark:text-white leading-none truncate max-w-[72px]">{displayName}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-none mt-0.5 truncate max-w-[72px]">{userEmail}</p>
            </div>
            <ChevronDown className={`w-3 h-3 text-slate-400 flex-shrink-0 self-center transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Panel */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-700 shadow-2xl shadow-slate-300/40 dark:shadow-gray-900/60 z-[9998] overflow-hidden max-h-[calc(100vh-80px)] flex flex-col">
              {/* User header */}
              <div className="flex-shrink-0 px-4 py-2.5 bg-gradient-to-r from-violet-50 to-cyan-50 dark:from-violet-900/20 dark:to-cyan-900/20 border-b border-slate-100 dark:border-gray-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold shadow-md flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{displayName}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{userEmail}</p>
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 text-[9px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>
              </div>

              {/* Menu items - scrollable */}
              <div className="py-1 overflow-y-auto flex-1 overscroll-contain">
                {menuItems.map(({ icon: Icon, label, href, color }) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-gray-800/60 transition-colors group"
                  >
                    <div className={`w-6 h-6 rounded-lg bg-slate-100 dark:bg-gray-800 flex items-center justify-center group-hover:scale-110 transition-transform ${color} flex-shrink-0`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="text-[13px] text-slate-700 dark:text-slate-300 font-medium truncate">{label}</span>
                  </Link>
                ))}
              </div>

              {/* Impersonation: Resume Admin (shown when impersonating) */}
              {isImpersonating && (
                <div className="flex-shrink-0 border-t border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 py-1">
                  <button
                    onClick={handleResumeAdmin}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:scale-110 transition-transform text-amber-600 flex-shrink-0">
                      <Crown className="w-3 h-3" />
                    </div>
                    <div className="text-left">
                      <span className="text-[13px] text-amber-700 dark:text-amber-300 font-semibold">Resume Admin</span>
                      <p className="text-[10px] text-amber-500">Exit impersonation</p>
                    </div>
                  </button>
                </div>
              )}

              {/* Admin Impersonation: Login As... (shown only for admin, not while impersonating) */}
              {role === 'admin' && !isImpersonating && (
                <div className="flex-shrink-0 border-t border-slate-100 dark:border-gray-800 py-1">
                  <button
                    onClick={() => setImpersonateOpen(o => !o)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-gray-800/60 transition-colors group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-gray-800 flex items-center justify-center group-hover:scale-110 transition-transform text-teal-500 flex-shrink-0">
                      <UserCog className="w-3 h-3" />
                    </div>
                    <span className="text-[13px] text-slate-700 dark:text-slate-300 font-medium">Impersonate User</span>
                    <ChevronDown className={`w-3 h-3 text-slate-400 ml-auto transition-transform ${impersonateOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {impersonateOpen && (
                    <div className="px-2 pb-1">
                      {DEMO_USERS.filter(u => u.email !== userEmail && u.role !== 'admin').map(u => (
                        <button
                          key={u.email}
                          onClick={() => handleImpersonate(u.email)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                        >
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-[8px] font-bold">
                            {u.displayName.charAt(0)}
                          </span>
                          <span className="text-slate-600 dark:text-slate-400 truncate">{u.displayName}</span>
                          <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500 capitalize">{u.role}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Divider + logout */}
              <div className="flex-shrink-0 border-t border-slate-100 dark:border-gray-800 py-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group"
                >
                  <div className="w-6 h-6 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center group-hover:scale-110 transition-transform text-red-500 flex-shrink-0">
                    <LogOut className="w-3 h-3" />
                  </div>
                  <span className="text-[13px] text-red-500 font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/cart" aria-label="Cart" className="relative p-2 text-slate-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        <ShoppingCart className="w-5 h-5" />
        <span className="sr-only">Cart</span>
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {cartCount > 99 ? '99+' : cartCount}
          </span>
        )}
      </Link>
      <Link href="/signin" className="px-4 py-2 text-slate-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium text-sm transition-colors">Sign In</Link>
      <Link href="/signin" className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium text-sm hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all">Get Started</Link>
    </div>
  );
}

// ── Site Header: Logo + Island + Mobile hamburger + Desktop nav ──────────────
function SiteHeader() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home', icon: null, special: false },
    { href: '/products', label: 'Products', icon: null, special: false },
    { href: '/shopping-assistant', label: 'Smart Assistant', icon: null, special: false },
    { href: '/shopping-list', label: 'Shopping List', icon: null, special: false },
    { href: '/ai-plus', label: 'AI+', icon: Brain, special: true },
    { href: '/about', label: 'About', icon: null, special: false },
  ];

  useEffect(() => { setMounted(true); }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700 shadow-sm">
      <nav className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center gap-3">
          {/* Logo & Branding + Mobile hamburger */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <Logo size={36} />
            </Link>
            {/* Mobile hamburger — only visible below md */}
            <button
              className="md:hidden ml-0.5 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors flex-shrink-0"
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
            >
              <div className={`transition-transform duration-200 ${mobileMenuOpen ? 'rotate-90' : 'rotate-0'}`}>
                {mounted && (mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />)}
              </div>
            </button>
          </div>

          {/* ── Dynamic Island Search ── */}
          <NavSearchIsland />

          {/* Elastic spacer */}
          <div className="flex-1" />

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(({ href, label, icon: Icon, special }) => (
              <Link
                key={href}
                href={href}
                className={`font-medium text-sm transition-colors flex items-center gap-1 ${special
                  ? 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold'
                  : pathname === href
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
              >
                {mounted && Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
              </Link>
            ))}
          </div>

          {/* Auth-aware CTA */}
          <NavbarCTA />
        </div>
      </nav>

      {/* Mobile slide-down navigation panel */}
      <div
        id="mobile-nav"
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="border-t border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-2">
          <div className="max-w-[1400px] mx-auto px-4 space-y-0.5">
            {navLinks.map(({ href, label, icon: Icon, special }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${pathname === href
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-800'
                  }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${special ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'bg-slate-100 dark:bg-gray-800'
                  }`}>
                  {mounted && Icon
                    ? <Icon className={`w-3.5 h-3.5 ${special ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`} />
                    : <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                  }
                </div>
                <span className={`text-sm font-medium ${special ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>{label}</span>
                {pathname === href && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

export function LayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary level="page">
      <SessionProvider>
        <AsyncErrorHandler>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <FeatureFlagsProvider>
                <ToastProvider>
                  <NavigationTracker />
                  {/* Navigation Header */}
                  <SiteHeader />

                  {/* Main Content */}
                  <main className="min-h-[calc(100vh-100px)]">
                    {children}
                  </main>

                  {/* Footer — dark futuristic */}
                  <footer className="relative bg-gray-950 border-t border-white/[0.06] text-gray-400 overflow-hidden">
                    {/* Ambient glow orbs */}
                    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                      <div className="absolute -top-40 -left-40 w-[480px] h-[480px] bg-violet-600/10 rounded-full blur-3xl" />
                      <div className="absolute -bottom-40 -right-40 w-[480px] h-[480px] bg-cyan-500/8 rounded-full blur-3xl" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-indigo-600/5 rounded-full blur-3xl" />
                    </div>

                    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
                      {/* Main grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">

                        {/* Brand column — wider */}
                        <div className="lg:col-span-2">
                          <FooterLogo className="mb-4" />
                          <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
                            Next-generation AI-powered shopping platform with intelligent decision engines and personalised experiences.
                          </p>
                          {/* Social icons */}
                          <div className="flex items-center gap-3 mt-5">
                            {[
                              { icon: 'X', label: 'Twitter / X' },
                              { icon: 'in', label: 'LinkedIn' },
                              { icon: 'gh', label: 'GitHub' },
                            ].map(({ icon, label }) => (
                              <button key={label} aria-label={label}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 hover:border-violet-500/50 text-gray-500 hover:text-white transition-all duration-200 flex items-center justify-center text-[10px] font-bold">
                                {icon}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Product links */}
                        <div>
                          <h4 className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-4">Product</h4>
                          <ul className="space-y-2.5 text-sm">
                            {[['Features', '/features'], ['Pricing', '/pricing'], ['Security', '/security'], ['Changelog', '/changelog']].map(([label, href]) => (
                              <li key={label}>
                                <Link href={href} className="text-gray-500 hover:text-violet-400 transition-colors duration-150">{label}</Link>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Company links */}
                        <div>
                          <h4 className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-4">Company</h4>
                          <ul className="space-y-2.5 text-sm">
                            {[['About', '/about'], ['Blog', '/blog'], ['Careers', '/careers'], ['Press', '/press']].map(([label, href]) => (
                              <li key={label}>
                                <Link href={href} className="text-gray-500 hover:text-violet-400 transition-colors duration-150">{label}</Link>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Legal links */}
                        <div>
                          <h4 className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-4">Legal</h4>
                          <ul className="space-y-2.5 text-sm">
                            {[['Privacy', '/privacy'], ['Terms', '/terms'], ['Cookies', '/cookies'], ['Contact', '/contact']].map(([label, href]) => (
                              <li key={label}>
                                <Link href={href} className="text-gray-500 hover:text-violet-400 transition-colors duration-150">{label}</Link>
                              </li>
                            ))}
                          </ul>
                        </div>

                      </div>

                      {/* Bottom bar */}
                      <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-xs text-gray-600">&copy; 2026 DelegateCart, Inc. All rights reserved.</p>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-xs text-gray-600">All systems operational</span>
                        </div>
                        <p className="text-xs text-gray-700">Built with AI &bull; delegatecart.com</p>
                      </div>
                    </div>
                  </footer>

                  {/* Toast Notifications Container */}
                  <ToastContainer />
                </ToastProvider>
              </FeatureFlagsProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </AsyncErrorHandler>
      </SessionProvider>
    </ErrorBoundary>
  );
}
