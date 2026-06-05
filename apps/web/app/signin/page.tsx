'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DEMO_USERS, authenticateAdmin, getUserRole, isUserActive } from '@/lib/admin-auth';
import type { AppRole } from '@/lib/admin-auth';
import { clearUserSession } from '@/lib/session';

const ALL_DEMO_PASSWORD = 'Admin@DC2024!';

// Only basic and AI Plus demo users are shown publicly
const PUBLIC_DEMO_USERS = [
  { email: 'basicdemo@delegatecart.com', displayName: 'Basic Demo', role: 'basic', subscription: 'BASIC' },
  { email: 'aiplusdemo@delegatecart.com', displayName: 'AI Plus Demo', role: 'aiplus', subscription: 'AI_PLUS' },
];

function normalizeApiRole(raw: unknown): AppRole | null {
  if (typeof raw !== 'string') return null;
  const lower = raw.toLowerCase().trim();
  if (lower === 'analytic') return 'analytics';
  if (lower === 'ai-plus' || lower === 'ai_plus') return 'aiplus';
  if (lower === 'selflearning' || lower === 'self-learning' || lower === 'learning') return 'reinforced-learning';
  if (['admin', 'analytics', 'aiplus', 'observability', 'reinforced-learning', 'basic', 'customer'].includes(lower)) {
    return lower as AppRole;
  }
  return null;
}

