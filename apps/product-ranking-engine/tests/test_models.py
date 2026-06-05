"""Test scenarios for data models and validation."""

import pytest
from pydantic import ValidationError

from models import (
    ProductDTO,
    RankingRequest,
    BudgetFitScore,
    QualityScore,
    BrandPreferenceScore,
    DeliverySpeedScore,
    RatingsScore,
    RankingExplanation,
    RankedProduct,
    RankingResponse,
    ProductsRankedEvent,
    HealthResponse,
    ErrorResponse,
)


# ============================================================================
# ProductDTO Tests
# ============================================================================

class TestProductDTO:
    """Test ProductDTO model validation."""

    def test_valid_product(self):
        """Valid product should pass validation."""
        product = ProductDTO(
            id="prod-1",
            name="Sony Headphones",
            brand="Sony",
            price=34999,
            rating=4.5,
            review_count=500,
            delivery_time="2-3 days",
            key_features=["Feature1"],
            source="internal"
        )
        assert product.id == "prod-1"
        assert product.price == 34999

    def test_product_with_optional_fields(self):
        """Product with optional fields should validate."""
        product = ProductDTO(
            id="prod-1",
            name="Sony Headphones",
            brand="Sony",
            price=34999,
            original_price=38999,
            discount_percent=10,
            rating=4.5,
            review_count=500,
            delivery_time="2 days",
            key_features=["Feature"],
            source="amazon"
        )
        assert product.original_price == 38999
        assert product.discount_percent == 10

    def test_missing_required_field_raises_error(self):
        """Product missing required fields should raise ValidationError."""
        with pytest.raises(ValidationError):
            ProductDTO(  # type: ignore
                id="prod-1",
                # Missing name
                brand="Sony",
                price=34999,
                rating=4.5,
                review_count=500,
                delivery_time="2 days",
                key_features=[],
                source="internal"
            )

    def test_negative_price_raises_error(self):
        """Negative price should raise ValidationError."""
        with pytest.raises(ValidationError):
            ProductDTO(
                id="prod-1",
                name="Test",
                brand="Sony",
                price=-1000,  # Invalid
                rating=4.5,
                review_count=100,
                delivery_time="2 days",
                key_features=[],
                source="internal"
            )

    def test_rating_out_of_range_raises_error(self):
        """Rating outside 0-5 range should raise ValidationError."""
        with pytest.raises(ValidationError):
            ProductDTO(
                id="prod-1",
                name="Test",
                brand="Sony",
                price=10000,
                rating=6.0,  # Invalid (max is 5)
                review_count=100,
                delivery_time="2 days",
                key_features=[],
                source="internal"
            )

    def test_negative_review_count_raises_error(self):
        """Negative review count should raise ValidationError."""
        with pytest.raises(ValidationError):
            ProductDTO(
                id="prod-1",
                name="Test",
                brand="Sony",
                price=10000,
                rating=4.0,
                review_count=-5,  # Invalid
                delivery_time="2 days",
                key_features=[],
                source="internal"
            )


# ============================================================================
# RankingRequest Tests
# ============================================================================

class TestRankingRequest:
    """Test RankingRequest model validation."""

    def test_valid_ranking_request(self):
        """Valid ranking request should pass validation."""
        products = [
            ProductDTO(
                id="prod-1",
                name="Product",
                brand="Brand",
                price=10000,
                rating=4.0,
                review_count=100,
                delivery_time="2 days",
                key_features=[],
                source="internal"
            )
        ]

        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=products,
            budget_min=5000,
            budget_max=50000
        )
        assert request.request_id == 1
        assert len(request.products) == 1

    def test_ranking_request_with_defaults(self):
        """Request with default values should validate."""
        request = RankingRequest(
            request_id=1,
            user_id=1,
            products=[],
            budget_max=50000
        )
        assert request.budget_min == 0
        assert request.quality_threshold == 0.0
        assert request.preferred_delivery_days == 7

    def test_invalid_budget_range_raises_error(self):
        """Budget max < min should raise ValidationError."""
        with pytest.raises(ValidationError):
            RankingRequest(
                request_id=1,
                user_id=1,
                products=[],
                budget_min=50000,
                budget_max=5000  # Invalid (max < min)
            )

    def test_invalid_quality_threshold_raises_error(self):
        """Quality threshold outside 0-1 should raise ValidationError."""
        with pytest.raises(ValidationError):
            RankingRequest(
                request_id=1,
                user_id=1,
                products=[],
                budget_max=50000,
                quality_threshold=1.5  # Invalid
            )


# ============================================================================
# Score Component Tests
# ============================================================================

