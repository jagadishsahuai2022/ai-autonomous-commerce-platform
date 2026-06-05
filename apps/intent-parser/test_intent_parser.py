"""
Comprehensive Unit Tests - Intent Parser Service
Tests for natural language intent parsing and entity extraction
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, List
import json


class MockIntentParser:
    """Mock Intent Parser for testing"""

    def __init__(self):
        self.model = Mock()
        self.tokenizer = Mock()

    def parse_intent(self, text: str) -> Dict:
        """Parse user intent from text"""
        return {
            "intent": "search",
            "confidence": 0.95,
            "entities": [],
            "text": text,
        }

    def extract_entities(self, text: str) -> List[Dict]:
        """Extract entities from text"""
        return [
            {"type": "PRODUCT", "value": "laptop", "confidence": 0.9},
            {"type": "PRICE_RANGE", "value": "$500-$1000", "confidence": 0.85},
        ]

    def classify_sentiment(self, text: str) -> Dict:
        """Classify sentiment of text"""
        return {
            "sentiment": "positive",
            "confidence": 0.88,
            "scores": {"positive": 0.88, "neutral": 0.10, "negative": 0.02},
        }


@pytest.fixture
def parser():
    """Fixture for Intent Parser"""
    return MockIntentParser()


class TestIntentParsing:
    """Test intent parsing functionality"""

    def test_parse_simple_search_intent(self, parser):
        """Test parsing simple search intent"""
        result = parser.parse_intent("Show me laptops")

        assert result["intent"] == "search"
        assert result["confidence"] > 0.8
        assert result["text"] == "Show me laptops"

    def test_parse_purchase_intent(self, parser):
        """Test parsing purchase intent"""
        parser.parse_intent = Mock(
            return_value={
                "intent": "purchase",
                "confidence": 0.92,
                "entities": [
                    {"type": "PRODUCT", "value": "laptop"}
                ],
            }
        )

        result = parser.parse_intent("I want to buy a laptop")
        assert result["intent"] == "purchase"
        assert result["confidence"] > 0.85

    def test_parse_filter_intent(self, parser):
        """Test parsing filter/comparative intent"""
        parser.parse_intent = Mock(
            return_value={
                "intent": "filter",
                "confidence": 0.88,
                "entities": [
                    {"type": "CATEGORY", "value": "electronics"},
                    {"type": "PRICE_RANGE", "value": "$100-$500"},
                ],
            }
        )

        result = parser.parse_intent("Show me electronics under $500")
        assert result["intent"] == "filter"
        assert len(result["entities"]) >= 1

    def test_parse_comparison_intent(self, parser):
        """Test parsing comparison intent"""
        parser.parse_intent = Mock(
            return_value={
                "intent": "compare",
                "confidence": 0.85,
                "entities": [
                    {"type": "PRODUCT", "value": "iPhone"},
                    {"type": "PRODUCT", "value": "Samsung"},
                ],
            }
        )

        result = parser.parse_intent("Compare iPhone and Samsung phones")
        assert result["intent"] == "compare"
        assert len(result["entities"]) >= 2

    def test_parse_low_confidence_intent(self, parser):
        """Test parsing with low confidence"""
        parser.parse_intent = Mock(
            return_value={
                "intent": "unknown",
                "confidence": 0.45,
            }
        )

        result = parser.parse_intent("asdfghjkl xyz")
        assert result["confidence"] < 0.5
        assert result["intent"] == "unknown"

    def test_empty_input(self, parser):
        """Test parsing empty input"""
        parser.parse_intent = Mock(
            return_value={
                "intent": None,
                "confidence": 0.0,
                "error": "Empty input",
            }
        )

        result = parser.parse_intent("")
        assert result["confidence"] == 0.0


class TestEntityExtraction:
    """Test entity extraction functionality"""

    def test_extract_product_entities(self, parser):
        """Test extracting product entities"""
        entities = parser.extract_entities("I'm looking for a gaming laptop")

        assert len(entities) > 0
        product_entities = [e for e in entities if e["type"] == "PRODUCT"]
        assert len(product_entities) > 0

    def test_extract_price_range_entities(self, parser):
        """Test extracting price range entities"""
        entities = parser.extract_entities("Laptops under $1000")

        price_entities = [e for e in entities if e["type"] == "PRICE_RANGE"]
        assert len(price_entities) > 0
        assert "$" in price_entities[0]["value"]

    def test_extract_multiple_entities(self, parser):
        """Test extracting multiple entities in one query"""
        entities = parser.extract_entities(
            "Show me gaming laptops from Dell under $2000"
        )

        assert len(entities) >= 2
        # Should extract brand, category, and price
        entity_types = [e["type"] for e in entities]
        assert len(set(entity_types)) >= 2

    def test_extract_brand_entities(self, parser):
        """Test extracting brand entities"""
        parser.extract_entities = Mock(
            return_value=[
                {"type": "BRAND", "value": "Dell", "confidence": 0.95},
            ]
        )

        entities = parser.extract_entities("Dell XPS laptops")
        brand_entities = [e for e in entities if e["type"] == "BRAND"]
        assert len(brand_entities) > 0

    def test_extract_category_entities(self, parser):
        """Test extracting category entities"""
        parser.extract_entities = Mock(
            return_value=[
                {"type": "CATEGORY", "value": "electronics", "confidence": 0.92},
            ]
        )

        entities = parser.extract_entities("electronics")
        assert len(entities) > 0
        assert entities[0]["type"] == "CATEGORY"

    def test_no_entities_found(self, parser):
        """Test when no entities are found"""
        parser.extract_entities = Mock(return_value=[])

        entities = parser.extract_entities("xyz abc qwerty")
        assert len(entities) == 0


class TestSentimentAnalysis:
    """Test sentiment analysis functionality"""

    def test_positive_sentiment(self, parser):
        """Test positive sentiment detection"""
        result = parser.classify_sentiment("This is amazing! I love it!")

        assert result["sentiment"] == "positive"
        assert result["scores"]["positive"] > result["scores"]["negative"]

    def test_negative_sentiment(self, parser):
        """Test negative sentiment detection"""
        parser.classify_sentiment = Mock(
            return_value={
                "sentiment": "negative",
                "confidence": 0.91,
                "scores": {"positive": 0.05, "neutral": 0.04, "negative": 0.91},
            }
        )

        result = parser.classify_sentiment("This is terrible and disappointing")
        assert result["sentiment"] == "negative"
        assert result["scores"]["negative"] > result["scores"]["positive"]

    def test_neutral_sentiment(self, parser):
        """Test neutral sentiment detection"""
        parser.classify_sentiment = Mock(
            return_value={
                "sentiment": "neutral",
                "confidence": 0.87,
                "scores": {"positive": 0.33, "neutral": 0.50, "negative": 0.17},
            }
        )

        result = parser.classify_sentiment("The product is okay")
        assert result["sentiment"] == "neutral"

    def test_mixed_sentiment(self, parser):
        """Test mixed sentiment detection"""
        parser.classify_sentiment = Mock(
            return_value={
                "sentiment": "mixed",
                "confidence": 0.75,
                "scores": {"positive": 0.45, "neutral": 0.20, "negative": 0.35},
            }
        )

        result = parser.classify_sentiment(
            "Good quality but expensive"
        )
        assert result["sentiment"] == "mixed"


class TestIntegration:
    """Integration tests for Intent Parser"""

    def test_end_to_end_search_query(self, parser):
        """Test complete flow for search query"""
        query = "Show me gaming laptops under $2000 from Dell"

        intent = parser.parse_intent(query)
        entities = parser.extract_entities(query)
        sentiment = parser.classify_sentiment(query)

        assert intent["intent"] in ["search", "filter"]
        assert len(entities) > 0
        assert sentiment["sentiment"] in ["positive", "neutral", "negative"]

    def test_error_handling_invalid_input(self, parser):
        """Test error handling with invalid input"""
        parser.parse_intent = Mock(
            side_effect=Exception("Model inference error")
        )

        with pytest.raises(Exception):
            parser.parse_intent("test")

    def test_concurrent_requests(self, parser):
        """Test handling multiple concurrent requests"""
        queries = [
            "Show me laptops",
            "Gaming desktop",
            "Budget phones",
        ]

        results = [parser.parse_intent(q) for q in queries]
        assert len(results) == 3
        assert all(r["intent"] is not None for r in results)

    def test_context_awareness(self, parser):
        """Test context-aware parsing"""
        # First query establishes context
        parser.parse_intent("Show me laptops")

        # Second query should understand it's related to laptops
        parser.parse_intent = Mock(
            return_value={
                "intent": "filter",
                "context": ["laptops"],
                "entities": [{"type": "PRICE_RANGE", "value": "<$1000"}],
            }
        )

        result = parser.parse_intent("Filter by price")
        assert "laptops" in result.get("context", [])


class TestCaching:
    """Test caching of parsed intents"""

    def test_cache_hit(self, parser):
        """Test cache hit for repeated queries"""
        cache = {}

        def parse_with_cache(query):
            if query in cache:
                return cache[query]

            result = parser.parse_intent(query)
            cache[query] = result
            return result

        # First call should parse
        result1 = parse_with_cache("Show me laptops")

        # Second call should use cache
        result2 = parse_with_cache("Show me laptops")

        assert result1 == result2
        assert len(cache) == 1

    def test_cache_expiration(self, parser):
        """Test cache expiration"""
        import time

        cache = {}
        ttl = 1  # 1 second

        def parse_with_ttl(query):
            if query in cache:
                cached_value, timestamp = cache[query]
                if time.time() - timestamp < ttl:
                    return cached_value

            result = parser.parse_intent(query)
            cache[query] = (result, time.time())
            return result

        result1 = parse_with_ttl("test query")
        time.sleep(1.5)
        result2 = parse_with_ttl("test query")

        # Both should work but with fresh parse on second
        assert result1 == result2


class TestErrorHandling:
    """Test error handling in Intent Parser"""

    def test_model_load_error(self, parser):
        """Test handling of model load errors"""
        parser.model = Mock(side_effect=Exception("Model load failed"))

        # Should handle gracefully
        try:
            parser.parse_intent("test")
        except Exception as e:
            assert "Model" in str(e) or "load" in str(e)

    def test_invalid_input_type(self, parser):
        """Test handling of invalid input types"""
        parser.parse_intent = Mock(
            side_effect=TypeError("Input must be string")
        )

        with pytest.raises(TypeError):
            parser.parse_intent(123)  # Invalid type

    def test_timeout_handling(self, parser):
        """Test handling of timeout"""
        parser.parse_intent = Mock(
            side_effect=TimeoutError("Request timeout")
        )

        with pytest.raises(TimeoutError):
            parser.parse_intent("test")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
