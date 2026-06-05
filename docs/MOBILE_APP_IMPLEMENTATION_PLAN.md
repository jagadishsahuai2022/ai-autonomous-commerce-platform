# DelegateCart Mobile — Multi-Phase Implementation Plan & Copilot Prompts

> **Status:** Approved scope (per `MOBILE_APP_DECISION_QUESTIONS.md` answers).
> **Execution model:** 7 phases, executed sequentially. Each phase has a self-contained Copilot prompt, ends with a stability check, then proceeds to the next.
> **Cost goal:** $0/month. Token-efficient: each phase produces only the files needed for that phase; no rewrites.

---

## 0. Approved Decisions Snapshot

| # | Answer |
|---|---|
| Q1 — Topology | Separate repo `delegatecart-mobile` |
| Q2 — GitHub Org | **Deferred** (decide later; repo can be moved any time) |
| Q3 — Repo name | `delegatecart-mobile` |
| Q4 — Bundle ID | `com.delegatecart.app` |
| Q5 — Min OS | iOS 16, Android 8 (API 26) |
| Q6 — Phase 1 scope | Phases 0–2 (Foundations + Core commerce + Money/trust) **+ AI surface from day one** (using Ghost + HUD concepts, see §1) |
| Q7 — Auth | **Email + Phone OTP** (no Apple/Google initially → no Apple App Store sign-in mandate) |
| Q8 — Payments | Stripe |
| Q9 — Push | Expo Notifications (wired, off until post-launch) |
| Q10 — Analytics | PostHog (wired, off until post-launch) |
| Q11 — Backend additions | All approved; **scope reduced for mobile MVP to 4 essentials** (refresh, phone OTP send/verify, devices register/delete, CORS dev origins). Apple/Google/visual-search/notifications-feed deferred. |
| Q12 — Fonts | Inter (body) + Geist (display) |
| Q13 — AI signature | **Implement BOTH Ghost (Concept A) + HUD (Concept B)** in mobile only, gated behind a user toggle in Settings. Validate which lands; promote winner to web later. |
| Q14 — Bootstrap | Yes — execute now, sequentially, no further user input until done |

---

## 1. Layout (final)

```
D:\PersonalProject\GIT\
├── delegatecart\                                  (existing, untouched in Phases 0–5)
├── delegatecart-mobile\                           (NEW — created in Phase 0)
└── delegatecart-workspace\
    └── delegatecart-workspace.code-workspace      (NEW — multi-root)
```

Workspace file uses relative paths `../delegatecart` and `../delegatecart-mobile` so VS Code opens both repos side-by-side without coupling them.

---

## 2. The Two AI Surfaces (replacing the Sphere)

Both ship together. User toggles between them in Settings → AI Mode (default = Ghost; advanced users opt into HUD).

### Concept A — "The Ghost" (Minimalist, ambient)
- **Where it lives:** A `<GhostOverlay>` mounted at the root of the navigation tree.
- **Visual:** No persistent UI. Subtle 1–2 px gradient glow at screen-bottom + a soft pulse on the active CTA (Checkout, Add-to-Cart) when the AI has a relevant insight.
- **Surfacing model:** Toast-like "FloatingSuggestion" sheet that animates up from the bottom only when:
  - A "Revenue Leakage" event fires (better deal found within 5 % of current cart total)
  - A repeated-purchase opportunity is detected
  - A confidence-> 0.85 recommendation just appeared
- **Dismissal:** Auto-dismiss after 6 s; swipe-down to permanently dismiss for that session.

### Concept B — "The HUD" (Heads-Up Display)
- **Where it lives:** A `<HudDrawer>` mounted at the root, default **collapsed** to a 28 px top strip showing a single status line.
- **Visual:** Drag down (or tap) → expands to a 60 % screen drawer that streams the AI's "thoughts" terminal-style:
  - `[12:04:33] Scanning prices for "Wireless Headphones"…`
  - `[12:04:34] Found 3 matches across 2 sources`
  - `[12:04:35] Ranking: Sony WH-1000XM5 (score 0.92) ← top pick`
