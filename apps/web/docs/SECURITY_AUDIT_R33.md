# Security Audit Report — Round 33

**Date:** Generated during Round 33 development
**Scope:** `apps/web/` — Next.js 14 frontend application

---

## 1. localStorage Usage Assessment

### Summary
localStorage is used extensively for **non-sensitive UI state** — which is the correct pattern for a client-side commerce demo. No passwords, JWTs with real secrets, or PII beyond email addresses are stored.

### All localStorage Keys Identified

| Key | File(s) | Data | Risk |
|-----|---------|------|------|
| `authToken` | `lib/admin-auth.ts` | `admin-{timestamp}` pattern | **Low** — not a real JWT, just a session marker |
| `userEmail` | `lib/admin-auth.ts` | User email address | **Medium** — PII, but required for session identity |
| `rememberMe` | Navbar logout handler | Boolean flag | **None** |
| `app-theme` | Theme provider | `light`/`dark`/`system` | **None** |
| `cart` | `ProductDetailModal.tsx`, `wishlist/page.tsx` | Product objects (id, name, price, qty) | **None** — non-sensitive product data |
| `wishlist` | `wishlist/page.tsx` | Product objects | **None** |
| `dc-metrics-products` | `shopping-assistant/page.tsx` | Ranked product arrays | **None** |
| `dc-metrics-timeline` | `shopping-assistant/page.tsx` | Pipeline step durations | **None** |
| `dc-metrics-ts` | `shopping-assistant/page.tsx` | Timestamp number | **None** |
| `dc-metrics-history` | `metrics/validation/page.tsx` | Historical session data | **None** |
| `dc-metrics-validation-public` | `metrics/validation/page.tsx` | Boolean string | **None** |
| `dc-user-email` | `metrics/validation/page.tsx` | Email for metrics view | **Low** |
| `dc-user-id` | `metrics/validation/page.tsx` | Generated user ID | **None** |
| `dc-auto-approve-threshold` | `shopping-assistant/page.tsx` | Price threshold value | **None** |
| `showExternalProducts` | Product toggle | Boolean string | **None** |
| `walletMockBypass` | `wallet/page.tsx` | Boolean for test bypass | **None** |

### Verdict: ✅ ACCEPTABLE
- No real passwords stored in localStorage
- No JWT secrets or access tokens with real signing keys
- `authToken` is just a timestamp-based marker, not a real bearer token
- Email in localStorage is necessary for the demo's admin role detection

### Recommendation
For production: Replace localStorage `authToken` with HttpOnly cookies via NextAuth session management. Email-based admin detection should move server-side.

---

## 2. Zustand Store Analysis

### Stores Found

| Store | File | Persisted? | Sensitive Data? |
|-------|------|-----------|----------------|
| Chat Store | `lib/stores/chat-store.ts` | No (session only) | No — chat messages, UI state |
| Cart Store | `lib/stores/cart-store.ts` | No | No — product items, quantities |
| Product Page Store | `lib/stores/product-page-store.ts` | No | No — filters, scroll position |
| User Store | `store/useUserStore.ts` | Yes (`persist` middleware) | **Low** — user preferences |
| Sphere Store | `store/useSphereStore.ts` | No | No — 3D visualization state |
| Realtime Store | `lib/store/realtime.store.ts` | Yes (`persist` + `devtools`) | No — WebSocket connection state |
| Global Stores | `lib/stores.ts` | Varies | No |

### Verdict: ✅ ACCEPTABLE
- No store persists passwords, tokens, or PII
- `persist` middleware used only for UI preferences (theme, filters)
- `devtools` middleware on realtime store — should be disabled in production builds

### Recommendation
Wrap `devtools` middleware in `process.env.NODE_ENV !== 'production'` check.

---

## 3. Amazon/Flipkart References (Trademark Concern)

### Findings