function normalizeApiSubscription(raw: unknown): 'BASIC' | 'AI_PLUS' | null {
  if (typeof raw !== 'string') return null;
  const upper = raw.toUpperCase().trim();
  if (upper === 'AI_PLUS' || upper === 'AI+' || upper === 'AIPLUS') return 'AI_PLUS';
  if (upper === 'BASIC') return 'BASIC';
  return null;
}

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoHint, setShowDemoHint] = useState(true);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }

    if (!isUserActive(email)) {
      setErrors({ submit: 'This user is inactive. Contact admin.' });
      return;
    }

    if (password.length < 6) {
      setErrors({ password: 'Password must be at least 6 characters' });
      return;
    }

    setIsLoading(true);
    try {
      // Try real DB auth first
      let token: string | null = null;
      let userId: number | null = null;
      // Role/subscription come from API response (backed by persisted DB user data).
      let apiDcRole: AppRole | null = null;
      let apiSubscription: 'BASIC' | 'AI_PLUS' | null = null;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (res.ok) {
          const data = await res.json();
          token = data.token;
          userId = data.user?.id ?? null;
          apiDcRole = normalizeApiRole(data.user?.dcRole ?? data.user?.role);
          apiSubscription = normalizeApiSubscription(data.user?.subscription ?? data.user?.subscriptionPlan);
          if (data.user?.whatsappNumber) {
            localStorage.setItem('whatsappNumber', data.user.whatsappNumber);
          }
          if (data.user?.notificationEmail) {
            localStorage.setItem('notificationEmail', data.user.notificationEmail);
          }
        } else if (res.status === 401) {
          // Wrong credentials from DB — for known demo users, fall through to demo auth
          const isDemoUser = DEMO_USERS.some(u => u.email === email.toLowerCase());
          if (!isDemoUser) {
            const data = await res.json().catch(() => ({}));
            setErrors({ submit: data.error || 'Invalid email or password.' });
            return;
          }
          // Demo user with mismatched DB passwordHash — retry without password to get real DB session
          try {
            const retryRes = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }), // No password → skips hash check, creates real DB session
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              token = retryData.token;
              userId = retryData.user?.id ?? null;
              apiDcRole = normalizeApiRole(retryData.user?.dcRole ?? retryData.user?.role);
              apiSubscription = normalizeApiSubscription(retryData.user?.subscription ?? retryData.user?.subscriptionPlan);
            }
          } catch { /* fall through to authenticateAdmin */ }
        }
      } catch (networkErr) {
        console.warn('[signin] DB login failed, using fallback:', networkErr);
      }

      // If DB returned a token use it, otherwise fall back to RBAC demo user auth
      if (!token) {
        // Try authenticateAdmin which handles all DEMO_USERS
        const authed = authenticateAdmin(email, password);
        if (authed) {
          const normalized = email.toLowerCase();
          const scopedUserId = `user-${normalized.replace(/[^a-z0-9]/g, '-')}`;
          // Set a placeholder authToken immediately so API routes have something while
          // we attempt to upgrade it to a real DB session token.
          const placeholderToken = `admin-${normalized.replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
          clearUserSession();
          localStorage.setItem('authToken', placeholderToken);
          localStorage.setItem('userEmail', normalized);
          localStorage.setItem('dc-user-id', scopedUserId);
          const role: AppRole = apiDcRole ?? getUserRole(normalized);
          localStorage.setItem('dc-user-role', role);
          const demoUser = DEMO_USERS.find(u => u.email === normalized);
          localStorage.setItem('dc-user-subscription', apiSubscription ?? demoUser?.subscription ?? 'BASIC');
          window.dispatchEvent(new Event('authUpdated'));

          // Also create a real DB session so profile/addresses APIs work
          try {
            const sessionRes = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }), // No password → creates real DB session
            });
            if (sessionRes.ok) {
              const sessionData = await sessionRes.json();
              // Upgrade placeholder to real DB session token
              localStorage.setItem('authToken', sessionData.token);
              if (sessionData.user?.id) localStorage.setItem('userId', String(sessionData.user.id));
              window.dispatchEvent(new Event('authUpdated'));
            }
          } catch { /* placeholder token is still usable for demo-user fallback paths */ }
          router.push('/dashboard');
          return;
        }
        setErrors({ submit: 'Invalid email or password.' });
        return;
      }

      const normalized = email.toLowerCase();
      const scopedUserId = `user-${normalized.replace(/[^a-z0-9]/g, '-')}`;
      clearUserSession();
      localStorage.setItem('authToken', token);
      localStorage.setItem('userEmail', normalized);
      localStorage.setItem('dc-user-id', scopedUserId);
      if (userId) localStorage.setItem('userId', String(userId));
      // Prefer API-provided role/subscription from persisted user data, then safe fallbacks.
      const role: AppRole = apiDcRole ?? getUserRole(normalized);
      localStorage.setItem('dc-user-role', role);
      const demoUser = DEMO_USERS.find(u => u.email === normalized);
      localStorage.setItem('dc-user-subscription', apiSubscription ?? demoUser?.subscription ?? 'BASIC');

      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedEmail', email);
      }

      window.dispatchEvent(new Event('authUpdated'));
      router.push('/dashboard');
    } catch (error) {
      setErrors({ submit: 'Failed to sign in. Please check your credentials.' });
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="p-8 bg-white rounded-2xl shadow-xl border border-slate-200">
          {/* Header */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-center mb-8"
          >
            <motion.h1
              variants={itemVariants}
              className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-2"
            >
              DelegateCart
            </motion.h1>
            <motion.p variants={itemVariants} className="text-slate-600">
              Sign in to your account
            </motion.p>
          </motion.div>

          {/* Demo Quick-Fill */}
          {showDemoHint && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg"
            >
              <p className="text-sm text-blue-900 font-medium mb-3">Try a demo account:</p>
              <div className="space-y-2">
                {PUBLIC_DEMO_USERS.map(u => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => { setEmail(u.email); setPassword(ALL_DEMO_PASSWORD); setShowDemoHint(false); }}
                    className="w-full text-left p-2.5 bg-white rounded border border-blue-100 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{u.displayName}</p>
                        <p className="text-[11px] font-mono text-slate-500">{u.email}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        u.subscription === 'AI_PLUS' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                      }`}>{u.subscription}</span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Error Message */}
          {errors.submit && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errors.submit}</p>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${errors.email
                  ? 'border-red-300 focus:ring-red-500 focus:border-transparent'
                  : 'border-slate-300 focus:ring-blue-500 focus:border-transparent'
                  }`}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
            >
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${errors.password
                    ? 'border-red-300 focus:ring-red-500 focus:border-transparent'
                    : 'border-slate-300 focus:ring-blue-500 focus:border-transparent'
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-between text-sm"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-600">Remember me</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </motion.button>
          </form>



          {/* Sign Up Link */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-6 text-center text-slate-600 text-sm"
          >
            Don't have an account?{' '}
            <Link
              href="/signup"
              className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
            >
              Create one
            </Link>
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
