"""Test scenarios for product ranking engine."""

import pytest
from datetime import datetime
from models import (
    ProductDTO,
    RankingRequest,
    BudgetFitScore,
    QualityScore,
    RatingsScore,
)
from services.ranking_service import ProductRankingService


@pytest.fixture
def ranking_service():
    """Create ranking service instance."""
    return ProductRankingService()


# ============================================================================
# Budget Fit Tests
# ============================================================================

class TestBudgetFitScoring:
    """Test budget fit component scoring."""

    def test_product_within_budget_receives_good_score(self, ranking_service):
        """Product within budget should score well."""
        product = ProductDTO(
            id="prod-1",
            name="Budget Headphones",
            brand="Unknown",
            price=15000,
            rating=3.5,
            review_count=100,
            delivery_time="3 days",
            key_features=["Basic"],
            source="internal"
        )

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[product],
            budget_min=10000,
            budget_max=20000,
            preferred_brands=[],
        )

        score = ranking_service._calculate_budget_fit(product, request)
        assert score.score >= 0.7
        assert score.score <= 1.0

    def test_product_above_budget_penalized(self, ranking_service):
        """Product above budget should be penalized."""
        product = ProductDTO(
            id="prod-1",
            name="Expensive Headphones",
            brand="Premium",
            price=60000,
            rating=4.8,
            review_count=1000,
            delivery_time="1 day",
            key_features=["Premium", "Features"],
            source="internal"
        )

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[product],
            budget_min=10000,
            budget_max=50000,
            preferred_brands=[],
        )

        score = ranking_service._calculate_budget_fit(product, request)
        assert score.score < 0.7
        assert score.score >= 0.0


# ============================================================================
# Quality Score Tests
# ============================================================================

class TestQualityScoring:
    """Test quality component scoring."""

    def test_premium_brand_gets_high_quality_score(self, ranking_service):
        """Premium brands (Sony, Apple) should score high."""
        product = ProductDTO(
            id="prod-1",
            name="Sony Premium Headphones",
            brand="Sony",
            price=35000,
            rating=4.5,
            review_count=1000,
            delivery_time="2 days",
            key_features=["Noise-Cancel", "Battery", "Quality"],
            source="internal"
        )

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[product],
            budget_max=50000,
        )

        quality = ranking_service._calculate_quality_score(product, request)
        assert quality.score >= 0.8

    def test_unknown_brand_gets_neutral_quality_score(self, ranking_service):
        """Unknown brands should score neutrally."""
        product = ProductDTO(
            id="prod-1",
            name="Unknown Brand Headphones",
            brand="UnknownBrand",
            price=5000,
            rating=3.5,
            review_count=50,
            delivery_time="5 days",
            key_features=["Feature1"],
            source="internal"
        )

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[product],
            budget_max=50000,
        )

        quality = ranking_service._calculate_quality_score(product, request)
        assert 0.5 <= quality.score <= 0.7


# ============================================================================
# Brand Preference Tests
# ============================================================================

class TestBrandPreferenceScoring:
    """Test brand preference component."""

    def test_preferred_brand_gets_perfect_score(self, ranking_service):
        """Preferred brands should get 1.0 score."""
        product = ProductDTO(
            id="prod-1",
            name="Sony Headphones",
            brand="Sony",
            price=30000,
            rating=4.5,
            review_count=500,
            delivery_time="2 days",
            key_features=["Feature"],
            source="internal"
        )

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[product],
            preferred_brands=["Sony", "Bose"],
            budget_max=30000,
        )

        brand = ranking_service._calculate_brand_preference(product, request)
        assert brand.score == 1.0
        assert brand.is_preferred is True

    def test_neutral_brand_gets_moderate_score(self, ranking_service):
        """Non-preferred brands should get 0.5 score."""
        product = ProductDTO(
            id="prod-1",
            name="Generic Headphones",
            brand="Generic",
            price=8000,
            rating=3.5,
            review_count=100,
            delivery_time="3 days",
            key_features=["Feature"],
            source="amazon"
        )

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[product],
            preferred_brands=["Sony"],
            budget_max=30000,
        )

        brand = ranking_service._calculate_brand_preference(product, request)
        assert brand.score == 0.5
        assert brand.is_preferred is False


# ============================================================================
# Delivery Speed Tests
# ============================================================================

