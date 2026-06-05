"""Tests for V2 ranking service (22-dimension scoring engine)."""

import pytest
from models import ProductDTO, RankingRequest
from services.ranking_service_v2 import ProductRankingService as RankingServiceV2


@pytest.fixture
def v2_service():
    return RankingServiceV2()


@pytest.fixture
def sample_products():
    return [
        ProductDTO(
            id="prod-1",
            name="Sony WH-1000XM5",
            brand="Sony",
            price=29999,
            rating=4.6,
            review_count=1250,
            delivery_time="2 days",
            key_features=["Active Noise Cancelling", "30hr Battery", "LDAC"],
            source="internal",
            category="headphones",
        ),
        ProductDTO(
            id="prod-2",
            name="JBL Tune 760NC",
            brand="JBL",
            price=4999,
            rating=4.2,
            review_count=800,
            delivery_time="3-5 days",
            key_features=["Active Noise Cancelling", "50hr Battery"],
            source="internal",
            category="headphones",
        ),
        ProductDTO(
            id="prod-3",
            name="boAt Rockerz 450",
            brand="boAt",
            price=1299,
            rating=3.8,
            review_count=5000,
            delivery_time="5-7 days",
            key_features=["40mm Drivers", "15hr Battery"],
            source="internal",
            category="headphones",
        ),
        ProductDTO(
            id="prod-4",
            name="Bose QuietComfort 45",
            brand="Bose",
            price=32999,
            rating=4.7,
            review_count=600,
            delivery_time="1 day",
            key_features=["Active Noise Cancelling", "24hr Battery", "USB-C"],
            source="internal",
            category="headphones",
        ),
    ]


@pytest.fixture
def sample_request(sample_products):
    return RankingRequest(
        request_id=1,
        user_id=42,
        products=sample_products,
        budget_min=10000,
        budget_max=35000,
        preferred_brands=["Sony", "Bose"],
        preferred_delivery_days=5,
        category="headphones",
        intent_brand="sony",
        intent_features=["anc", "battery"],
        use_case="music",
        keywords=["headphones", "noise", "cancelling"],
    )


# ── Ranking correctness ──────────────────────────────────────────────────────

class TestV2RankingCorrectness:

    @pytest.mark.asyncio
    async def test_returns_all_products_ranked(self, v2_service, sample_request):
        resp = await v2_service.rank_products(sample_request)
        assert resp.total_products == 4
        assert len(resp.ranked_products) == 4

    @pytest.mark.asyncio
    async def test_best_product_is_first(self, v2_service, sample_request):
        resp = await v2_service.rank_products(sample_request)
        assert resp.best_product is not None
        assert resp.best_product.rank == 1

    @pytest.mark.asyncio
    async def test_ranks_ascending_from_1(self, v2_service, sample_request):
        resp = await v2_service.rank_products(sample_request)
        for i, rp in enumerate(resp.ranked_products, 1):
            assert rp.rank == i

    @pytest.mark.asyncio
    async def test_scores_descending(self, v2_service, sample_request):
        resp = await v2_service.rank_products(sample_request)
        scores = [rp.score for rp in resp.ranked_products]
        for i in range(len(scores) - 1):
            assert scores[i] >= scores[i + 1]

    @pytest.mark.asyncio
    async def test_preferred_brand_ranked_high(self, v2_service, sample_request):
        """Sony/Bose (preferred brands) should rank above budget brands."""
        resp = await v2_service.rank_products(sample_request)
        top_brands = [rp.product.brand for rp in resp.ranked_products[:2]]
        assert "Sony" in top_brands or "Bose" in top_brands

    @pytest.mark.asyncio
    async def test_over_budget_penalized(self, v2_service, sample_request):
        """Product way over budget should rank lower."""
        sample_request.products[0].price = 80000  # Way over 35k budget
        resp = await v2_service.rank_products(sample_request)
        overpriced = next(rp for rp in resp.ranked_products if rp.product.id == "prod-1")
        assert overpriced.rank > 1  # Should not be #1

    @pytest.mark.asyncio
    async def test_empty_products(self, v2_service):
        req = RankingRequest(
            request_id=1, user_id=1, products=[], budget_max=50000
        )
        resp = await v2_service.rank_products(req)
        assert resp.total_products == 0
        assert resp.best_product is None


