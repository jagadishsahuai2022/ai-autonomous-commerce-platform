"""Dimension weights loader with DB caching — mirrors the TypeScript dimension-weights.ts."""

import logging
import time
import os
from typing import List, Optional, Dict
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 60


@dataclass
class DimensionConfig:
    """Single scoring dimension configuration."""
    key: str
    label: str
    weightage: float
    group: str
    scorer_key: str
    is_active: bool = True
    is_negative: bool = False
    min_weightage: float = 0.0
    max_weightage: float = 0.25


# ── Default 22 dimensions (fallback when DB is unavailable) ───────────────────

DEFAULT_DIMENSIONS: List[DimensionConfig] = [
    # Intent group
    DimensionConfig("category_match", "Category Match", 0.09, "intent", "categoryMatch"),
    DimensionConfig("brand_match", "Brand Match", 0.04, "intent", "brandMatch"),
    DimensionConfig("use_case_match", "Use Case Match", 0.03, "intent", "useCaseMatch"),
    DimensionConfig("feature_match", "Feature Match", 0.05, "intent", "featureMatch"),
    # Quality group
    DimensionConfig("budget_fit", "Budget Fit", 0.09, "quality", "budgetFit"),
    DimensionConfig("spec_match", "Spec Match", 0.07, "quality", "specMatch"),
    DimensionConfig("warranty_coverage", "Warranty Coverage", 0.05, "quality", "warrantyCoverage"),
    DimensionConfig("manufacturer_profile", "Manufacturer Profile", 0.04, "quality", "manufacturerProfile"),
    DimensionConfig("brand_trust", "Brand Trust", 0.04, "quality", "brandTrust"),
    DimensionConfig("delivery_performance", "Delivery Performance", 0.05, "quality", "deliveryPerformance"),
    DimensionConfig("verified_ratings", "Verified Ratings", 0.07, "quality", "verifiedRatings"),
    DimensionConfig("eligible_for_return", "Eligible For Return", 0.04, "quality", "returnEligibility"),
    DimensionConfig("eligible_for_replacement", "Eligible For Replacement", 0.04, "quality", "replacementEligibility"),
    # Engagement group
    DimensionConfig("popularity", "Popularity", 0.04, "engagement", "popularity"),
    DimensionConfig("learning_boost", "Learning Boost", 0.03, "engagement", "learningBoost"),
    DimensionConfig("trending_score", "Trending Score", 0.02, "engagement", "trendingScore"),
    # Personal group
    DimensionConfig("preferred_brand_boost", "Preferred Brand Boost", 0.03, "personal", "preferredBrandBoost"),
    DimensionConfig("recent_click_boost", "Recent Click Boost", 0.02, "personal", "recentClickBoost"),
    DimensionConfig("price_range_fit", "Price Range Fit", 0.02, "personal", "priceRangeFit"),
    DimensionConfig("session_affinity", "Session Affinity", 0.02, "personal", "sessionAffinity"),
    # Business group
    DimensionConfig("conversion_potential", "Conversion Potential", 0.06, "business", "conversionPotential"),
    DimensionConfig("budget_penalty", "Budget Penalty", 0.06, "business", "budgetPenalty", is_negative=True),
]


class DimensionWeightsCache:
    """Thread-safe dimension weights cache with DB loading."""

    def __init__(self):
        self._cache: Optional[List[DimensionConfig]] = None
        self._cache_time: float = 0.0
        self._db_url: Optional[str] = None

    def _get_db_url(self) -> Optional[str]:
        """Build DB URL from environment."""
        if self._db_url:
            return self._db_url
        host = os.environ.get("DB_HOST", "postgres")
        port = os.environ.get("DB_PORT", "5432")
        name = os.environ.get("DB_NAME", "delegatecart")
        user = os.environ.get("DB_USER", "admin")
        password = os.environ.get("DB_PASSWORD", "password")
        self._db_url = f"postgresql://{user}:{password}@{host}:{port}/{name}"
        return self._db_url

    def get_dimensions(self) -> List[DimensionConfig]:
        """Get active dimensions, loading from DB if cache is stale."""
        now = time.time()
        if self._cache and (now - self._cache_time) < CACHE_TTL_SECONDS:
            return self._cache

        try:
            dims = self._load_from_db()
            if dims:
                self._cache = dims
                self._cache_time = now
                logger.info(f"Loaded {len(dims)} dimensions from DB")
                return dims
        except Exception as e:
            logger.warning(f"Failed to load dimensions from DB: {e}")

        if self._cache:
            return self._cache

        logger.info("Using default dimensions (DB unavailable)")
        self._cache = DEFAULT_DIMENSIONS
        self._cache_time = now
        return self._cache

    def _load_from_db(self) -> Optional[List[DimensionConfig]]:
        """Load dimensions from PostgreSQL ScoringDimension table."""
        db_url = self._get_db_url()
        if not db_url:
            return None

        try:
            import psycopg2
        except ImportError:
            logger.warning("psycopg2 not available, using defaults")
            return None

        conn = psycopg2.connect(db_url)
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT key, label, weightage, "isActive",
                           "group", "scorerKey", "isNegative",
                           "minWeightage", "maxWeightage"
                    FROM "ScoringDimension"
                    WHERE "isActive" = true
                    ORDER BY id
                """)
                rows = cur.fetchall()
                if not rows:
                    return None

                dims = []
                for row in rows:
                    dims.append(DimensionConfig(
                        key=row[0],
                        label=row[1],
                        weightage=float(row[2]),
                        is_active=bool(row[3]),
                        group=row[4] or "quality",
                        scorer_key=row[5] or row[0],
                        is_negative=bool(row[6]) if row[6] is not None else False,
                        min_weightage=float(row[7]) if row[7] is not None else 0.0,
                        max_weightage=float(row[8]) if row[8] is not None else 0.25,
                    ))
                return dims
        finally:
            conn.close()

    def invalidate(self):
        """Force cache invalidation."""
        self._cache = None
        self._cache_time = 0.0


# Global singleton
_cache = DimensionWeightsCache()


def get_active_dimensions() -> List[DimensionConfig]:
    """Get active scoring dimensions (cached, 60s TTL)."""
    return _cache.get_dimensions()


def invalidate_cache():
    """Force-invalidate the dimension cache."""
    _cache.invalidate()