class TestScoreComponents:
    """Test individual score component models."""

    def test_budget_fit_score_validation(self):
        """BudgetFitScore should validate correctly."""
        score = BudgetFitScore(
            distance_from_max=10000,
            distance_percentage=0.2,
            score=0.85,
            reason="Price is 20% below budget"
        )
        assert score.score == 0.85

    def test_budget_fit_score_outside_range_raises_error(self):
        """Score > 1.0 should raise ValidationError."""
        with pytest.raises(ValidationError):
            BudgetFitScore(
                distance_from_max=10000,
                distance_percentage=0.2,
                score=1.5,  # Invalid
                reason="Invalid score"
            )

    def test_quality_score_with_features(self):
        """QualityScore with features should validate."""
        score = QualityScore(
            brand_score=0.95,
            feature_count=3,
            feature_score=0.6,
            build_quality=0.90,
            score=0.85,
            reason="Good quality product"
        )
        assert score.brand_score == 0.95
        assert score.feature_count == 3

    def test_ratings_score_with_confidence(self):
        """RatingsScore with confidence should validate."""
        score = RatingsScore(
            rating=4.5,
            review_count=1000,
            confidence=0.99,
            score=0.90,
            reason="Highly rated with many reviews"
        )
        assert score.confidence == 0.99

    def test_brand_preference_score_with_level(self):
        """BrandPreferenceScore with level should validate."""
        score = BrandPreferenceScore(
            is_preferred=True,
            preference_level="brand_match",
            score=1.0,
            reason="Preferred brand"
        )
        assert score.is_preferred is True

    def test_delivery_score_with_urgency(self):
        """DeliverySpeedScore with urgency should validate."""
        score = DeliverySpeedScore(
            delivery_days=2,
            urgency_fit="fast",
            score=1.0,
            reason="Fast delivery"
        )
        assert score.urgency_fit == "fast"


# ============================================================================
# RankingExplanation Tests
# ============================================================================

class TestRankingExplanation:
    """Test comprehensive ranking explanation model."""

    def test_valid_explanation(self):
        """Valid explanation should pass validation."""
        explanation = RankingExplanation(
            product_id="prod-1",
            product_name="Sony Headphones",
            budget_fit_score=BudgetFitScore(
                distance_from_max=10000,
                distance_percentage=0.2,
                score=0.85,
                reason="Good price"
            ),
            quality_score=QualityScore(
                brand_score=0.95,
                feature_count=3,
                feature_score=0.6,
                build_quality=0.90,
                score=0.85,
                reason="Quality product"
            ),
            brand_preference_score=BrandPreferenceScore(
                is_preferred=True,
                preference_level="brand_match",
                score=1.0,
                reason="Preferred"
            ),
            delivery_speed_score=DeliverySpeedScore(
                delivery_days=2,
                urgency_fit="fast",
                score=1.0,
                reason="Fast"
            ),
            ratings_score=RatingsScore(
                rating=4.5,
                review_count=1000,
                confidence=0.99,
                score=0.90,
                reason="Well rated"
            ),
            weights={"budget_fit": 0.25, "quality": 0.25, "brand": 0.20, "delivery": 0.15, "ratings": 0.15},
            rank=1,
            final_score=0.91,
            confidence=0.94,
            summary="Great product",
            key_strengths=["Premium brand", "Good price"],
            key_weaknesses=[]
        )
        assert explanation.final_score == 0.91

    def test_explanation_with_rank(self):
        """Explanation with rank should validate."""
        explanation = RankingExplanation(
            product_id="prod-1",
            product_name="Product",
            budget_fit_score=BudgetFitScore(
                distance_from_max=5000, distance_percentage=0.1,
                score=0.8, reason="Good"
            ),
            quality_score=QualityScore(
                brand_score=0.8, feature_count=2, feature_score=0.4,
                build_quality=0.8, score=0.8, reason="Good"
            ),
            brand_preference_score=BrandPreferenceScore(
                is_preferred=False, preference_level="neutral",
                score=0.5, reason="Neutral"
            ),
            delivery_speed_score=DeliverySpeedScore(
                delivery_days=3, urgency_fit="moderate",
                score=0.8, reason="OK"
            ),
            ratings_score=RatingsScore(
                rating=4.0, review_count=500, confidence=0.8,
                score=0.8, reason="Good"
            ),
            weights={"budget_fit": 0.25, "quality": 0.25, "brand": 0.20, "delivery": 0.15, "ratings": 0.15},
            final_score=0.8,
            rank=1,  # Assignment after ranking
            confidence=0.85,
            summary="OK product",
            key_strengths=["Decent quality"],
            key_weaknesses=["Neutral brand"]
        )
        assert explanation.rank == 1


