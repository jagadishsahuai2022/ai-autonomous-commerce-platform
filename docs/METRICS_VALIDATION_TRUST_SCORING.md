# DelegateCart — Metrics Validation & Trust Scoring

> Documentation for the 7-dimension product validation system, trust scoring, and validation chip integration.

---

## Overview

The Metrics Validation page (`/shopping-assistant/metrics/validation`) provides a comprehensive trust assessment for products. It analyzes 7 independent scoring dimensions and presents a unified trust score with detailed breakdowns.

---

## Scoring Dimensions

| # | Dimension | Weight | Description |
|---|-----------|--------|-------------|
| 1 | **Product Specifications** | 20% | Technical specs completeness, accuracy, category-standard compliance |
| 2 | **Delivery Performance** | 15% | On-time delivery rate, average delivery time, return rate over 12 months |
| 3 | **Ratings & Reviews** | 20% | Star distribution, review count, verified purchase ratio, sentiment |
| 4 | **Brand Reputation** | 10% | Brand trust score, years in market, certification count |
| 5 | **Warranty & Support** | 10% | Warranty duration, redemption rate, support response time |
| 6 | **Manufacturer Profile** | 10% | Manufacturer rating, country of origin, facility compliance |
| 7 | **Spec Match** | 15% | How closely product specs match the user's search query/requirements |

---

## Trust Score Calculation

```
Trust Score = Σ (dimension_score × weight) for all 7 dimensions
```

Each dimension scores 0–100. The weighted sum produces a final trust score from 0–100.

### Score Tiers

| Range | Label | Color |
|-------|-------|-------|
| 85–100 | Excellent | Green |
| 70–84 | Good | Blue |
| 50–69 | Fair | Amber |
| 0–49 | Poor | Red |

---

## Validation Chip

The validation chip appears on multiple pages as an entry point to the full validation dashboard.

### Pages with Validation Chip

| Page | Route | Chip Location |
|------|-------|---------------|
| Smart Shopping Assistant | `/shopping-assistant` | Beside "Time Saved" metric |
| Shopping List | `/shopping-list` | Product card actions |
| AI+ | `/ai-plus` | Recommendation cards |
| Smart Delegate | `/smart-delegate` | Delegated item actions |

### Chip Behavior
- Displays trust score as a colored badge (green/blue/amber/red)
- Click navigates to `/shopping-assistant/metrics/validation?from={source-page}`
- The `?from=` parameter enables context-aware back navigation

---

## Back Navigation

The validation page reads `?from=` search parameter to determine the return path:

| `?from=` Value | Back Button Target |
|----------------|-------------------|
| `shopping-assistant` | `/shopping-assistant` |
| `shopping-list` | `/shopping-list` |
| `ai-plus` | `/ai-plus` |
| `smart-delegate` | `/smart-delegate` |
| *(missing)* | `/shopping-assistant` (default) |

---

## Data Panels

### 1. Product Specifications
- Category, brand, model, dimensions, weight
- Technical specs (processor, RAM, storage, etc.)
- Completeness score based on filled fields vs. expected fields

### 2. Delivery Performance (12-Month History)
- Monthly on-time delivery percentage
- Average delivery days per month
- Return rate trend
- Interactive chart visualization

### 3. Ratings & Reviews Analytics
- Star distribution (1–5 stars with percentages)
- Total review count and verified purchase ratio
- Average rating with trend indicator
- Positive/negative sentiment breakdown

### 4. Brand Profile
- Brand name, founding year, headquarters
- Trust index, market presence score
- Certifications and awards
- Industry category ranking

### 5. Warranty & Support
- Warranty type and duration
- Claim/redemption rate
- Average support response time
- Extended warranty availability

### 6. Manufacturer Profile
- Company name, country of origin
- Manufacturing facility compliance score
- Quality certifications (ISO, etc.)
- Production capacity and consistency rating

### 7. Spec Match Analysis
- User query/requirements summary
- Matched specs vs. unmatched specs
- Match percentage
- Recommendations for alternative products if match is low

---

## View Modes

| Mode | Description |
|------|-------------|
| **Current** | Shows validation data for the most recent product interaction |
| **History** | Shows validation history with session timeline navigation |

---

## RBAC Access

| Feature | admin | analytics | aiplus | basic |
|---------|:-----:|:---------:|:------:|:-----:|
| View validation page | ✅ | ✅ | ✅ | ✅ |
| View cross-user analytics | ✅ | ✅ | ❌ | ❌ |
| View detailed breakdowns | ✅ | ✅ | ✅ | ✅ |

Cross-user analytics access is controlled by `canViewAllValidationData()` in `lib/admin-auth.ts`.

---

## Implementation Files

| File | Purpose |
|------|---------|
| `app/shopping-assistant/metrics/validation/page.tsx` | Main validation dashboard (~1100 lines) |
| `lib/scoring/product-scoring.ts` | 7 scoring functions |
| `lib/admin-auth.ts` | RBAC checks for data access |
| `e2e/round35-security-validation-enhancements.spec.ts` | E2E tests (47 specs) |