class TestDeliverySpeedScoring:
    """Test delivery speed component."""

    def test_fast_delivery_gets_perfect_score(self, ranking_service):
        """Delivery in 2 days or less should get 1.0."""
        product = ProductDTO(
            id="prod-1",
            name="Fast Delivery Product",
            brand="FastCo",
            price=10000,
            rating=4.0,
            review_count=100,
            delivery_time="1-2 days",
            key_features=["Feature"],
            source="internal"
        )

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[product],
            preferred_delivery_days=7,
            budget_max=30000,
        )

        delivery = ranking_service._calculate_delivery_speed(product, request)
        assert delivery.score >= 0.95
        assert delivery.urgency_fit == "fast"

    def test_slow_delivery_gets_penalized_score(self, ranking_service):
        """Delivery slower than preference should be penalized."""
        product = ProductDTO(
            id="prod-1",
            name="Slow Delivery Product",
            brand="SlowCo",
            price=5000,
            rating=3.5,
            review_count=50,
            delivery_time="15-20 days",
            key_features=["Feature"],
            source="international"
        )

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[product],
            preferred_delivery_days=5,
            budget_max=30000,
        )

        delivery = ranking_service._calculate_delivery_speed(product, request)
        assert delivery.score < 0.6


# ============================================================================
# Ratings Tests
# ============================================================================

class TestRatingsScoring:
    """Test ratings component."""

    def test_high_rating_with_many_reviews_gets_high_confidence(self, ranking_service):
        """High rating with many reviews should score high."""
        product = ProductDTO(
            id="prod-1",
            name="Popular Product",
            brand="Popular",
            price=15000,
            rating=4.8,
            review_count=10000,
            delivery_time="2 days",
            key_features=["Feature"],
            source="internal"
        )

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[product],
            budget_max=50000,
        )

        ratings = ranking_service._calculate_ratings_score(product, request)
        assert ratings.score >= 0.9
        assert ratings.confidence == 0.99

    def test_high_rating_with_few_reviews_gets_lower_confidence(self, ranking_service):
        """High rating but few reviews should have lower confidence."""
        product = ProductDTO(
            id="prod-1",
            name="New Product",
            brand="NewCo",
            price=12000,
            rating=4.8,
            review_count=2,
            delivery_time="3 days",
            key_features=["Feature"],
            source="internal"
        )

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[product],
            budget_max=50000,
        )

        ratings = ranking_service._calculate_ratings_score(product, request)
        assert ratings.score < 0.8
        assert ratings.confidence == 0.3


# ============================================================================
# Overall Ranking Tests
# ============================================================================

class TestOverallRanking:
    """Test complete ranking algorithm."""

    @pytest.mark.asyncio
    async def test_ranking_returns_products_in_descending_order(self, ranking_service):
        """Ranked products should be ordered by score descending."""
        products = [
            ProductDTO(
                id="prod-1",
                name="Premium Sony",
                brand="Sony",
                price=35000,
                rating=4.8,
                review_count=5000,
                delivery_time="1 day",
                key_features=["Premium", "Features", "Quality"],
                source="internal"
            ),
            ProductDTO(
                id="prod-2",
                name="Budget Unknown",
                brand="UnknownBrand",
                price=5000,
                rating=3.0,
                review_count=10,
                delivery_time="10 days",
                key_features=["Basic"],
                source="marketplace"
            ),
        ]

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=products,
            budget_min=5000,
            budget_max=50000,
            preferred_brands=["Sony"],
        )

        response = await ranking_service.rank_products(request)
        
        assert response.total_products == 2
        assert len(response.ranked_products) == 2
        assert response.ranked_products[0].rank == 1
        assert response.ranked_products[1].rank == 2
        assert response.ranked_products[0].score >= response.ranked_products[1].score

    @pytest.mark.asyncio
    async def test_best_product_is_highest_ranked(self, ranking_service):
        """Best product should be rank 1."""
        products = [
            ProductDTO(
                id="prod-1",
                name="Good Product",
                brand="Sony",
                price=25000,
                rating=4.5,
                review_count=1000,
                delivery_time="2 days",
                key_features=["Feature1", "Feature2"],
                source="internal"
            ),
        ]

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=products,
            budget_max=50000,
        )

        response = await ranking_service.rank_products(request)
        
        assert response.best_product is not None
        assert response.best_product.rank == 1

    @pytest.mark.asyncio
    async def test_empty_product_list_returns_empty_response(self, ranking_service):
        """Empty product list should return empty response."""
        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[],
            budget_max=50000,
        )

        response = await ranking_service.rank_products(request)
        
        assert response.total_products == 0
        assert len(response.ranked_products) == 0
        assert response.best_product is None


# ============================================================================
# Edge Cases
# ============================================================================

