"""
Scorer Registry — 22 dimension scorers ported from TypeScript scorer-registry.ts.

Each scorer takes a ScorerContext and returns a float in [0.0, 1.0].
Pure functions, no side-effects, fully testable.
"""

import math
import re
import logging
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ── Scorer context ────────────────────────────────────────────────────────────

@dataclass
class ScorerContext:
    """Context passed to every scoring function."""
    # Product data
    product_id: str = ""
    product_name: str = ""
    brand: str = ""
    price: float = 0.0
    original_price: float = 0.0
    category: str = ""
    sub_category: str = ""
    rating: float = 0.0
    review_count: int = 0
    in_stock: bool = True
    delivery_days_min: int = 3
    delivery_days_max: int = 7
    delivery_free: bool = False
    attributes: Dict[str, str] = field(default_factory=dict)
    features: List[str] = field(default_factory=list)
    key_features: List[str] = field(default_factory=list)
    specifications_features: List[str] = field(default_factory=list)
    specifications_use_cases: List[str] = field(default_factory=list)
    specifications_search_tags: List[str] = field(default_factory=list)
    cod_available: bool = False
    has_emi: bool = False

    # Intent data
    intent_category: Optional[str] = None
    intent_brand: Optional[str] = None
    intent_budget_min: float = 0
    intent_budget_max: float = 999999
    intent_features: List[str] = field(default_factory=list)
    intent_use_case: Optional[str] = None
    intent_keywords: List[str] = field(default_factory=list)

    # User personalization
    preferred_brands: List[str] = field(default_factory=list)
    recent_click_brands: List[str] = field(default_factory=list)
    user_price_range_min: Optional[float] = None
    user_price_range_max: Optional[float] = None

    # Learning/session signals
    learning_boost: float = 0.0
    feedback_boost: float = 0.0


ScorerFunction = Callable[[ScorerContext], float]


# ── Use-case attribute preference maps ────────────────────────────────────────

USE_CASE_ATTR_PREFERENCES: Dict[str, Dict[str, List[str]]] = {
    "gaming": {"gpu": ["rtx 4060", "rtx 4070", "rtx 4080", "rtx 4090"], "processor": ["i7", "i9", "ryzen 7", "ryzen 9"], "display": ["144hz", "165hz", "240hz"], "ram": ["16gb", "32gb"]},
    "office": {"weight": ["1.0", "1.2", "1.4", "1.6"], "battery": ["10hrs", "12hrs", "15hrs", "18hrs", "22hrs"], "display": ["ips", "oled"], "occasion": ["formal", "office", "business"]},
    "student": {"battery": ["10hrs", "12hrs", "15hrs"], "weight": ["1.0", "1.2", "1.4", "1.5", "1.6", "1.7"], "occasion": ["casual", "college"]},
    "coding": {"ram": ["16gb", "32gb"], "processor": ["i7", "i9", "ryzen 7", "ryzen 9", "m3 pro", "m3 max", "core ultra 7", "core ultra 9"], "display": ["qhd", "oled", "2.8k"]},
    "photography": {"camera": ["108mp", "200mp", "quad", "ois"], "display": ["amoled", "oled"]},
    "music": {"driver": ["40mm", "45mm", "50mm"], "anc": ["active noise cancelling", "adaptive anc", "hybrid anc"], "codec": ["ldac", "aptx"]},
    "fitness": {"waterproof": ["ipx4", "ipx5", "ip55", "ip57"], "battery": ["24hrs", "30hrs", "40hrs", "60hrs"]},
    "travel": {"weight": ["1.0", "1.2", "200g", "250g"], "battery": ["10hrs", "12hrs", "15hrs", "18hrs", "22hrs", "30hrs", "40hrs"], "anc": ["active noise cancelling", "adaptive anc"]},
    "entertainment": {"size": ["55", "65", "75", "85"], "panel": ["oled", "qled", "neo qled", "mini led"], "hdr": ["dolby vision", "hdr10+"], "audio": ["dolby atmos", "40w", "60w", "80w"]},
    "home": {"star_rating": ["5 star"], "technology": ["inverter", "dual inverter", "digital inverter"]},
}

# ── Brand tier lookup ─────────────────────────────────────────────────────────

PREMIUM_BRANDS = {"sony", "apple", "bose", "sennheiser", "samsung", "lg", "beats", "dell", "hp", "asus", "lenovo", "dyson"}
MID_BRANDS = {"jbl", "soundcore", "technics", "audio-technica", "oneplus", "poco", "nothing", "realme", "mi", "boat", "acer", "msi"}
BUDGET_BRANDS = {"zebronics", "skullcandy", "ptron", "mivi", "ambrane", "portronics", "micromax", "karbonn"}


def _get_brand_tier_score(brand: str) -> float:
    """Get brand tier score [0,1]."""
    b = brand.lower().strip()
    if b in PREMIUM_BRANDS:
        return 0.9
    if b in MID_BRANDS:
        return 0.65
    if b in BUDGET_BRANDS:
        return 0.4
    return 0.55  # unknown


# ── Delivery parsing ──────────────────────────────────────────────────────────