| Reference | Location | Context | Risk |
|-----------|----------|---------|------|
| `AmazonProductCard` | `components/product/AmazonProductCard.tsx` | Component name | **Medium** — Amazon trademark in component name |
| `AmazonProductCard` imports | `app/page.tsx`, `app/ai-assistant/chat/page.tsx` | Import/render | Same component |
| `source: 'Amazon'` | `metrics/products/page.tsx` L235 | Demo product data | **Medium** — Amazon as a product source label |
| `'Amazon'` brand | `api/intent/analyze/route.ts` L132 | Brand list for intent analysis | **Low** — generic brand reference |
| `'Amazon Basics'` | `api/intent/analyze/route.ts` L499 | Brand mapping | **Low** — actual brand name |
| `'Amazon Pay'` | `wallet/page.tsx` L630 | UPI payment option | **Low** — payment method reference |
| `isExternal || source === 'Amazon'` | `ProductDetailModal.tsx` L191 | Conditional rendering for external products | **Low** |

**No Flipkart references found.**

### Verdict: ⚠️ NEEDS ATTENTION
- `AmazonProductCard` component name creates unnecessary trademark association
- Demo data uses "Amazon" as a product source

### Recommendation
1. Rename `AmazonProductCard` to `ProductCard` or `ExternalProductCard`
2. Replace `source: 'Amazon'` with `source: 'External'` or `source: 'Marketplace'`
3. `Amazon Pay` as a UPI option is factual and acceptable

---

## 4. Hardcoded Credentials & Secrets

### Findings

| Item | Location | Value | Risk |
|------|----------|-------|------|
| Admin password | `lib/admin-auth.ts` L80 | `Admin@DC2024!` | **High** — hardcoded in source |
| Admin password in comments | `lib/admin-auth.ts` L13 | Documented in file header | **High** — credential in comment |
| Test passwords | `e2e/*.spec.ts` (multiple) | `TestPass123!`, `Demo123!@#`, etc. | **Low** — test fixtures only |
| Test API keys | `test/unit/*.test.ts` | `sk-test-key`, `test-claude-key` | **None** — clearly fake test values |

### Verdict: ⚠️ NEEDS ATTENTION (for production)
- Hardcoded admin password is acceptable for MVP/demo
- For production: Move to environment variable `ADMIN_PASSWORD` and hash with bcrypt

### Recommendation
```typescript
// Production fix for admin-auth.ts:
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
// Use bcrypt.compare() instead of string equality
```

---

## 5. XSS Risk Assessment

### Findings
- **`dangerouslySetInnerHTML`: NOT USED** anywhere in the source code ✅
- All user-facing content is rendered through React's built-in JSX escaping
- Chat messages displayed via `{message.text}` not innerHTML

### Verdict: ✅ SAFE — No XSS vectors identified

---

## 6. Authentication & Session Security

### Architecture
- **NextAuth** configured with `NEXTAUTH_SECRET` (env variable — good)
- **Admin auth** handled client-side via `lib/admin-auth.ts`
- **Session storage**: `sessionStorage` for admin sessions (cleared on tab close — good)
- **Token pattern**: `admin-{timestamp}` — not a real JWT

### Concerns
1. Admin authentication is entirely client-side — can be bypassed by modifying localStorage
2. No CSRF protection on admin actions (not needed for demo, required for production)
3. No rate limiting on login attempts

### Verdict: ⚠️ ACCEPTABLE FOR DEMO
- Client-side auth is fine for an MVP/demo application
- For production: Move all auth decisions server-side, use NextAuth middleware

---

## 7. Overall Risk Summary

| Category | Status | Priority |
|----------|--------|----------|
| localStorage | ✅ Safe | — |
| Zustand Stores | ✅ Safe | — |
| XSS | ✅ Safe | — |
| Amazon References | ⚠️ Rename | Medium |
| Hardcoded Password | ⚠️ Env var | Medium (production) |
| Client-side Auth | ⚠️ Server-side | Low (demo OK) |

**Overall: The application is secure for a demo/MVP deployment. No critical vulnerabilities found.**
