"""Comprehensive tests for V2 22-dimension scorer registry."""

import pytest
import math
from services.scorer_registry import (
    ScorerContext,
    execute_scorer,
    SCORERS,
    _get_brand_tier_score,
    _compute_spec_score,
    _compute_warranty_score,
    _compute_verified_rating,
    _compute_return_eligibility,
    _compute_replacement_eligibility,
)


@pytest.fixture
def base_ctx() -> ScorerContext:
    """Base product context."""
    return ScorerContext(
        product_id="prod-1",
        product_name="Sony WH-1000XM5",
        brand="Sony",
        price=29999,
        original_price=34999,
        category="headphones",
        rating=4.6,
        review_count=1250,
        in_stock=True,
        delivery_days_min=1,
        delivery_days_max=2,
        attributes={"driver": "40mm", "anc": "active noise cancelling", "battery": "30hrs"},
        key_features=["Noise-Cancel", "30hr Battery", "LDAC codec"],
        intent_category="headphones",
        intent_brand="sony",
        intent_budget_min=15000,
        intent_budget_max=35000,
        intent_features=["anc", "battery"],
        intent_use_case="music",
        preferred_brands=["Sony", "Bose"],
    )


# ── All 22 scorers exist ─────────────────────────────────────────────────────

class TestScorerRegistry:
    """Verify all 22 scorers are registered."""

    def test_all_22_scorers_registered(self):
        assert len(SCORERS) == 22

    def test_every_scorer_key_callable(self):
        for key, fn in SCORERS.items():
            assert callable(fn), f"Scorer {key} is not callable"

    def test_execute_scorer_unknown_key_returns_0(self):
        ctx = ScorerContext()
        assert execute_scorer("nonexistent", ctx) == 0.0

    def test_execute_scorer_clamps_output(self, base_ctx):
        """All scorers should return [0.0, 1.0]."""
        for key in SCORERS:
            score = execute_scorer(key, base_ctx)
            assert 0.0 <= score <= 1.0, f"Scorer {key} returned {score}"


# ── Intent Group ──────────────────────────────────────────────────────────────

class TestIntentScorers:

    def test_category_match_exact(self, base_ctx):
        score = execute_scorer("categoryMatch", base_ctx)
        assert score == 1.0

    def test_category_match_no_intent(self, base_ctx):
        base_ctx.intent_category = None
        score = execute_scorer("categoryMatch", base_ctx)
        assert score == 0.5

    def test_category_match_mismatch(self, base_ctx):
        base_ctx.intent_category = "laptop"
        score = execute_scorer("categoryMatch", base_ctx)
        assert score == 0.1

    def test_brand_match_exact(self, base_ctx):
        score = execute_scorer("brandMatch", base_ctx)
        assert score == 1.0

    def test_brand_match_no_intent(self, base_ctx):
        base_ctx.intent_brand = None
        score = execute_scorer("brandMatch", base_ctx)
        assert score == 0.0

    def test_brand_match_mismatch(self, base_ctx):
        base_ctx.intent_brand = "bose"
        score = execute_scorer("brandMatch", base_ctx)
        assert score == 0.0

    def test_use_case_match_music(self, base_ctx):
        score = execute_scorer("useCaseMatch", base_ctx)
        assert score > 0.0  # Should find driver/anc/codec attributes

    def test_use_case_match_no_intent(self, base_ctx):
        base_ctx.intent_use_case = None
        score = execute_scorer("useCaseMatch", base_ctx)
        assert score == 0.0

    def test_feature_match_hits(self, base_ctx):
        score = execute_scorer("featureMatch", base_ctx)
        assert score >= 0.5  # "anc" and "battery" should match

    def test_feature_match_no_features(self, base_ctx):
        base_ctx.intent_features = []
        score = execute_scorer("featureMatch", base_ctx)
        assert score == 0.5  # neutral


# ── Quality Group ─────────────────────────────────────────────────────────────

class TestQualityScorers:

    def test_budget_fit_within_range(self, base_ctx):
        score = execute_scorer("budgetFit", base_ctx)
        assert score >= 0.5

    def test_budget_fit_over_budget(self, base_ctx):
        base_ctx.price = 50000
        base_ctx.intent_budget_max = 35000
        score = execute_scorer("budgetFit", base_ctx)
        assert score < 0.5

    def test_budget_fit_no_budget(self, base_ctx):
        base_ctx.intent_budget_max = 999999
        score = execute_scorer("budgetFit", base_ctx)
        assert score == 0.6

    def test_spec_match_many_features(self, base_ctx):
        base_ctx.key_features = list(range(10))
        score = execute_scorer("specMatch", base_ctx)
        assert score >= 0.75

    def test_warranty_coverage(self, base_ctx):
        base_ctx.key_features = ["2 year warranty", "LDAC"]
        score = execute_scorer("warrantyCoverage", base_ctx)
        assert score == 1.0

    def test_manufacturer_profile_premium(self, base_ctx):
        score = execute_scorer("manufacturerProfile", base_ctx)
        assert score >= 0.8  # Sony is premium

    def test_manufacturer_profile_unknown(self, base_ctx):
        base_ctx.brand = "UnknownBrand"
        score = execute_scorer("manufacturerProfile", base_ctx)
        assert 0.4 <= score <= 0.6

    def test_brand_trust_with_preference(self, base_ctx):
        score = execute_scorer("brandTrust", base_ctx)
        assert score >= 0.9  # premium + preferred

    def test_delivery_performance_fast(self, base_ctx):
        score = execute_scorer("deliveryPerformance", base_ctx)
        assert score == 1.0  # 2 days

    def test_delivery_performance_slow(self, base_ctx):
        base_ctx.delivery_days_max = 10
        score = execute_scorer("deliveryPerformance", base_ctx)
        assert score < 0.6

    def test_verified_ratings_high(self, base_ctx):
        score = execute_scorer("verifiedRatings", base_ctx)
        assert score > 0.8

    def test_verified_ratings_zero_reviews(self, base_ctx):
        base_ctx.review_count = 0
        score = execute_scorer("verifiedRatings", base_ctx)
        assert score <= 0.15

    def test_return_eligibility(self, base_ctx):
        base_ctx.key_features = ["30 day return policy", "Free return"]
        score = execute_scorer("returnEligibility", base_ctx)
        assert score == 1.0

    def test_replacement_eligibility(self, base_ctx):
        base_ctx.key_features = ["instant replacement", "1 year warranty"]
        score = execute_scorer("replacementEligibility", base_ctx)
        assert score == 1.0