def _parse_delivery_days(delivery_time: str) -> int:
    """Parse delivery string like '2-3 days' → 3."""
    nums = re.findall(r"\d+", delivery_time)
    return max(int(n) for n in nums) if nums else 7


# ── Spec scoring helpers ──────────────────────────────────────────────────────

def _compute_spec_score(features: List[str]) -> float:
    """Evaluate specification richness."""
    if not features:
        return 0.2
    count = len(features)
    if count >= 8:
        return 1.0
    if count >= 5:
        return 0.75
    if count >= 3:
        return 0.5
    return 0.3


def _compute_warranty_score(features: List[str]) -> float:
    """Evaluate warranty coverage from features."""
    text = " ".join(features).lower()
    if any(w in text for w in ["2 year", "3 year", "5 year", "extended warranty"]):
        return 1.0
    if any(w in text for w in ["1 year", "warranty", "guarantee"]):
        return 0.7
    if "6 month" in text:
        return 0.4
    return 0.2


def _compute_verified_rating(rating: float, review_count: int) -> float:
    """Compute verified rating score."""
    if review_count == 0:
        return 0.1
    rating_norm = rating / 5.0
    if review_count < 10:
        confidence = 0.3
    elif review_count < 100:
        confidence = 0.6
    elif review_count < 1000:
        confidence = 0.85
    else:
        confidence = 0.99
    return rating_norm * confidence


def _compute_return_eligibility(features: List[str]) -> float:
    """Check return eligibility from features."""
    text = " ".join(features).lower()
    if any(w in text for w in ["30 day return", "free return", "easy return", "no questions"]):
        return 1.0
    if any(w in text for w in ["return", "refund", "7 day"]):
        return 0.7
    if any(w in text for w in ["exchange", "replacement"]):
        return 0.5
    return 0.2


def _compute_replacement_eligibility(features: List[str]) -> float:
    """Check replacement eligibility from features."""
    text = " ".join(features).lower()
    if any(w in text for w in ["free replacement", "instant replacement"]):
        return 1.0
    if any(w in text for w in ["replacement", "exchange"]):
        return 0.7
    return 0.2


# ── Individual scorer implementations ─────────────────────────────────────────

def _score_category_match(ctx: ScorerContext) -> float:
    if not ctx.intent_category:
        return 0.5
    return 1.0 if ctx.category.lower() == ctx.intent_category.lower() else 0.1


def _score_brand_match(ctx: ScorerContext) -> float:
    if not ctx.intent_brand:
        return 0.0
    return 1.0 if ctx.brand.lower() == ctx.intent_brand.lower() else 0.0


def _score_use_case_match(ctx: ScorerContext) -> float:
    if not ctx.intent_use_case:
        return 0.0
    prefs = USE_CASE_ATTR_PREFERENCES.get(ctx.intent_use_case)
    if not prefs:
        return 0.0
    hits = 0
    total = len(prefs)
    for attr_key, preferred_values in prefs.items():
        attr_val = ctx.attributes.get(attr_key, "").lower()
        if attr_val and any(pv in attr_val for pv in preferred_values):
            hits += 1
    return hits / total if total > 0 else 0.0


def _score_feature_match(ctx: ScorerContext) -> float:
    if not ctx.intent_features:
        return 0.5
    attr_values = " ".join(ctx.attributes.values()).lower()
    feature_text = " ".join(ctx.key_features).lower()
    combined = attr_values + " " + feature_text + " " + ctx.product_name.lower()
    hits = 0
    for feature in ctx.intent_features:
        kw = feature.lower().replace("_", " ")
        if kw in combined:
            hits += 1
        elif feature.lower() == "anc" and "noise cancell" in combined:
            hits += 1
        elif feature.lower() == "5g" and "5g" in combined:
            hits += 1
    return min(1.0, hits / len(ctx.intent_features))


def _score_budget_fit(ctx: ScorerContext) -> float:
    bmin = ctx.intent_budget_min
    bmax = ctx.intent_budget_max
    if bmax >= 999999:
        return 0.6
    if bmin <= ctx.price <= bmax:
        ratio = ctx.price / bmax if bmax > 0 else 0
        if ratio >= 0.75:
            return 1.0
        if ratio >= 0.5:
            return 0.75
        return 0.5
    if ctx.price <= bmax * 1.1:
        return 0.6
    if ctx.price <= bmax * 1.25:
        return 0.3
    return 0.0


def _score_spec_match(ctx: ScorerContext) -> float:
    all_features = ctx.features + ctx.key_features + ctx.specifications_features
    return _compute_spec_score(all_features)


def _score_warranty_coverage(ctx: ScorerContext) -> float:
    all_features = ctx.features + ctx.key_features + ctx.specifications_features
    return _compute_warranty_score(all_features)


def _score_manufacturer_profile(ctx: ScorerContext) -> float:
    return _get_brand_tier_score(ctx.brand)


def _score_brand_trust(ctx: ScorerContext) -> float:
    score = _get_brand_tier_score(ctx.brand)
    if ctx.preferred_brands and ctx.brand.lower() in [b.lower() for b in ctx.preferred_brands]:
        score = min(1.0, score + 0.1)
    return score