- **Implementation:** Backed by the same recommendation/intent events the Ghost listens to; HUD just renders them as a log instead of a single notification.
- **Settings toggle:** "Show AI activity feed" → toggles HUD between "always-on strip" and "hidden".

**Both share one event bus** (a small Zustand store `useAiActivityStore`) so the underlying signal layer is implemented once.

---

## 3. Phases (sequential — each must be stable before the next begins)

| # | Phase | Output | Stability check |
|---|---|---|---|
| 0 | Workspace + Repo Skeleton | Folder structure, `package.json`, `tsconfig.json`, `app.config.ts`, `eas.json`, `.gitignore`, `.nvmrc`, `README.md`, multi-root `.code-workspace` | All files exist; `package.json` parses |
| 1 | Theme + Navigation + Auth | Design tokens, NativeWind config, RootNavigator, AuthNavigator (Sign-in, Sign-up, Phone OTP), TabNavigator skeleton | TS compiles in mind; no missing imports |
| 2 | API Client + State + Types | Axios client w/ interceptors, Zustand stores (auth, cart, ui, ai-activity), TanStack Query setup, manually-synced API types, `sync-types.ps1` script | All wiring imports cleanly |
| 3 | Core Commerce Screens | Home, Search, Product Detail, Cart, Checkout, Orders, Profile (with mock data fallbacks for dev without backend) | Each screen file builds in isolation |
| 4 | Ghost (Concept A) | `<GhostOverlay>`, `<FloatingSuggestion>`, ambient pulse hook, settings toggle | Mounted at root; no infinite re-renders |
| 5 | HUD (Concept B) | `<HudDrawer>`, terminal-style activity log, settings toggle | Mounted at root; coexists with Ghost |
| 6 | EAS + CI + Onboarding | `eas.json` profiles (dev / preview / production), `.github/workflows/ci.yml`, `ONBOARDING.md`, `.env.example` | YAML valid, JSON valid |
| 7 | Backend stubs in `delegatecart` repo | 4 endpoint stubs (`POST /auth/refresh` if missing, `POST /auth/phone/send`, `POST /auth/phone/verify`, `POST /devices/register`, `DELETE /devices/:id`), CORS dev origins | TS compiles; no breaking changes |

---

## 4. Copilot Prompts (one per phase)

Each prompt is self-contained. The agent already has full context, so prompts here are concise.

### Prompt P0 — Workspace + repo skeleton
> Create the folder `D:\PersonalProject\GIT\delegatecart-mobile` with an Expo SDK 54 / RN 0.76 / TypeScript 5.7 skeleton: `package.json` (deps locked to versions known to work together), `tsconfig.json` (strict), `app.config.ts` (reads `EXPO_PUBLIC_*`), `eas.json` (dev + preview + production profiles), `.gitignore`, `.nvmrc` (20.18.0), `README.md`, `.env.example`. Also create `D:\PersonalProject\GIT\delegatecart-workspace\delegatecart-workspace.code-workspace` referencing both repos via relative paths. No npm install — files only.

### Prompt P1 — Theme + Navigation + Auth scaffolding
> In `delegatecart-mobile/src/`, create: (a) `theme/` with `colors.ts`, `typography.ts`, `spacing.ts` mirroring the web's Tailwind tokens (indigo/purple/cyan, Inter + Geist), (b) `navigation/` with `RootNavigator.tsx` (auth gate), `AuthNavigator.tsx` (SignIn / SignUp / PhoneOTP), `TabNavigator.tsx` (Home / Search / Cart / Orders / Profile), (c) `screens/auth/` for the three auth screens with email + phone-OTP UI, (d) `App.tsx` wiring `NavigationContainer` + safe-area + theme provider + React Query + Zustand persistence. Use NativeWind classes throughout.

### Prompt P2 — API client + State + Types
> Create `src/services/api.ts` (axios instance with auth interceptor + refresh-on-401 + base URL from `EXPO_PUBLIC_API_URL`), `src/services/{auth,products,cart,orders,recommendations}.ts` (typed wrappers), `src/store/{useAuthStore,useCartStore,useUiStore,useAiActivityStore}.ts` (Zustand + MMKV persistence; tokens via SecureStore), `src/types/api.ts` (manually-curated subset of API contracts — Product, Cart, Order, User, Recommendation), `src/lib/queryClient.ts` (TanStack Query with persistQueryClient over MMKV), `scripts/sync-types.ps1` (PowerShell — copies types from sibling repo on demand).

