"""Tests for dimension weights (DB cache + defaults)."""

import pytest
from services.dimension_weights import (
    DimensionWeightsCache,
    DimensionConfig,
    DEFAULT_DIMENSIONS,
    get_active_dimensions,
    invalidate_cache,
)


class TestDefaultDimensions:

    def test_22_default_dimensions(self):
        assert len(DEFAULT_DIMENSIONS) == 22

    def test_all_dimensions_have_scorer_key(self):
        for d in DEFAULT_DIMENSIONS:
            assert d.scorer_key, f"Dimension {d.key} missing scorer_key"

    def test_all_dimensions_have_group(self):
        for d in DEFAULT_DIMENSIONS:
            assert d.group in ("intent", "quality", "engagement", "personal", "business")

    def test_weights_sum_approximately_1(self):
        total = sum(d.weightage for d in DEFAULT_DIMENSIONS)
        assert abs(total - 1.0) < 0.02, f"Total weight: {total}"

    def test_exactly_one_negative_dimension(self):
        negatives = [d for d in DEFAULT_DIMENSIONS if d.is_negative]
        assert len(negatives) == 1
        assert negatives[0].key == "budget_penalty"

    def test_intent_group_count(self):
        assert len([d for d in DEFAULT_DIMENSIONS if d.group == "intent"]) == 4

    def test_quality_group_count(self):
        assert len([d for d in DEFAULT_DIMENSIONS if d.group == "quality"]) == 9

    def test_engagement_group_count(self):
        assert len([d for d in DEFAULT_DIMENSIONS if d.group == "engagement"]) == 3

    def test_personal_group_count(self):
        assert len([d for d in DEFAULT_DIMENSIONS if d.group == "personal"]) == 4

    def test_business_group_count(self):
        assert len([d for d in DEFAULT_DIMENSIONS if d.group == "business"]) == 2


class TestDimensionWeightsCache:

    def test_cache_returns_defaults_when_no_db(self):
        cache = DimensionWeightsCache()
        dims = cache.get_dimensions()
        assert len(dims) == 22

    def test_cache_hit_on_second_call(self):
        cache = DimensionWeightsCache()
        d1 = cache.get_dimensions()
        d2 = cache.get_dimensions()
        assert d1 is d2  # same object = cache hit

    def test_invalidate_clears_cache(self):
        cache = DimensionWeightsCache()
        cache.get_dimensions()
        cache.invalidate()
        assert cache._cache is None

    def test_get_active_dimensions_returns_list(self):
        invalidate_cache()
        dims = get_active_dimensions()
        assert isinstance(dims, list)
        assert len(dims) >= 1