def _score_delivery_performance(ctx: ScorerContext) -> float:
    days = ctx.delivery_days_max
    if days <= 2:
        return 1.0
    if days <= 4:
        return 0.8
    if days <= 7:
        return 0.6
    return max(0.0, 0.5 - (days - 7) * 0.05)


def _score_verified_ratings(ctx: ScorerContext) -> float:
    return _compute_verified_rating(ctx.rating, ctx.review_count)


def _score_return_eligibility(ctx: ScorerContext) -> float:
    all_features = ctx.features + ctx.key_features + ctx.specifications_features
    return _compute_return_eligibility(all_features)


def _score_replacement_eligibility(ctx: ScorerContext) -> float:
    all_features = ctx.features + ctx.key_features + ctx.specifications_features
    return _compute_replacement_eligibility(all_features)


def _score_popularity(ctx: ScorerContext) -> float:
    if ctx.review_count <= 0:
        return 0.0
    return min(1.0, math.log10(ctx.review_count) / 4.48)


def _score_learning_boost(ctx: ScorerContext) -> float:
    return min(1.0, ctx.learning_boost / 50.0)


def _score_trending(ctx: ScorerContext) -> float:
    recency_proxy = 0.5 if ctx.review_count > 1000 else ctx.review_count / 2000
    rating_boost = 0.3 if ctx.rating >= 4.5 else (0.15 if ctx.rating >= 4.0 else 0.0)
    return min(1.0, recency_proxy + rating_boost)


def _score_preferred_brand_boost(ctx: ScorerContext) -> float:
    if not ctx.preferred_brands:
        return 0.0
    return 1.0 if ctx.brand.lower() in [b.lower() for b in ctx.preferred_brands] else 0.0


def _score_recent_click_boost(ctx: ScorerContext) -> float:
    if not ctx.recent_click_brands:
        return 0.0
    return 0.7 if ctx.brand.lower() in [b.lower() for b in ctx.recent_click_brands] else 0.0


def _score_price_range_fit(ctx: ScorerContext) -> float:
    if ctx.user_price_range_min is None or ctx.user_price_range_max is None:
        return 0.5
    if ctx.user_price_range_min <= ctx.price <= ctx.user_price_range_max:
        return 1.0
    if ctx.price < ctx.user_price_range_min:
        return 0.3
    overage = ctx.price / ctx.user_price_range_max if ctx.user_price_range_max > 0 else 2
    if overage <= 1.2:
        return 0.5
    return 0.1


def _score_session_affinity(ctx: ScorerContext) -> float:
    return min(1.0, max(0.0, (ctx.feedback_boost + 10) / 25))


def _score_conversion_potential(ctx: ScorerContext) -> float:
    rating_signal = ctx.rating / 5.0
    volume_signal = min(1.0, math.log10(max(1, ctx.review_count)) / 4.0)
    return rating_signal * 0.6 + volume_signal * 0.4


def _score_budget_penalty(ctx: ScorerContext) -> float:
    bmax = ctx.intent_budget_max
    if bmax >= 999999:
        return 0.0
    if ctx.price <= bmax:
        return 0.0
    overage = ctx.price / bmax
    if overage <= 1.1:
        return 0.2
    if overage <= 1.25:
        return 0.5
    if overage <= 1.5:
        return 0.7
    return 1.0


# ── Registry mapping ──────────────────────────────────────────────────────────

SCORERS: Dict[str, ScorerFunction] = {
    "categoryMatch": _score_category_match,
    "brandMatch": _score_brand_match,
    "useCaseMatch": _score_use_case_match,
    "featureMatch": _score_feature_match,
    "budgetFit": _score_budget_fit,
    "specMatch": _score_spec_match,
    "warrantyCoverage": _score_warranty_coverage,
    "manufacturerProfile": _score_manufacturer_profile,
    "brandTrust": _score_brand_trust,
    "deliveryPerformance": _score_delivery_performance,
    "verifiedRatings": _score_verified_ratings,
    "returnEligibility": _score_return_eligibility,
    "replacementEligibility": _score_replacement_eligibility,
    "popularity": _score_popularity,
    "learningBoost": _score_learning_boost,
    "trendingScore": _score_trending,
    "preferredBrandBoost": _score_preferred_brand_boost,
    "recentClickBoost": _score_recent_click_boost,
    "priceRangeFit": _score_price_range_fit,
    "sessionAffinity": _score_session_affinity,
    "conversionPotential": _score_conversion_potential,
    "budgetPenalty": _score_budget_penalty,
}


def execute_scorer(scorer_key: str, ctx: ScorerContext) -> float:
    """Execute a scorer by key, clamped to [0, 1]. Returns 0 if not found."""
    fn = SCORERS.get(scorer_key)
    if not fn:
        return 0.0
    try:
        raw = fn(ctx)
        return max(0.0, min(1.0, raw))
    except Exception as e:
        logger.warning(f"Scorer {scorer_key} failed: {e}")
        return 0.0