### Prompt P3 — Core commerce screens
> Create `src/screens/`: `home/HomeScreen.tsx` (recommendation grid with "Why?" + confidence badge), `search/SearchScreen.tsx` (search bar + bottom-sheet filters + results grid), `product/ProductDetailScreen.tsx` (carousel, parallax hero, reviews, AI explanation block, add-to-cart), `cart/CartScreen.tsx` (swipe-to-delete, optimistic updates), `checkout/CheckoutScreen.tsx` (address picker, payment method, review/confirm), `orders/OrdersScreen.tsx` + `OrderDetailScreen.tsx` (pull-to-refresh, polling), `profile/ProfileScreen.tsx` (user info, AI mode toggle, logout). Each screen uses the typed services from P2 and falls back to mock data when API unreachable. Include `components/` for shared `ProductCard`, `RecommendationCard`, `ConfidenceBadge`, `EmptyState`, `ErrorBoundary`, `Skeleton`.

### Prompt P4 — The Ghost (Concept A)
> Create `src/ai/ghost/`: `GhostOverlay.tsx` (root-mounted, listens to `useAiActivityStore`), `FloatingSuggestion.tsx` (animated bottom sheet, swipe-to-dismiss), `useGhostPulse.ts` hook (subtle pulse on Add-to-Cart / Checkout when an insight is queued), `useRevenueLeakageDetector.ts` (compares cart items against fresh recommendations every 30 s when foreground). Wire it into `App.tsx`.

### Prompt P5 — The HUD (Concept B)
> Create `src/ai/hud/`: `HudDrawer.tsx` (collapsible top drawer, default = 28 px strip), `ActivityLogList.tsx` (terminal-styled FlatList over `useAiActivityStore.events`), `useHudController.ts` (expand/collapse + filter levels INFO/MATCH/WARN). Wire into `App.tsx`. Add Settings → "AI Mode" toggle: `Ghost only` (default) / `HUD only` / `Both` / `Off`.

### Prompt P6 — EAS + CI + Onboarding
> Finalize `eas.json` (dev client builds for both platforms, preview = internal, production = store). Create `.github/workflows/ci.yml` (Node 20, install, typecheck, lint — no build matrix yet). Create `ONBOARDING.md` walking a new dev through clone → install → run on Expo Go → first build. Update `README.md` with quickstart.

### Prompt P7 — Backend additive stubs in delegatecart repo
> In the existing `delegatecart` repo, add minimal NestJS controllers/DTOs (no schema migrations) for: `POST /auth/refresh` (verify exists; if not, scaffold), `POST /auth/phone/send` + `POST /auth/phone/verify` (in-memory OTP for now — TODO: Twilio/Firebase later), `POST /devices/register` + `DELETE /devices/:id` (TODO file; in-memory). Append dev origins (`http://localhost:8081`, `exp://*`) to CORS_ORIGINS in `apps/api/.env.example` and `apps/api/src/main.ts` if hard-coded. All marked `// TODO: production wiring`.

---

## 5. Token & cost discipline

- No `npm install` runs (saves agent time + avoids long terminal sessions).
- No npm package downloads — all files are templates the user runs `pnpm install` on once at the end.
- No image generation, no asset fetching.
- All file content is hand-crafted, minimal, no boilerplate explanations inside files.
- Each phase ends with a quick existence check, not a full build.

---

## 6. Final manual step (user, after agent finishes)

```powershell
cd D:\PersonalProject\GIT\delegatecart-mobile
pnpm install         # or npm install
npx expo start       # then scan QR with Expo Go
```

Open `D:\PersonalProject\GIT\delegatecart-workspace\delegatecart-workspace.code-workspace` in VS Code → both repos appear in the explorer.

---

*Begin execution: Phase 0 → Phase 7. No further user input required.*
