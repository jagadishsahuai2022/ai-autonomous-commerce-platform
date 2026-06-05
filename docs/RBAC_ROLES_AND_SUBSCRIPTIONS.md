# DelegateCart — Role-Based Access Control (RBAC) & Subscriptions

> Updated documentation for the expanded 7-role RBAC system, subscription tiers, demo users, and admin impersonation.

---

## Roles

| Role | Key | Description |
|------|-----|-------------|
| **Admin** | `admin` | Full platform access — all pages, Admin Dashboard, user management, impersonation |
| **Analytics** | `analytics` | All pages except Admin Dashboard — focus on metrics and validation analytics |
| **AI Plus** | `aiplus` | Shopping Assistant, AI+, Shopping List, Smart Delegate, Validation — no Observability or Admin |
| **Observability** | `observability` | All pages except Admin Dashboard — includes Observability monitoring |
| **Reinforced Learning** | `reinforced-learning` | All pages except Observability Dashboard and Admin Dashboard |
| **Basic** | `basic` | Core shopping pages — no AI+, Observability, Admin, or Learning |
| **Customer** | `customer` | Unauthenticated / minimal access — public pages only |

---

## Demo Users

All demo users share the same password: **`Admin@DC2024!`** (configurable via `NEXT_PUBLIC_ADMIN_PASSWORD`).

| Email | Role | Subscription | Display Name |
|-------|------|-------------|--------------|
| `admin@delegatecart.com` | admin | AI_PLUS | Admin |
| `admin@example.com` | admin | AI_PLUS | Admin (Example) |
| `analytics@delegatecart.com` | analytics | BASIC | Analytics |
| `aiplusdemo@delegatecart.com` | aiplus | AI_PLUS | AI Plus Demo |
| `observability@delegatecart.com` | observability | BASIC | Observability |
| `reenforcedlearning@delegatecart.com` | reinforced-learning | BASIC | Reinforced Learning |
| `basicdemo@delegatecart.com` | basic | BASIC | Basic Demo |

---

## Subscription Tiers

| Tier | Key | Features |
|------|-----|----------|
| **Basic** | `BASIC` | Standard shopping, shopping list, product search |
| **AI Plus** | `AI_PLUS` | Everything in Basic + AI-powered features, Smart Delegate, advanced validation analytics |

Subscription is stored in `localStorage` as `dc-user-subscription` and is derived from the `DEMO_USERS` configuration in `lib/admin-auth.ts`.

---

## Access Matrix

| Page Path | admin | analytics | aiplus | observability | reinforced-learning | basic | customer |
|-----------|:-----:|:---------:|:------:|:------------:|:-------------------:|:-----:|:--------:|
| `/admin/dashboard` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/admin/learning` | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `/observability` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `/ai-plus` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/shopping-assistant` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/shopping-list` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/smart-delegate` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/shopping-assistant/metrics/validation` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Public pages | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Blocked Paths per Role

Defined in `ROLE_BLOCKED_PATHS` in `lib/admin-auth.ts`:

```typescript
const ROLE_BLOCKED_PATHS: Record<AppRole, string[]> = {
  admin: [],                                                                    // No restrictions
  analytics: ['/admin'],                                                        // No admin dashboard
  aiplus: ['/admin', '/observability', '/admin/learning'],                      // No admin, observability, learning
  observability: ['/admin'],                                                    // No admin dashboard
  'reinforced-learning': ['/admin', '/observability'],                          // No admin, observability
  basic: ['/admin', '/observability', '/admin/learning', '/ai-plus'],           // Core shopping only
  customer: ['/admin', '/observability', '/admin/learning', '/ai-plus', '/admin/analytics'],
};
```

---

## Authentication Flow

### Sign-In (`/signin`)

1. User enters email and password
2. App calls `/api/auth/login` (Prisma DB lookup with bcrypt verification)
3. If DB returns success → role and subscription set from `getUserRole()` and `DEMO_USERS`
4. If DB returns 401 → fallback to `authenticateAdmin()` for known demo users
5. On success: `authToken`, `userEmail`, `dc-user-role`, `dc-user-subscription` stored in localStorage
6. Admin session additionally stored in sessionStorage (8-hour TTL)

### Admin Authentication (`authenticateAdmin`)

- Accepts any email in `DEMO_USERS` array
- Verifies password against `NEXT_PUBLIC_ADMIN_PASSWORD` env var
- Creates `AdminSession` in sessionStorage with role, expiration (8 hours)
- Sets localStorage keys for navbar and role detection

---

## Admin Dashboard (`/admin/dashboard`)

### Access
- Only users with `admin` role can view the dashboard
- Non-admin users see "Admin Access Required" screen

### Features
1. **User Management Table** — View all demo users with role, subscription, status
2. **Password Visibility** — Toggle to reveal/hide password per user
3. **Copy Email** — One-click copy email to clipboard
4. **Activate/Deactivate** — Toggle user active status (persisted to localStorage)
5. **Impersonation** — Click "Impersonate" to switch to any user's session
   - Original admin email saved to `dc-admin-impersonate-original`
   - Navigates to `/dashboard` as the impersonated user
   - "Stop Impersonation" button restores original admin session

### Role & Access Reference
- Inline table showing all roles with their blocked paths and subscription tiers

---

## Implementation Files

| File | Purpose |
|------|---------|
| `lib/admin-auth.ts` | Central RBAC module — roles, permissions, session management |
| `app/signin/page.tsx` | Login page with demo user fallback |
| `app/admin/dashboard/page.tsx` | Admin dashboard with user management |
| `app/layout-client.tsx` | Navbar with conditional Admin Dashboard link |
| `app/shopping-assistant/metrics/validation/page.tsx` | Validation page with RBAC-aware access |

---

## localStorage Keys

| Key | Purpose | Values |
|-----|---------|--------|
| `authToken` | Authentication token | `admin-{timestamp}` or `demo-{timestamp}` |
| `userEmail` | Current user email | e.g. `admin@delegatecart.com` |
| `dc-user-role` | Current user role | `admin`, `analytics`, etc. |
| `dc-user-subscription` | Subscription tier | `BASIC` or `AI_PLUS` |
| `dc-admin-user-statuses` | Admin dashboard user toggles | JSON `{ email: boolean }` |
| `dc-admin-impersonate-original` | Original admin email during impersonation | email string |