# ── Dimension scores in explanation ───────────────────────────────────────────

class TestV2DimensionScores:

    @pytest.mark.asyncio
    async def test_explanation_has_dimension_scores(self, v2_service, sample_request):
        resp = await v2_service.rank_products(sample_request)
        exp = resp.ranked_products[0].explanation
        assert len(exp.dimension_scores) > 0

    @pytest.mark.asyncio
    async def test_dimension_total_positive(self, v2_service, sample_request):
        resp = await v2_service.rank_products(sample_request)
        exp = resp.ranked_products[0].explanation
        assert exp.dimension_total > 0

    @pytest.mark.asyncio
    async def test_explanation_has_strengths(self, v2_service, sample_request):
        resp = await v2_service.rank_products(sample_request)
        exp = resp.ranked_products[0].explanation
        assert len(exp.key_strengths) >= 1

    @pytest.mark.asyncio
    async def test_algorithm_version_is_v2(self, v2_service, sample_request):
        resp = await v2_service.rank_products(sample_request)
        assert resp.algorithm_version == "2.0"


# ── Confidence scoring ────────────────────────────────────────────────────────

class TestV2Confidence:

    @pytest.mark.asyncio
    async def test_confidence_in_range(self, v2_service, sample_request):
        resp = await v2_service.rank_products(sample_request)
        for rp in resp.ranked_products:
            assert 0.0 <= rp.confidence <= 1.0

    @pytest.mark.asyncio
    async def test_high_review_product_higher_confidence(self, v2_service, sample_request):
        resp = await v2_service.rank_products(sample_request)
        boat = next(rp for rp in resp.ranked_products if rp.product.id == "prod-3")
        # boAt has 5000 reviews — should have decent confidence
        assert boat.confidence >= 0.5

    @pytest.mark.asyncio
    async def test_average_confidence_in_range(self, v2_service, sample_request):
        resp = await v2_service.rank_products(sample_request)
        assert 0.0 <= resp.average_confidence <= 1.0


# ── Performance ───────────────────────────────────────────────────────────────

class TestV2Performance:

    @pytest.mark.asyncio
    async def test_rank_4_products_under_100ms(self, v2_service, sample_request):
        import time
        start = time.perf_counter()
        await v2_service.rank_products(sample_request)
        elapsed = time.perf_counter() - start
        assert elapsed < 0.1, f"Ranking 4 products took {elapsed*1000:.0f}ms"

    @pytest.mark.asyncio
    async def test_rank_50_products_under_500ms(self, v2_service, sample_products, sample_request):
        """Simulate ranking 50 products."""
        import time
        products = sample_products * 12 + sample_products[:2]  # 50 products
        for i, p in enumerate(products):
            p.id = f"prod-{i}"
        sample_request.products = products
        start = time.perf_counter()
        resp = await v2_service.rank_products(sample_request)
        elapsed = time.perf_counter() - start
        assert resp.total_products == 50
        assert elapsed < 0.5, f"Ranking 50 products took {elapsed*1000:.0f}ms"


# ── Backwards compatibility ───────────────────────────────────────────────────

class TestV2BackwardsCompat:

    @pytest.mark.asyncio
    async def test_legacy_explanation_fields(self, v2_service, sample_request):
        """Explanation should still have budget_fit_score, quality_score etc."""
        resp = await v2_service.rank_products(sample_request)
        exp = resp.ranked_products[0].explanation
        assert exp.budget_fit_score is not None
        assert exp.quality_score is not None
        assert exp.brand_preference_score is not None
        assert exp.delivery_speed_score is not None
        assert exp.ratings_score is not None

    @pytest.mark.asyncio
    async def test_legacy_weights_dict(self, v2_service, sample_request):
        resp = await v2_service.rank_products(sample_request)
        exp = resp.ranked_products[0].explanation
        assert isinstance(exp.weights, dict)
        assert len(exp.weights) > 0
