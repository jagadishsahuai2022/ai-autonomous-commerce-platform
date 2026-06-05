from ds_python_interpreter import create_document

content = """# DelegateCart Mobile — Refined Plan v3

> **Status:** Finalized for Bootstrap.
> **Supersedes:** v2 (Complex Monorepo/SDK assumptions).
> **Objective:** Low-cost, high-velocity Customer-only app.

---

## 1. Executive Summary

| Requirement | Decision |
|---|---|
| **Repo Strategy** | **Separate Repo (`delegatecart-mobile`)**. No automated SDK/Publishing pipeline. |
| **User Scope** | **Customer Only** (Roles: Basic & AI+). All other roles use the Web UI. |
| **UI/UX Strategy** | **Web-to-Mobile Mirroring**. Reuse existing Web design language, optimized for native mobile performance. |
| **Tech Stack** | React Native 0.75.x + Expo SDK 54 (Managed Workflow) + TypeScript. |
| **Cost Profile** | **Minimal**. Avoids high CI costs and premature infrastructure. |

---

## 2. Simplified Repository Strategy (The "Option B-Light")

We will proceed with a separate repository to isolate mobile development from the backend/web CI strain, but without the "Enterprise" overhead of v2.

* **No Publishing Pipeline:** Instead of a complex GitHub Packages/SDK setup, we will use a simple shared `types` folder or a direct file-sync script for API definitions.
* **Lightweight CI:** GitHub Actions will only run basic Lint/Typecheck. Binary builds will be handled via **Expo EAS** (Free Tier) to keep infrastructure costs at zero.
* **Windows-Friendly:** Since the core dev environment is Windows, we will use the **Expo Managed Workflow**. This allows development and testing on Android/iOS (via Expo Go) without needing a Mac until the final App Store submission.

---

## 3. UI/UX: Web Consistency & Mobile Optimization

Since the website UI is "almost ready," we will leverage those assets to ensure the brand feels identical across platforms.

* **Design Translation:** Use the existing Web color palette, typography (Inter/Geist), and component logic.
* **Mobile-First Corrections:**
    * **Touch Targets:** Increase button heights to minimum 44pt.
    * **Navigation:** Replace web-style top-bars with a native **Bottom Tab Bar** for thumb-reachability.
    * **Gesture Optimization:** Implement "Swipe to Delete" for cart items and "Pull to Refresh" for order tracking.
* **Simplified Components:** Avoid porting complex web-only tables; use **Vertical List Cards** for order history and product listings.

---

## 4. Feature Scope (Customer Role Only)

To keep costs low and focus sharp, the app will strictly serve the "Customer" and "AI Plus" segments.

### Phase 1: Core Commerce (Basic Role)
* **Auth:** Email/Social login optimized for mobile (One-tap Google/Apple).
* **Search/Discovery:** Mobile-optimized grid view of products.
* **Cart & Checkout:** Streamlined Stripe integration (Apple/Google Pay support).

### Phase 2: AI Plus Experience
* **Sphere Interface:** A refined, high-performance mobile version of the AI Assistant.
* **Intent Monitoring:** Real-time push notifications for AI agent updates (e.g., "Agent found a better price").
* **Subscription Management:** Mobile-native flow for AI+ tier upgrades.

---

## 5. Cost-Saving Measures

* **Shared Types:** Manual sync of Prisma types to avoid private npm registry costs.
* **Expo Go:** Use for 95% of development to eliminate the need for local Xcode/Android Studio overhead.
* **Selective SDK:** Only add native modules that are absolutely necessary (Biometrics, Push, Camera).
* **PostHog/Sentry:** Stick to free-tier usage by limiting event volume during the beta phase.

---

## 6. Immediate Next Steps

1.  **Repo Initialization:** Create `delegatecart-mobile`.
2.  **Web Asset Audit:** Extract CSS variables and SVG assets from the "almost ready" website for injection into the RN Theme.
3.  **Bootstrap Prompt:** I will now prepare the **Single Copilot Bootstrap Prompt** that generates this specific, simplified architecture.
"""

create_document(filename="DELEGATE_CART_MOBILE_V3_REFINED.md", content=content)