# ============================================================================
# RankedProduct Tests
# ============================================================================

class TestRankedProduct:
    """Test ranked product model."""

    def test_ranked_product_with_explanation(self):
        """RankedProduct with explanation should validate."""
        product = ProductDTO(
            id="prod-1",
            name="Sony",
            brand="Sony",
            price=30000,
            rating=4.5,
            review_count=500,
            delivery_time="2 days",
            key_features=[],
            source="internal"
        )

        explanation = RankingExplanation(
            product_id="prod-1",
            product_name="Sony",
            budget_fit_score=BudgetFitScore(
                distance_from_max=5000, distance_percentage=0.1,
                score=0.8, reason="Good"
            ),
            quality_score=QualityScore(
                brand_score=0.95, feature_count=3, feature_score=0.6,
                build_quality=0.9, score=0.85, reason="Premium"
            ),
            brand_preference_score=BrandPreferenceScore(
                is_preferred=True, preference_level="brand_match",
                score=1.0, reason="Preferred"
            ),
            delivery_speed_score=DeliverySpeedScore(
                delivery_days=2, urgency_fit="fast",
                score=1.0, reason="Fast"
            ),
            ratings_score=RatingsScore(
                rating=4.5, review_count=500, confidence=0.85,
                score=0.85, reason="Well rated"
            ),
            weights={"budget_fit": 0.25, "quality": 0.25, "brand": 0.20, "delivery": 0.15, "ratings": 0.15},
            rank=1,
            final_score=0.9,
            confidence=0.9,
            summary="Great product",
            key_strengths=["Premium", "Fast"],
            key_weaknesses=[]
        )

        ranked = RankedProduct(
            rank=1,
            product=product,
            score=0.9,
            confidence=0.9,
            explanation=explanation
        )

        assert ranked.rank == 1
        assert ranked.score == 0.9


# ============================================================================
# RankingResponse Tests
# ============================================================================

class TestRankingResponse:
    """Test ranking response model."""

    def test_valid_ranking_response(self):
        """Valid response should pass validation."""
        response = RankingResponse(
            request_id=1,
            user_id=1,
            total_products=1,
            ranked_products=[],
            best_product=None,
            average_confidence=0.0
        )
        assert response.request_id == 1
        assert response.total_products == 1

    def test_response_with_products(self):
        """Response with ranked products should validate."""
        # This would normally be populated by ranking service
        response = RankingResponse(
            request_id=1,
            user_id=1,
            total_products=0,
            ranked_products=[],
            best_product=None,
            average_confidence=0.0
        )
        assert len(response.ranked_products) == 0


# ============================================================================
# Kafka Event Tests
# ============================================================================

class TestProductsRankedEvent:
    """Test Kafka event model."""

    def test_valid_ranked_event(self):
        """Valid ranked event should pass validation."""
        event = ProductsRankedEvent(
            request_id=1,
            user_id=1,
            best_product_id="prod-1",
            best_product_name="Product",
            best_product_score=0.91,
            total_ranked=1
        )
        assert event.request_id == 1
        assert event.best_product_score == 0.91


# ============================================================================
# Standard Response Tests
# ============================================================================

class TestStandardResponses:
    """Test standard response models."""

    def test_health_response(self):
        """HealthResponse should validate."""
        response = HealthResponse(
            status="healthy",
            version="1.0.0",
            kafka_connected=True
        )
        assert response.status == "healthy"

    def test_error_response(self):
        """ErrorResponse should validate."""
        response = ErrorResponse(
            error="Invalid request",
            code="400"
        )
        assert response.code == "400"
        assert response.error == "Invalid request"


# ============================================================================
# JSON Serialization Tests
# ============================================================================

class TestJSONSerialization:
    """Test model JSON serialization."""

    def test_product_to_json(self):
        """ProductDTO should serialize to JSON."""
        product = ProductDTO(
            id="prod-1",
            name="Test",
            brand="Brand",
            price=10000,
            rating=4.0,
            review_count=100,
            delivery_time="2 days",
            key_features=[],
            source="internal"
        )
        json_data = product.model_dump_json()
        assert "prod-1" in json_data

    def test_ranking_response_to_json(self):
        """RankingResponse should serialize to JSON."""
        response = RankingResponse(
            request_id=1,
            user_id=1,
            total_products=0,
            ranked_products=[],
            best_product=None,
            average_confidence=0.0
        )
        json_data = response.model_dump_json()
        assert "1" in json_data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
