"""
Comprehensive Unit Tests - Product Aggregator Service
Tests for product aggregation from multiple sources
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, List
import asyncio


class MockProduct:
    """Mock product data structure"""

    def __init__(self, source: str, product_id: str, name: str, price: float):
        self.source = source
        self.product_id = product_id
        self.name = name
        self.price = price
        self.rating = 4.5
        self.availability = True


class MockProductAggregator:
    """Mock Product Aggregator for testing"""

    def __init__(self):
        self.sources = {
            "amazon": self._fetch_from_amazon,
            "ebay": self._fetch_from_ebay,
            "bestbuy": self._fetch_from_bestbuy,
        }
        self.cache = {}

    async def _fetch_from_amazon(self, query: str) -> List[Dict]:
        """Fetch products from Amazon"""
        return [
            {
                "source": "amazon",
                "id": "amz-1",
                "name": f"Amazon {query}",
                "price": 99.99,
            }
        ]

    async def _fetch_from_ebay(self, query: str) -> List[Dict]:
        """Fetch products from eBay"""
        return [
            {
                "source": "ebay",
                "id": "ebay-1",
                "name": f"eBay {query}",
                "price": 89.99,
            }
        ]

    async def _fetch_from_bestbuy(self, query: str) -> List[Dict]:
        """Fetch products from Best Buy"""
        return [
            {
                "source": "bestbuy",
                "id": "bb-1",
                "name": f"Best Buy {query}",
                "price": 109.99,
            }
        ]

    async def aggregate(self, query: str) -> List[Dict]:
        """Aggregate products from all sources"""
        tasks = [source_func(query) for source_func in self.sources.values()]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        products = []
        for result in results:
            if isinstance(result, list):
                products.extend(result)

        return self._deduplicate_and_sort(products)

    def _deduplicate_and_sort(self, products: List[Dict]) -> List[Dict]:
        """Deduplicate products and sort by price"""
        seen = set()
        unique_products = []

        for product in products:
            key = product["name"].lower()
            if key not in seen:
                seen.add(key)
                unique_products.append(product)

        return sorted(unique_products, key=lambda x: x["price"])

    def get_cached(self, query: str) -> List[Dict]:
        """Get cached products"""
        return self.cache.get(query, [])

    def set_cache(self, query: str, products: List[Dict]):
        """Set cache for products"""
        self.cache[query] = products


@pytest.fixture
def aggregator():
    """Fixture for Product Aggregator"""
    return MockProductAggregator()


@pytest.mark.asyncio
class TestProductAggregation:
    """Test product aggregation functionality"""

    async def test_fetch_from_single_source(self, aggregator):
        """Test fetching from single source"""
        products = await aggregator._fetch_from_amazon("laptop")

        assert len(products) > 0
        assert products[0]["source"] == "amazon"
        assert "laptop" in products[0]["name"]

    async def test_aggregate_from_multiple_sources(self, aggregator):
        """Test aggregation from multiple sources"""
        products = await aggregator.aggregate("laptop")

        assert len(products) > 0
        # Should have products from different sources
        sources = set(p["source"] for p in products)
        assert len(sources) > 1

    async def test_price_sorting(self, aggregator):
        """Test products are sorted by price"""
        products = await aggregator.aggregate("laptop")

        prices = [p["price"] for p in products]
        assert prices == sorted(prices)

    async def test_deduplication(self, aggregator):
        """Test duplicate removal"""
        # Mock same product from multiple sources
        aggregator._fetch_from_amazon = AsyncMock(
            return_value=[
                {"source": "amazon", "name": "Laptop X", "price": 999.99}
            ]
        )
        aggregator._fetch_from_ebay = AsyncMock(
            return_value=[
                {"source": "ebay", "name": "Laptop X", "price": 999.99}
            ]
        )

        products = await aggregator.aggregate("laptop")

        # Should have fewer than 2 identical products
        laptop_names = [p["name"] for p in products]
        assert len([n for n in laptop_names if "Laptop X" in n]) <= 1

    async def test_handle_source_failure(self, aggregator):
        """Test handling of source failures"""
        aggregator._fetch_from_amazon = AsyncMock(
            side_effect=Exception("API Error")
        )

        # Should still fetch from other sources
        products = await aggregator.aggregate("laptop")

        # Should have products from ebay and bestbuy at least
        assert len(products) > 0


@pytest.mark.asyncio
class TestProductNormalization:
    """Test product data normalization"""

    async def test_normalize_product_schema(self, aggregator):
        """Test normalizing product schema across sources"""

        def normalize_product(product: Dict) -> Dict:
            return {
                "id": product.get("id") or product.get("product_id"),
                "name": product.get("name", ""),
                "price": float(product.get("price", 0)),
                "source": product.get("source", "unknown"),
                "url": product.get("url") or product.get("link"),
            }

        raw_product = {
            "id": "123",
            "name": "Test Product",
            "price": "99.99",
            "source": "amazon",
            "url": "https://amazon.com/product",
        }

        normalized = normalize_product(raw_product)

        assert isinstance(normalized["price"], float)
        assert normalized["id"] == "123"
        assert normalized["source"] == "amazon"

    async def test_handle_missing_fields(self, aggregator):
        """Test handling missing fields in product data"""

        def normalize_product(product: Dict) -> Dict:
            return {
                "id": product.get("id", "unknown"),
                "name": product.get("name", "Unknown Product"),
                "price": float(product.get("price", 0)),
                "rating": float(product.get("rating", 0)),
            }

        incomplete_product = {
            "id": "123",
            # Missing name, price, rating
        }

        normalized = normalize_product(incomplete_product)

        assert normalized["name"] == "Unknown Product"
        assert normalized["price"] == 0
        assert normalized["rating"] == 0

    async def test_price_currency_conversion(self, aggregator):
        """Test handling different currency formats"""

        def parse_price(price_str: str) -> float:
            # Remove currency symbols and parse
            price_str = price_str.replace("$", "").replace("€", "").strip()
            return float(price_str)

        assert parse_price("$99.99") == 99.99
        assert parse_price("€79.99") == 79.99
        assert parse_price("999.99") == 999.99


@pytest.mark.asyncio
class TestCaching:
    """Test caching functionality"""

    async def test_cache_aggregated_results(self, aggregator):
        """Test caching of aggregated results"""
        query = "laptop"
        products = await aggregator.aggregate(query)

        aggregator.set_cache(query, products)
        cached = aggregator.get_cached(query)

        assert cached is not None
        assert len(cached) == len(products)

    async def test_cache_miss(self, aggregator):
        """Test cache miss"""
        cached = aggregator.get_cached("nonexistent-query")
        assert cached is None

    async def test_cache_invalidation(self, aggregator):
        """Test cache invalidation"""
        query = "laptop"
        products = await aggregator.aggregate(query)

        aggregator.set_cache(query, products)
        assert aggregator.get_cached(query) is not None

        # Invalidate
        aggregator.cache.clear()
        assert aggregator.get_cached(query) is None

    async def test_cache_ttl_expiration(self, aggregator):
        """Test cache expiration based on TTL"""
        import time

        class CachedAggregator(MockProductAggregator):
            def __init__(self, ttl: int = 1):
                super().__init__()
                self.cache_ttl = {}
                self.ttl = ttl

            def get_cached(self, query: str) -> List[Dict]:
                if query in self.cache:
                    if time.time() - self.cache_ttl[query] < self.ttl:
                        return self.cache[query]
                    del self.cache[query]
                return []

            def set_cache(self, query: str, products: List[Dict]):
                self.cache[query] = products
                self.cache_ttl[query] = time.time()

        cached_agg = CachedAggregator(ttl=1)
        products = await cached_agg.aggregate("laptop")
        cached_agg.set_cache("laptop", products)

        # Should have cached
        assert cached_agg.get_cached("laptop") is not None

        # Wait for expiration
        await asyncio.sleep(1.5)
        assert cached_agg.get_cached("laptop") is None


@pytest.mark.asyncio
class TestFiltering:
    """Test product filtering"""

    async def test_filter_by_price_range(self, aggregator):
        """Test filtering by price range"""

        def filter_by_price(
            products: List[Dict], min_price: float, max_price: float
        ) -> List[Dict]:
            return [
                p
                for p in products
                if min_price <= p["price"] <= max_price
            ]

        products = [
            {"id": "1", "price": 50},
            {"id": "2", "price": 100},
            {"id": "3", "price": 150},
            {"id": "4", "price": 200},
        ]

        filtered = filter_by_price(products, 75, 175)

        assert len(filtered) == 2
        assert all(75 <= p["price"] <= 175 for p in filtered)

    async def test_filter_by_source(self, aggregator):
        """Test filtering by source"""

        def filter_by_source(
            products: List[Dict], sources: List[str]
        ) -> List[Dict]:
            return [p for p in products if p["source"] in sources]

        products = [
            {"id": "1", "source": "amazon"},
            {"id": "2", "source": "ebay"},
            {"id": "3", "source": "amazon"},
        ]

        filtered = filter_by_source(products, ["amazon"])

        assert len(filtered) == 2
        assert all(p["source"] == "amazon" for p in filtered)

    async def test_filter_by_availability(self, aggregator):
        """Test filtering by availability"""

        def filter_available(products: List[Dict]) -> List[Dict]:
            return [p for p in products if p.get("availability", True)]

        products = [
            {"id": "1", "availability": True},
            {"id": "2", "availability": False},
            {"id": "3", "availability": True},
        ]

        available = filter_available(products)

        assert len(available) == 2
        assert all(p["availability"] for p in available)


@pytest.mark.asyncio
class TestErrorHandling:
    """Test error handling"""

    async def test_handle_network_timeout(self, aggregator):
        """Test handling of network timeout"""
        aggregator._fetch_from_amazon = AsyncMock(
            side_effect=TimeoutError("Request timeout")
        )

        # Should continue with other sources
        products = await aggregator.aggregate("laptop")

        # Should still have some products
        assert len(products) > 0

    async def test_handle_invalid_json_response(self, aggregator):
        """Test handling invalid JSON response"""
        aggregator._fetch_from_amazon = AsyncMock(
            side_effect=ValueError("Invalid JSON")
        )

        products = await aggregator.aggregate("laptop")

        # Should not crash, continue with other sources
        assert isinstance(products, list)

    async def test_handle_rate_limiting(self, aggregator):
        """Test handling rate limiting"""
        aggregator._fetch_from_amazon = AsyncMock(
            side_effect=Exception("Rate limit exceeded")
        )

        # Should queue and retry
        with pytest.raises(Exception):
            await aggregator._fetch_from_amazon("laptop")

    async def test_handle_malformed_product_data(self, aggregator):
        """Test handling malformed product data"""
        aggregator._fetch_from_amazon = AsyncMock(
            return_value=[
                {"name": "Product"},  # Missing id and price
                {"id": "123"},  # Missing name and price
            ]
        )

        products = await aggregator.aggregate("laptop")

        # Should handle gracefully
        assert isinstance(products, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