# ── Engagement Group ──────────────────────────────────────────────────────────

class TestEngagementScorers:

    def test_popularity_high_reviews(self, base_ctx):
        score = execute_scorer("popularity", base_ctx)
        assert score > 0.5

    def test_popularity_no_reviews(self, base_ctx):
        base_ctx.review_count = 0
        score = execute_scorer("popularity", base_ctx)
        assert score == 0.0

    def test_learning_boost_with_signal(self, base_ctx):
        base_ctx.learning_boost = 25.0
        score = execute_scorer("learningBoost", base_ctx)
        assert score == 0.5

    def test_trending_score_high(self, base_ctx):
        score = execute_scorer("trendingScore", base_ctx)
        assert score > 0.5  # High reviews + high rating


# ── Personalization Group ─────────────────────────────────────────────────────

class TestPersonalizationScorers:

    def test_preferred_brand_boost_match(self, base_ctx):
        score = execute_scorer("preferredBrandBoost", base_ctx)
        assert score == 1.0

    def test_preferred_brand_boost_no_match(self, base_ctx):
        base_ctx.brand = "JBL"
        score = execute_scorer("preferredBrandBoost", base_ctx)
        assert score == 0.0

    def test_recent_click_boost(self, base_ctx):
        base_ctx.recent_click_brands = ["Sony"]
        score = execute_scorer("recentClickBoost", base_ctx)
        assert score == 0.7

    def test_price_range_fit_in_range(self, base_ctx):
        base_ctx.user_price_range_min = 20000
        base_ctx.user_price_range_max = 40000
        score = execute_scorer("priceRangeFit", base_ctx)
        assert score == 1.0

    def test_session_affinity_positive(self, base_ctx):
        base_ctx.feedback_boost = 5.0
        score = execute_scorer("sessionAffinity", base_ctx)
        assert score == 0.6


# ── Business Group ────────────────────────────────────────────────────────────

class TestBusinessScorers:

    def test_conversion_potential_high(self, base_ctx):
        score = execute_scorer("conversionPotential", base_ctx)
        assert score > 0.6

    def test_budget_penalty_within_budget(self, base_ctx):
        score = execute_scorer("budgetPenalty", base_ctx)
        assert score == 0.0

    def test_budget_penalty_over_budget(self, base_ctx):
        base_ctx.price = 50000
        base_ctx.intent_budget_max = 35000
        score = execute_scorer("budgetPenalty", base_ctx)
        assert score >= 0.5

    def test_budget_penalty_slightly_over(self, base_ctx):
        base_ctx.price = 37000
        base_ctx.intent_budget_max = 35000
        score = execute_scorer("budgetPenalty", base_ctx)
        assert score == 0.2


# ── Helper functions ──────────────────────────────────────────────────────────

class TestHelpers:

    def test_brand_tier_premium(self):
        assert _get_brand_tier_score("Sony") >= 0.8

    def test_brand_tier_mid(self):
        assert 0.5 < _get_brand_tier_score("JBL") < 0.8

    def test_brand_tier_budget(self):
        assert _get_brand_tier_score("Zebronics") < 0.5

    def test_spec_score_many(self):
        assert _compute_spec_score(["a"] * 10) == 1.0

    def test_spec_score_none(self):
        assert _compute_spec_score([]) == 0.2

    def test_warranty_score_2year(self):
        assert _compute_warranty_score(["2 year warranty"]) == 1.0

    def test_verified_rating_high(self):
        assert _compute_verified_rating(4.5, 1000) > 0.8

    def test_verified_rating_no_reviews(self):
        assert _compute_verified_rating(5.0, 0) == 0.1


# ── Performance Test ──────────────────────────────────────────────────────────

class TestPerformance:

    def test_all_scorers_under_1ms(self, base_ctx):
        """Each scorer should complete in < 1ms."""
        import time
        for key in SCORERS:
            start = time.perf_counter()
            for _ in range(100):
                execute_scorer(key, base_ctx)
            elapsed = (time.perf_counter() - start) / 100
            assert elapsed < 0.001, f"Scorer {key} took {elapsed*1000:.2f}ms"

    def test_score_100_products_under_50ms(self, base_ctx):
        """Scoring 100 products across all 22 dimensions should be < 50ms."""
        import time
        start = time.perf_counter()
        for _ in range(100):
            for key in SCORERS:
                execute_scorer(key, base_ctx)
        elapsed = time.perf_counter() - start
        assert elapsed < 0.05, f"100 products took {elapsed*1000:.0f}ms"
