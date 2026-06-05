# DelegateCart Mobile — Final Plan v3 (Zero-Cost MVP)

> **Status:** Final consolidated plan for review. **No code changes.**
> **Supersedes:** v1 (chat) and v2 (`MOBILE_APP_PLAN_V2.md`).
> **Goal:** Ship a production-ready iOS + Android customer app at **~zero cost**, fast, without sacrificing the architectural choices that matter long-term.
> **Method:** Adversarial comparison of three competing plans (mine v2, ChatGPT's, and the "Corrected Lean" plan), keeping the best of each.

---

## 0. TL;DR

| Decision | Final Answer | Why |
|---|---|---|
| **Repository topology** | **Separate repo `delegatecart-mobile` + VS Code multi-root workspace** (ChatGPT's framing wins) | Cleaner than monorepo; no need for GitHub Packages publishing pipeline at MVP. |
| **Tech stack** | React Native 0.76 + **Expo SDK 54 (Managed Workflow)** + TypeScript 5.7 + NativeWind | Identical across all 3 plans. Expo Managed = no Xcode/Android Studio required for dev = **Windows-friendly + zero local infra**. |
| **Type sharing with backend** | **Manual sync via a small script** (copy `apps/api` Prisma-derived TS types into mobile repo on demand). No npm publishing. Upgrade to `@delegatecart/types` later **only if** team grows. | Saves ~2 days of pipeline work; type drift cost is acceptable at MVP scale. |
| **User scope** | **Customer roles only**: Basic + AI+. Admin / analytics / observability / RL / seller stay web-only. | Cuts ~60% of scope; matches "Corrected Lean" plan's strongest insight. |
| **CI/CD** | GitHub Actions (free tier) for lint/typecheck only. **EAS Build free tier** (30 builds/month) for binaries. **EAS Update free tier** for OTA. | Zero monthly spend up to MVP traffic. |
| **Crash + analytics** | **Defer Sentry & PostHog** — wire them in but disabled until post-launch. | Free tier exists; cost is cognitive (events, dashboards). Add when there are users to observe. |
| **Phase 1 deliverable** | Auth → Home (recommendations) → Search → Product detail → Cart → Checkout → Profile → Orders. **No Sphere, no autopilot, no wallet in v1.** | Ship in weeks, not months. AI features come in Phase 2 once core commerce is validated. |
| **Sphere & autopilot** | Plan documented, **deferred to Phase 2**. | High wow-factor but not gating MVP launch; risky for App Store review without proven UX. |
| **Workspace** | `workspace/` containing `delegatecart/` + `delegatecart-mobile/` + `delegatecart.code-workspace` (multi-root). No git submodules. | ChatGPT's idea — clean & Copilot-friendly. |

**Net result:** **$0/month operating cost through MVP**, ~2 weeks to first internal build, ~4–6 weeks to first store submission.

---

## 1. Side-by-Side Comparison of the Three Plans

| Dimension | **My v2** (Enterprise) | **ChatGPT's plan** (Workspace + Lean) | **Corrected Lean Plan** | **Final v3 (chosen)** |
|---|---|---|---|---|
| Repo strategy | Separate repo + GitHub Org + Packages | Separate repos + multi-root workspace | Separate repo, no SDK | **Separate repo + multi-root workspace** ✅ |
| Type sharing | `@delegatecart/types` published to GH Packages | Not addressed | Manual sync / shared folder | **Manual sync script (upgrade later)** ✅ |
| Tech stack | RN + Expo + Skia + Reanimated + Zustand + TanStack Query + MMKV + WatermelonDB | RN + Expo + Zustand + RQ + Axios + NativeWind | Same as ChatGPT + SecureStore + MMKV | **RN + Expo + NativeWind + Zustand + RQ + Axios + MMKV + SecureStore** ✅ (drop WatermelonDB & Skia from MVP) |
| Workflow | Bare/Prebuild (Skia needs it eventually) | Managed (Expo Go) | Managed | **Managed Workflow for MVP** (move to Prebuild only when Sphere/Skia lands) ✅ |
| User roles in app | All roles | Not specified | **Customer only** (Basic + AI+) | **Customer only** ✅ |
| Phase 1 features | Foundations + commerce + money/trust | Auth + Home + recommendations | Auth + Home + List + Detail + Cart + Profile | **Auth + Home + Search + Detail + Cart + Checkout + Orders + Profile** ✅ |
| Sphere / Autopilot in v1 | Yes (Phase 3+) | Not addressed | No | **No — Phase 2** ✅ |
| CI cost | Discussed | Free tier | Free tier | **Free tier (GH Actions + EAS free)** ✅ |
| Crash/analytics in v1 | Sentry + PostHog from day 1 | Not addressed | Defer | **Wire stubs, disable until post-launch** ✅ |
| State persistence | MMKV + WatermelonDB | Not specified | MMKV + SecureStore | **MMKV + SecureStore** (no WatermelonDB) ✅ |
| Offline-first | Full WatermelonDB sync | Not addressed | Basic RQ cache | **RQ persistence to MMKV (no SQLite)** ✅ |
| Payments | Stripe + Apple/Google Pay | Not addressed | Stripe | **Stripe** ✅ |
| Auth | Email + Apple + Google | Email + JWT | Email; social later | **Email day 1; Apple + Google before store submission (required for Apple)** ✅ |
| Push | Expo Notifications | Not addressed | Defer | **Wire Expo Notifications, enable post-launch** ✅ |
| Backend additions | 9 endpoints | Not detailed | Not detailed | **Only 4 essential** (refresh, apple, google, devices/register) ✅ |
| Cost | Med-low (GH Packages free quota OK) | Zero | Zero | **Zero** ✅ |
| Time-to-MVP | 6–8 weeks | ~10 days | 7–10 days | **3–4 weeks realistic** (10 days is optimistic for prod-grade) ✅ |
| Risk coverage | Excellent | None | Light | **Inherits v2 risk register, mitigations downsized to MVP** ✅ |
| Architecture future-proofing | Highest | Lowest | Low | **Pragmatic — clean structure now, scale later** ✅ |

### What each plan got right and wrong

**My v2** — **Right:** repo topology trade-offs, risk analysis, design system rigor, security model. **Wrong:** premature SDK pipeline, premature Sentry/PostHog/WatermelonDB, included all features in v1, didn't cap scope to customer roles.

**ChatGPT's plan** — **Right:** multi-root workspace folder pattern (clean Copilot context, both repos open together), managed Expo workflow, lean Axios setup, defer SDK. **Wrong:** no risk analysis, vague feature scope, "Day 1–10" timeline is unrealistic for production-grade.

**"Corrected Lean" plan** — **Right:** scope cut to customer roles only, defer AI complexity, defer paid tools, AI-trust UX as Day-1 must-have ("Why this recommendation?", confidence indicator, undo window). **Wrong:** 7–10 day timeline still unrealistic; missed checkout/orders in core; no plan for Apple/Google sign-in (required by App Store).

**Final v3** keeps:
- ✅ **Workspace + separate-repo + manual type sync** (ChatGPT)
- ✅ **Customer-only scope + defer paid tools + AI-trust UX from Day 1** (Lean)
- ✅ **Risk register + design discipline + security floor + clean architecture** (my v2)

---

## 2. Final Architecture (v3)

### 2.1 Workspace layout (on your machine)

```
D:\PersonalProject\GIT\
├── delegatecart\                        ← existing (web + API + services)
│   └── (unchanged)
├── delegatecart-mobile\                 ← NEW (RN + Expo)
│   └── (see §2.3 structure)
└── delegatecart.code-workspace          ← NEW (multi-root VS Code workspace)
```

**`delegatecart.code-workspace`** — opens both repos in one VS Code window for unified Copilot context, but keeps them as **independent git repos** (no submodules, no subtree).

### 2.2 GitHub layout

```
github.com/<your-org-or-user>/
├── delegatecart            (existing — web + API + services + infra + docs)
└── delegatecart-mobile     (new — RN app, iOS + Android)
```

No GitHub Org required at MVP — both repos can live under your personal account or be moved to an org later. Cross-repo cohesion via:
- A single GitHub Project (v2) board spanning both repos.
- Cross-repo issue references (`delegatecart-mobile#42` from `delegatecart` PRs).
- Optional shared CODEOWNERS.

### 2.3 Mobile repo structure

```
delegatecart-mobile/
├── src/
│   ├── screens/             (Auth, Home, Search, Product, Cart, Checkout, Orders, Profile)
│   ├── components/          (ProductCard, RecommendationCard, ConfidenceBadge, EmptyState, ErrorBoundary, etc.)
│   ├── navigation/          (RootNavigator, TabNavigator, AuthNavigator)
│   ├── services/            (api.ts — axios instance, products.ts, cart.ts, orders.ts, auth.ts)
│   ├── store/               (Zustand: useAuthStore, useCartStore, useUIStore)
│   ├── hooks/               (useProducts, useRecommendations, useCart, useOrder)
│   ├── utils/               (format, validators, errorHandler)
│   ├── theme/               (colors, typography, spacing — mirrors web Tailwind tokens)
│   ├── types/               (api.ts — manually synced from delegatecart's Prisma types)
│   └── config/              (env.ts — reads EXPO_PUBLIC_*)
├── assets/                  (icons, splash, fonts)
├── scripts/
│   └── sync-types.ps1       (copies API types from sibling repo)
├── .github/workflows/
│   └── ci.yml               (lint + typecheck only — fast & free)
├── app.config.ts
├── eas.json
├── babel.config.js
├── tsconfig.json
├── package.json
├── .env.example             (EXPO_PUBLIC_API_URL, EXPO_PUBLIC_WS_URL)
├── .nvmrc
├── README.md
└── ONBOARDING.md
```

### 2.4 Tech stack (final, locked)

| Layer | Choice | Cost |
|---|---|---|
| Framework | React Native 0.76 (New Arch) | $0 |
| Build system | Expo SDK 54 — **Managed Workflow** | $0 |
| Language | TypeScript 5.7 | $0 |
| Navigation | React Navigation 7 (native stack + bottom tabs) | $0 |
| Styling | NativeWind 4 (Tailwind for RN) | $0 |
| State (UI) | Zustand 5 | $0 |
| State (server) | TanStack Query 5 | $0 |
| HTTP | Axios | $0 |
| Local storage | `react-native-mmkv` | $0 |
| Secure storage | `expo-secure-store` | $0 |
| Notifications | `expo-notifications` (wired, off until post-launch) | $0 |
| Forms | React Hook Form + Zod | $0 |
| Crash reporting | `@sentry/react-native` (wired, **disabled** until post-launch) | Free tier 5k events/mo |
| Analytics | `posthog-react-native` (wired, **disabled** until post-launch) | Free tier 1M events/mo |
| Build & ship | EAS Build + EAS Submit + EAS Update | Free tier: 30 builds/mo + unlimited OTA |
| Code signing | Managed by EAS (Apple + Google credentials uploaded once) | $0 (excluding $99/yr Apple Developer + $25 one-time Google Play) |

**Deliberately deferred** (each saves time + complexity now, easy to add later):
- ❌ React Native Skia — Sphere comes in Phase 2.
- ❌ Reanimated complex worklets — basic Reanimated for transitions is fine.
- ❌ WatermelonDB — RQ cache to MMKV is enough for MVP.
- ❌ socket.io-client — polling for order status in MVP; real-time in Phase 2.
- ❌ `@delegatecart/types` npm publishing — manual `sync-types.ps1` for MVP.
- ❌ `react-three-fiber/native` — no 3D in MVP.
- ❌ Cert pinning, jailbreak detection — add hardening in Phase 3.
- ❌ Maestro E2E — manual QA + RN Testing Library unit tests for MVP.

---

## 3. Phased Roadmap (Realistic, Zero-Cost)

> Time estimates assume one focused developer + Copilot. Halve them if pair-programming with Copilot agent mode actively.

### Phase 0 — Foundations (3–4 days)
- Multi-root workspace setup
- `delegatecart-mobile` repo init via `create-expo-app`
- TypeScript strict, ESLint, Prettier, husky (lessons from your existing repo's BOM bug applied)
- React Navigation skeleton + Bottom Tab + Native Stack
- NativeWind + theme tokens extracted from web Tailwind config
- Axios instance + auth interceptor + 401 → silent refresh
- Zustand `useAuthStore` with SecureStore persistence
- TanStack Query setup with MMKV persistence
- `.env.example`, `app.config.ts`, `eas.json` (development + preview profiles)
- GitHub Actions CI (lint + typecheck)
- `sync-types.ps1` script + initial type drop

### Phase 1 — MVP Customer Commerce (10–14 days)
| # | Screen | Backend | Notes |
|---|---|---|---|
| 1 | Onboarding (3 cards) | — | Skip in dev mode after first launch |
| 2 | Sign in / Sign up / Forgot pwd | `/auth/login`, `/auth/register`, `/auth/forgot-password` | Email only in Phase 1; Apple+Google before store submission |
| 3 | Home (For You) | `/products`, `/recommendations/:userId`, `/categories` | **AI-trust UX from Day 1**: "Why this?" tooltip, confidence badge, easy override |
| 4 | Search + filters | `/products/search`, `/products` | Bottom-sheet filters, recent searches |
| 5 | Product Detail | `/products/:id`, `/products/:id/view` | Image carousel, parallax hero, reviews, "Why recommended" section |
| 6 | Cart | `/cart/*` | Swipe-to-delete, optimistic updates |
| 7 | Checkout | `/orders` | Address picker, payment (card via Stripe stub or web fallback), review, confirm |
| 8 | Orders + tracking | `/orders`, `/orders/:id` | Pull-to-refresh; polling every 30s on detail screen (no WS in MVP) |
| 9 | Profile | `/users/me`, `/addresses` | Edit profile, address book, logout |

### Phase 2 — AI Plus Experience (post-MVP, 2–3 weeks)
- The **Sphere** (Skia + Reanimated) — switch to Expo Prebuild here
- AI Shopping Assistant chat (`/chat/*`)
- Real-time via socket.io
- Smart Delegate / autopilot rules
- Approvals inbox (HITL)
- Wallet + Stripe Apple/Google Pay
- Push notifications enabled
- Sentry + PostHog enabled

### Phase 3 — Hardening (1 week)
- Cert pinning, jailbreak/root detection
- Screenshot guard on sensitive screens
- Biometric step-up
- Accessibility audit (VoiceOver / TalkBack)
- Localization (en + hi)
- Performance pass (Hermes profile, image pipeline)
- Maestro E2E suite

### Phase 4 — Store submission
- Privacy manifest (iOS) + Data Safety form (Play)
- Screenshots for both stores (5 sizes each)
- TestFlight external beta (50 users) + Play closed track
- Staged production rollout

---

## 4. Cost Model (Through MVP and Beyond)

### MVP phase (Phases 0–1)
| Item | Cost |
|---|---|
| Local development | $0 |
| GitHub Actions (free 2000 min/mo for private; unlimited for public) | $0 |
| EAS Build free tier (30 builds/mo) | $0 |
| EAS Update free tier | $0 |
| Sentry free tier (wired but disabled) | $0 |
| PostHog free tier (wired but disabled) | $0 |
| **Total monthly** | **$0** |

### Pre-store-submission (one-time)
| Item | Cost |
|---|---|
| Apple Developer Program | **$99/year** (mandatory for App Store) |
| Google Play Developer | **$25 one-time** (mandatory for Play Store) |
| Domain (already owned) | $0 |
| Code-signing certificates | $0 (handled by EAS) |
| **Total** | **~$124 first year, $99/yr after** |

### Post-launch (Phase 2+, when you have users)
| Item | Cost (estimated) |
|---|---|
| EAS Build (~50 builds/mo) | $0 (still free tier) or $19/mo (Production tier — only if you exceed 30) |
| Sentry | $0 (5k events/mo free) |
| PostHog | $0 (1M events/mo free) |
| Stripe | 2.9% + 30¢ per transaction (passed to revenue) |
| Backend hosting | unchanged (your existing infra) |

**Bottom line:** ~$0/month until store submission. **~$99/year** to keep it on the App Store. Optional ~$19/mo if EAS Build usage outgrows free tier (only after sustained release activity).

---

## 5. Risk Register (MVP-Scoped)

Inherits from `MOBILE_APP_PLAN_V2.md` §7, but only the risks that matter for an MVP customer app.

| # | Risk | Likelihood | Impact | Mitigation (built into v3) |
|---|---|---|---|---|
| M1 | **Type drift** between API and mobile (no SDK pipeline) | Med | Med | `sync-types.ps1` runs in mobile CI; flagged if diff is non-empty. Manual review of API contract changes during PR. |
| M2 | **Apple App Store rejection** for missing Sign in with Apple (required if any social login is offered) | High | High | Add Apple sign-in **before** first store submission, even if Google added later. |
| M3 | **Apple rejection for autopilot perceived as deceptive** | N/A in MVP | N/A | Autopilot deferred to Phase 2 — buys time to design consent flows properly. |
| M4 | **Expo Managed Workflow limitations** (some native modules unavailable) | Low (MVP scope is Managed-friendly) | Med | Phase 2 switches to Prebuild when Skia/Sphere lands; planned, not surprise. |
| M5 | **EAS free tier exhaustion** (30 builds/mo) | Low | Low | Use development client for iteration (no rebuild needed for JS changes); only build for store submissions. Upgrade to $19/mo only if needed. |
| M6 | **Windows dev environment can't build iOS locally** | Certain | Low | EAS Build is cloud — no Mac required for development. Mac only needed if you want native iOS module debugging (not in MVP). |
| M7 | **Polling for order status** instead of WS = battery + bandwidth | Low | Low | Poll only when order detail screen is open; stop on background. |
| M8 | **Token leak via insecure storage** | Low | High | SecureStore (Keychain/Keystore) for JWT; never MMKV. |
| M9 | **Backend rate-limiting hits NAT'd mobile users** | Med | Med | Switch backend to per-user limits (one of the 4 essential backend additions). |
| M10 | **Cold-start performance regression** | Med | Med | Measure on each release with `expo-bundle-analyzer`; budget < 2s on Pixel 6 / iPhone 13. |
| M11 | **Type drift + breaking API changes mid-development** | Med | Med | Backend follows expand-then-contract pattern; mobile pins to known-good commit during sprints. |
| M12 | **Onboarding drag for second contributor** | Low (solo MVP) | N/A | `ONBOARDING.md` script; multi-root workspace one-clone setup. |

### Risks consciously accepted (with rationale)
- ✅ No SDK auto-publishing — **acceptable**: API surface is small, types are simple, manual sync is < 30 sec.
- ✅ No real-time WebSocket — **acceptable**: order tracking via 30s polling is fine for MVP.
- ✅ No offline catalog (no WatermelonDB) — **acceptable**: RQ cache handles 90% of perceived offline value.
- ✅ No cert pinning — **acceptable** for MVP; HTTPS + JWT is the security floor; pinning added in Phase 3.
- ✅ No Maestro E2E — **acceptable** at solo-dev MVP scale; manual QA + RTL unit tests.
- ✅ Sentry/PostHog disabled at launch — **acceptable**: turn on the moment a real user installs.

---

## 6. Backend Changes (Reduced to 4 Essentials)

Down from v2's 9 endpoints. Only what mobile **cannot ship without**:

| # | Endpoint | Purpose | Effort |
|---|---|---|---|
| 1 | `POST /auth/refresh` (verify exists, ensure refresh-token rotation) | Silent re-auth before JWT expiry | ~½ day |
| 2 | `POST /auth/social/apple` | Verify Apple ID token → upsert user → JWT (Apple sign-in is **required** by App Store policy if any social login is offered) | ~1 day |
| 3 | `POST /auth/social/google` | Same for Google | ~½ day (after Apple) |
| 4 | `POST /devices/register` (+ `DELETE /devices/:id`) | Store push token; needed before push goes live in Phase 2 — ship early so we have device records | ~½ day |

**Plus one config tweak:**
- CORS dev origins: add `http://localhost:8081`, `exp://*` (one-line change)

**Deferred to Phase 2:**
- `/notifications` feed, `/search/visual`, OpenAPI export, per-user rate limiting refinement.

**Total backend effort for mobile MVP: ~2.5 days** of API work.

---

## 7. AI-Trust UX Floor (Day-1 Must-Haves)

Per the "Corrected Lean" plan's strongest insight — even without the Sphere or autopilot, customers need to trust the AI recommendations they see.

| Element | Where it appears in MVP | Implementation |
|---|---|---|
| **"Why this recommendation?"** tooltip / bottom sheet | Every recommendation card on Home + Product Detail | Calls `/recommendations/:userId` which returns `explanation` + `component_scores` (already in your ranking engine) |
| **Confidence badge** (e.g., "92% match") | On recommendation cards | Renders `score * 100` from the ranking engine output |
| **Easy override** | Always-visible "Show all" / manual search button | Search tab is a peer of Home, not buried |
| **Component score breakdown** | Inside the "Why" sheet | Bar chart of budget_fit / quality / brand / delivery / ratings |
| **Feedback** | Thumbs up/down on each recommendation | `POST /feedback` to the AI service |

This is what makes a "DelegateCart" mobile app feel different from "yet another store app" — even before the Sphere lands.

---

## 8. Definition of Done — MVP

- [ ] All 9 Phase-1 screens functional
- [ ] Email auth + (before submission) Apple + Google sign-in
- [ ] Recommendations show "Why" + confidence badge
- [ ] Cart persists across app restarts
- [ ] Checkout creates orders successfully against staging API
- [ ] Order list + detail render with pull-to-refresh
- [ ] App boots in < 2s on iPhone 13 / Pixel 6
- [ ] No `console.error` in production logs
- [ ] EAS Build succeeds for both `ios` and `android` profiles
- [ ] Internal TestFlight + Play Internal Testing build distributed
- [ ] Privacy manifest + Data Safety form drafted
- [ ] `README.md` + `ONBOARDING.md` complete

---

## 9. What Comes Next (after you approve this plan)

1. You answer the 14 questions in `MOBILE_APP_DECISION_QUESTIONS.md` (or say "approve defaults").
2. I prepare **two artifacts** (still no code created until you give the go-ahead):
   - **Bootstrap Prompt A** — to scaffold `delegatecart-mobile` end-to-end (Expo init, deps, navigation, screens, services, theme, EAS config, GH Actions CI, README, ONBOARDING).
   - **Bootstrap Prompt B** — small additive PR to `delegatecart` repo (CORS dev origins + the 4 essential backend endpoints + `sync-types.ps1` source-of-truth file).
3. You review both prompts; on your approval, we run them in sequence.
4. First runnable build on Expo Go: ~end of week 1.
5. First TestFlight / Play Internal build: ~end of week 3–4.

---

## 10. Why This Plan Is Different From The Other Three

- **It's honest about cost.** Other plans say "low cost" without enumerating it. This one says: $0/mo through MVP, $99/yr to ship to Apple, optional $19/mo only after release activity grows.
- **It's honest about scope.** The "7–10 day" timelines in the lean plans don't survive contact with App Store review, accessibility audits, and Stripe integration. 3–4 weeks for production-grade MVP is realistic.
- **It cuts the right things.** Sphere, autopilot, WatermelonDB, Skia, SDK pipeline — all deferred. AI-trust UX, secure storage, Apple sign-in — all kept.
- **It pre-funds the upgrade path.** Every deferred item has a documented Phase-2 home and a non-rewrite migration. Nothing painted into a corner.
- **It picks the best of each plan**, not the safest middle ground.

---

*End of plan. Awaiting your review and answers to the 14 questions.*
