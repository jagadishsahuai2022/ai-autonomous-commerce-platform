"""
Comprehensive Unit Tests - Product Ranking Engine Service
Tests for product ranking, scoring, and recommendations
"""

import pytest
from unittest.mock import Mock, patch
from typing import Dict, List
import numpy as np


class MockRankingEngine:
    """Mock Product Ranking Engine"""

    def __init__(self):
        self.weights = {
            "price": 0.3,
            "rating": 0.25,
            "popularity": 0.2,
            "relevance": 0.15,
            "availability": 0.1,
        }
        self.user_preferences = {}

    def score_product(self, product: Dict) -> float:
        """Calculate product score"""
        score = 0

        # Price score (lower is better, inverted)
        max_price = 1000
        price_score = max(0, 1 - (product.get("price", 0) / max_price))
        score += price_score * self.weights["price"]

        # Rating score (0-5)
        rating_score = product.get("rating", 0) / 5.0
        score += rating_score * self.weights["rating"]

        # Popularity score
        popularity_score = product.get("popularity", 0) / 100.0
        score += popularity_score * self.weights["popularity"]

        # Relevance score
        relevance_score = product.get("relevance", 0)
        score += relevance_score * self.weights["relevance"]

        # Availability score
        availability_score = 1 if product.get("availability", True) else 0
        score += availability_score * self.weights["availability"]

        return min(score, 1.0)  # Cap at 1.0

    def rank_products(self, products: List[Dict]) -> List[Dict]:
        """Rank products by score"""
        scored_products = []

        for product in products:
            product["score"] = self.score_product(product)
            scored_products.append(product)

        return sorted(scored_products, key=lambda x: x["score"], reverse=True)

    def set_weights(self, weights: Dict[str, float]):
        """Update ranking weights"""
        if sum(weights.values()) <= 1.0:
            self.weights.update(weights)
        else:
            raise ValueError("Weights must sum to <= 1.0")

    def get_recommendations(
        self, user_id: str, products: List[Dict], count: int = 5
    ) -> List[Dict]:
        """Get personalized recommendations"""
        ranked = self.rank_products(products)
        return ranked[:count]


@pytest.fixture
def engine():
    """Fixture for Ranking Engine"""
    return MockRankingEngine()


class TestProductScoring:
    """Test product scoring functionality"""

    def test_score_high_quality_product(self, engine):
        """Test scoring high-quality product"""
        product = {
            "price": 100,
            "rating": 4.8,
            "popularity": 90,
            "relevance": 0.95,
            "availability": True,
        }

        score = engine.score_product(product)

        assert 0.7 <= score <= 1.0
        assert score > 0

    def test_score_budget_product(self, engine):
        """Test scoring budget product"""
        product = {
            "price": 30,
            "rating": 3.5,
            "popularity": 50,
            "relevance": 0.7,
            "availability": True,
        }

        score = engine.score_product(product)

        assert 0 < score < 1.0

    def test_score_unavailable_product(self, engine):
        """Test scoring unavailable product"""
        product = {
            "price": 100,
            "rating": 4.8,
            "popularity": 90,
            "relevance": 0.95,
            "availability": False,
        }

        score_available = engine.score_product(
            {**product, "availability": True}
        )
        score_unavailable = engine.score_product(product)

        assert score_available > score_unavailable

    def test_score_low_rating_product(self, engine):
        """Test scoring low-rating product"""
        product = {
            "price": 50,
            "rating": 2.0,
            "popularity": 30,
            "relevance": 0.5,
            "availability": True,
        }

        score = engine.score_product(product)

        assert 0 < score < 0.5

    def test_score_missing_fields(self, engine):
        """Test scoring with missing fields"""
        product = {"price": 100}  # Missing most fields

        # Should still calculate score
        score = engine.score_product(product)

        assert isinstance(score, float)
        assert 0 <= score <= 1.0

    def test_score_consistency(self, engine):
        """Test scoring is consistent"""
        product = {
            "price": 100,
            "rating": 4.0,
            "popularity": 70,
            "relevance": 0.8,
            "availability": True,
        }

        score1 = engine.score_product(product)
        score2 = engine.score_product(product)

        assert score1 == score2


