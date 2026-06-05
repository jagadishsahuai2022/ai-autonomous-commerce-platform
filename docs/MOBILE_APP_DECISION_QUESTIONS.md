# DelegateCart Mobile — Decision Questions (Standalone)

> Extracted from `MOBILE_APP_PLAN_V2.md` §13 for easy review & reply.
> Tick / answer each, or simply reply **"approve defaults"** to accept all recommended values.

---

| # | Question | Recommended Default | Your Answer |
|---|---|---|---|
| Q1 | **Repository topology** — A (monorepo `apps/mobile/`), B (separate repo `delegatecart-mobile`), or C (separate native iOS + Android repos)? | **B** |separate repo `delegatecart-mobile` |
| Q2 | **GitHub Organization name** to host both repos? | `delegatecart` (create new GitHub Org if not yet) | can we leave it for later, i have to decide it not Confired & finalize yet|
| Q3 | **Mobile repo name?** | `delegatecart-mobile` | `delegatecart-mobile` |
| Q4 | **Bundle ID / package name** for both stores? | `com.delegatecart.app` | `com.delegatecart.app` |
| Q5 | **Min OS** — iOS 16, Android 8 (API 26)? | Yes | Yes|
| Q6 | **Phase 1 scope** — Phases 0–2 only (Foundations + Core commerce + Money/trust), OR include Sphere/AI from day one? | Phases 0–2 first | Phases 0–2 only (Foundations + Core commerce + Money/trust) and include Sphere/AI from day one|
| Q7 | **Auth providers** — Email + Apple + Google? Add Phone OTP / Magic-link? | Email + Apple + Google | Email + Add Phone OTP |
| Q8 | **Payments** — Stripe (covers Apple Pay + Google Pay)? Or your existing PSP? | Stripe | Stripe |
| Q9 | **Push** — Expo Notifications (APNs + FCM under the hood)? Or OneSignal / Braze? | Expo Notifications | Expo Notifications |
| Q10 | **Analytics** — PostHog (self-hostable, GDPR friendly), Amplitude, or Mixpanel? | PostHog (free tier) | PostHog (free tier) |
| Q11 | **Backend additions** (`/auth/refresh`, `/auth/social/apple`, `/auth/social/google`, `/devices/register`, `/devices/:id`, `/search/visual`, `/notifications`, CORS dev origins, per-user rate limit, OpenAPI export) — approve all, or subset? | All (~9 small additive endpoints, 1 PR each) | All (~9 small additive endpoints, 1 PR each) |
| Q12 | **Brand fonts** — Inter (web parity) + Geist as display? | Confirm | Confirm |
| Q13 | **Sphere concept** (the Skia-rendered AI orb as the signature interaction) — proceed, or want 2 alternative concepts first? | Proceed | 2 alternative concepts first? |
| Q14 | **Bootstrap prompt** — should I prepare the *single Copilot bootstrap prompt* tailored to your chosen topology once you confirm above? | Yes | Yes |

---

## How to reply

Either:

- **"approve defaults"** — I'll proceed with the recommended values for all 14, OR
- Reply with `Q1: A`, `Q4: com.example.cart`, etc. for any you want to override.