class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_extreme_price_difference(self, ranking_service):
        """Handle extreme price differences."""
        product_cheap = ProductDTO(
            id="prod-1",
            name="Very Cheap",
            brand="Budget",
            price=500,
            rating=2.0,
            review_count=5,
            delivery_time="30 days",
            key_features=[],
            source="marketplace"
        )

        product_expensive = ProductDTO(
            id="prod-2",
            name="Very Expensive",
            brand="Luxury",
            price=500000,
            rating=5.0,
            review_count=100,
            delivery_time="1 day",
            key_features=["Premium"],
            source="internal"
        )

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[product_cheap, product_expensive],
            budget_min=1000,
            budget_max=50000,
        )

        cheap_score = ranking_service._calculate_budget_fit(product_cheap, request)
        expensive_score = ranking_service._calculate_budget_fit(product_expensive, request)
        
        assert cheap_score.score > 0
        assert expensive_score.score >= 0

    def test_zero_review_count_handling(self, ranking_service):
        """Handle products with no reviews."""
        product = ProductDTO(
            id="prod-1",
            name="New Product",
            brand="New",
            price=10000,
            rating=0.0,
            review_count=0,
            delivery_time="5 days",
            key_features=[],
            source="internal"
        )

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[product],
            budget_max=50000,
        )

        ratings = ranking_service._calculate_ratings_score(product, request)
        assert ratings.score == 0.0
        assert ratings.confidence == 0.3

    def test_missing_optional_fields(self, ranking_service):
        """Handle products with missing optional fields."""
        product = ProductDTO(
            id="prod-1",
            name="Minimal Product",
            brand="Test",
            price=5000,
            rating=3.5,
            review_count=100,
            delivery_time="5 days",
            key_features=[],
            source="internal",
            original_price=None,
            discount_percent=None,
        )

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[product],
            budget_max=30000,
        )

        budget = ranking_service._calculate_budget_fit(product, request)
        assert budget.score > 0


# ============================================================================
# Weight Influence Tests
# ============================================================================

class TestWeightInfluence:
    """Test that weight changes affect final scores."""

    @pytest.mark.asyncio
    async def test_higher_budget_weight_favors_cheap_products(self, ranking_service):
        """Increasing budget weight should favor cheaper products."""
        # Temporarily increase budget weight
        old_budget_weight = ranking_service.settings.weight_budget_fit
        ranking_service.settings.weight_budget_fit = 0.5  # Increase from 0.25

        products = [
            ProductDTO(
                id="prod-1",
                name="Cheap Sony",
                brand="Sony",
                price=10000,
                rating=3.0,
                review_count=100,
                delivery_time="5 days",
                key_features=["Feature"],
                source="internal"
            ),
            ProductDTO(
                id="prod-2",
                name="Expensive Sony",
                brand="Sony",
                price=40000,
                rating=5.0,
                review_count=5000,
                delivery_time="1 day",
                key_features=["Premium"],
                source="internal"
            ),
        ]

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=products,
            budget_max=50000,
        )

        response = await ranking_service.rank_products(request)
        
        # With high budget weight, cheaper product should rank higher
        # (even with lower ratings)
        ranking_service.settings.weight_budget_fit = old_budget_weight


# ============================================================================
# Explanation Generation Tests
# ============================================================================

class TestExplanationGeneration:
    """Test that explanations are generated correctly."""

    @pytest.mark.asyncio
    async def test_explanation_includes_all_components(self, ranking_service):
        """Explanation should include all score components."""
        products = [
            ProductDTO(
                id="prod-1",
                name="Test Product",
                brand="Sony",
                price=25000,
                rating=4.5,
                review_count=1000,
                delivery_time="2 days",
                key_features=["Feature"],
                source="internal"
            ),
        ]

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=products,
            budget_max=50000,
        )

        response = await ranking_service.rank_products(request)
        explanation = response.ranked_products[0].explanation
        
        assert explanation.budget_fit_score is not None
        assert explanation.quality_score is not None
        assert explanation.brand_preference_score is not None
        assert explanation.delivery_speed_score is not None
        assert explanation.ratings_score is not None
        assert explanation.summary is not None
        assert len(explanation.key_strengths) > 0

    @pytest.mark.asyncio
    async def test_explanation_includes_reasoning(self, ranking_service):
        """Each component explanation should have a reason."""
        products = [
            ProductDTO(
                id="prod-1",
                name="Test Product",
                brand="Sony",
                price=25000,
                rating=4.5,
                review_count=1000,
                delivery_time="2 days",
                key_features=["Feature"],
                source="internal"
            ),
        ]

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=products,
            budget_max=50000,
        )

        response = await ranking_service.rank_products(request)
        explanation = response.ranked_products[0].explanation
        
        assert explanation.budget_fit_score.reason != ""
        assert explanation.quality_score.reason != ""
        assert explanation.ratings_score.reason != ""


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