class TestProductRanking:
    """Test product ranking functionality"""

    def test_rank_products_by_score(self, engine):
        """Test ranking products"""
        products = [
            {
                "id": 1,
                "price": 50,
                "rating": 3.0,
                "popularity": 40,
                "relevance": 0.6,
                "availability": True,
            },
            {
                "id": 2,
                "price": 100,
                "rating": 5.0,
                "popularity": 100,
                "relevance": 0.95,
                "availability": True,
            },
            {
                "id": 3,
                "price": 75,
                "rating": 4.0,
                "popularity": 70,
                "relevance": 0.8,
                "availability": True,
            },
        ]

        ranked = engine.rank_products(products)

        # Product 2 should be first (highest score)
        assert ranked[0]["id"] == 2
        assert ranked[0]["score"] > ranked[1]["score"]
        assert ranked[1]["score"] > ranked[2]["score"]

    def test_rank_empty_list(self, engine):
        """Test ranking empty product list"""
        ranked = engine.rank_products([])
        assert len(ranked) == 0

    def test_rank_single_product(self, engine):
        """Test ranking single product"""
        products = [
            {
                "id": 1,
                "price": 100,
                "rating": 4.0,
                "popularity": 70,
                "relevance": 0.8,
                "availability": True,
            }
        ]

        ranked = engine.rank_products(products)

        assert len(ranked) == 1
        assert "score" in ranked[0]

    def test_rank_handles_ties(self, engine):
        """Test ranking handles tied scores"""
        products = [
            {
                "id": 1,
                "price": 100,
                "rating": 4.0,
                "popularity": 70,
                "relevance": 0.8,
                "availability": True,
            },
            {
                "id": 2,
                "price": 100,
                "rating": 4.0,
                "popularity": 70,
                "relevance": 0.8,
                "availability": True,
            },
        ]

        ranked = engine.rank_products(products)

        assert len(ranked) == 2
        assert abs(ranked[0]["score"] - ranked[1]["score"]) < 0.001


class TestWeightCustomization:
    """Test weight customization"""

    def test_update_weights(self, engine):
        """Test updating ranking weights"""
        new_weights = {
            "price": 0.5,  # Increase price importance
            "rating": 0.2,  # Decrease rating importance
            "popularity": 0.1,
            "relevance": 0.1,
            "availability": 0.1,
        }

        engine.set_weights(new_weights)

        assert engine.weights["price"] == 0.5
        assert engine.weights["rating"] == 0.2

    def test_reject_invalid_weights(self, engine):
        """Test rejection of invalid weights"""
        invalid_weights = {
            "price": 0.6,
            "rating": 0.6,
            "popularity": 0.6,
            "relevance": 0.6,
            "availability": 0.6,
        }  # Sum > 1

        with pytest.raises(ValueError):
            engine.set_weights(invalid_weights)

    def test_price_sensitive_ranking(self, engine):
        """Test ranking with price as priority"""
        engine.set_weights(
            {
                "price": 0.6,
                "rating": 0.15,
                "popularity": 0.1,
                "relevance": 0.1,
                "availability": 0.05,
            }
        )

        products = [
            {
                "id": 1,
                "price": 50,
                "rating": 3.0,
                "popularity": 40,
                "relevance": 0.6,
                "availability": True,
            },
            {
                "id": 2,
                "price": 200,
                "rating": 5.0,
                "popularity": 100,
                "relevance": 0.95,
                "availability": True,
            },
        ]

        ranked = engine.rank_products(products)

        # Product 1 should rank higher (cheaper)
        assert ranked[0]["id"] == 1

    def test_quality_sensitive_ranking(self, engine):
        """Test ranking with quality as priority"""
        engine.set_weights(
            {
                "price": 0.1,
                "rating": 0.5,
                "popularity": 0.2,
                "relevance": 0.1,
                "availability": 0.1,
            }
        )

        products = [
            {
                "id": 1,
                "price": 50,
                "rating": 3.0,
                "popularity": 40,
                "relevance": 0.6,
                "availability": True,
            },
            {
                "id": 2,
                "price": 200,
                "rating": 5.0,
                "popularity": 100,
                "relevance": 0.95,
                "availability": True,
            },
        ]

        ranked = engine.rank_products(products)

        # Product 2 should rank higher (higher rating)
        assert ranked[0]["id"] == 2


class TestRecommendations:
    """Test recommendation functionality"""

    def test_get_recommendations(self, engine):
        """Test getting recommendations"""
        products = [
            {
                "id": i,
                "price": 50 + i * 20,
                "rating": 3.0 + (i * 0.5),
                "popularity": 40 + (i * 10),
                "relevance": 0.6 + (i * 0.05),
                "availability": True,
            }
            for i in range(10)
        ]

        recommendations = engine.get_recommendations("user-123", products, count=5)

        assert len(recommendations) == 5
        assert all("score" in r for r in recommendations)

    def test_recommendations_respect_count(self, engine):
        """Test recommendations respect count parameter"""
        products = [
            {
                "id": i,
                "price": 100,
                "rating": 4.0,
                "popularity": 70,
                "relevance": 0.8,
                "availability": True,
            }
            for i in range(3)
        ]

        recommendations = engine.get_recommendations(
            "user-123", products, count=10
        )

        # Should return only 3 (all available)
        assert len(recommendations) == 3

    def test_recommendations_sorted_by_score(self, engine):
        """Test recommendations are sorted by score"""
        products = [
            {
                "id": i,
                "price": 50 + i * 20,
                "rating": 3.0 + (i * 0.5),
                "popularity": 40 + (i * 10),
                "relevance": 0.6 + (i * 0.05),
                "availability": True,
            }
            for i in range(10)
        ]

        recommendations = engine.get_recommendations("user-123", products, count=5)

        scores = [r["score"] for r in recommendations]
        assert scores == sorted(scores, reverse=True)


class TestPerformance:
    """Test performance characteristics"""

    def test_rank_large_product_list(self, engine):
        """Test ranking large product lists"""
        products = [
            {
                "id": i,
                "price": np.random.randint(10, 1000),
                "rating": np.random.uniform(1.0, 5.0),
                "popularity": np.random.randint(0, 100),
                "relevance": np.random.uniform(0, 1),
                "availability": np.random.choice([True, False]),
            }
            for i in range(1000)
        ]

        import time

        start = time.time()
        ranked = engine.rank_products(products)
        elapsed = time.time() - start

        assert len(ranked) == 1000
        assert elapsed < 1.0  # Should complete in less than 1 second

    def test_score_calculation_efficiency(self, engine):
        """Test scoring efficiency"""
        product = {
            "id": 1,
            "price": 100,
            "rating": 4.0,
            "popularity": 70,
            "relevance": 0.8,
            "availability": True,
        }

        import time

        start = time.time()
        for _ in range(10000):
            engine.score_product(product)
        elapsed = time.time() - start

        assert elapsed < 1.0  # Should score 10k products < 1 second


class TestErrorHandling:
    """Test error handling"""

    def test_handle_negative_prices(self, engine):
        """Test handling negative prices"""
        product = {
            "id": 1,
            "price": -100,  # Invalid
            "rating": 4.0,
            "popularity": 70,
            "relevance": 0.8,
            "availability": True,
        }

        # Should handle gracefully
        score = engine.score_product(product)
        assert isinstance(score, float)

    def test_handle_invalid_ratings(self, engine):
        """Test handling invalid ratings"""
        product = {
            "id": 1,
            "price": 100,
            "rating": 10.0,  # Invalid (should be 0-5)
            "popularity": 70,
            "relevance": 0.8,
            "availability": True,
        }

        # Should handle gracefully
        score = engine.score_product(product)
        assert 0 <= score <= 1.0

    def test_handle_division_by_zero(self, engine):
        """Test handling division by zero"""
        product = {
            "id": 1,
            "price": 0,
            "rating": 0,
            "popularity": 0,
            "relevance": 0,
            "availability": False,
        }

        # Should not crash
        score = engine.score_product(product)
        assert isinstance(score, float)
        assert score == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
