"""Amazon API adapter for product retrieval."""

from typing import List, Dict, Any
from models import ProductDTO, ProductSource
from adapters.base_adapter import ProductAdapter
import httpx
import logging
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class AmazonAdapter(ProductAdapter):
    """Adapter for querying products from Amazon API."""

    def __init__(self, api_url: str = "http://localhost:3004/api/products", timeout: int = 5):
        """Initialize adapter with Amazon API configuration."""
        self.api_url = api_url
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)
        self.mock_products = self._generate_mock_amazon_products()

    async def search(self, query: str, keywords: List[str], brands: List[str],
                     max_price: float, limit: int) -> List[ProductDTO]:
        """Search products from Amazon API."""
        try:
            results = await self._call_amazon_api(query, max_price, limit)
            return results if results else []
        except Exception as e:
            logger.error(f"Error searching Amazon: {str(e)}")
            # Return empty list — never serve mock/synthetic products to users.
            return []

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _call_amazon_api(self, query: str, max_price: float, limit: int) -> List[ProductDTO]:
        """Call Amazon API with retry logic."""
        try:
            params = {
                "q": query,
                "maxPrice": max_price,
                "limit": limit
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.api_url}/search", params=params)
                response.raise_for_status()
                
                data = response.json()
                products = []
                
                for item in data.get("products", []):
                    product = ProductDTO(
                        id=item.get("id", f"AMZN_{item.get('asin', '')}"),
                        name=item.get("title", ""),
                        price=float(item.get("price", 0)),
                        currency="INR",
                        rating=float(item.get("rating", 0)),
                        review_count=int(item.get("reviewCount", 0)),
                        brand=item.get("brand", ""),
                        delivery_time=item.get("deliveryTime", "3-5 days"),
                        source=ProductSource.AMAZON,
                        url=item.get("url"),
                        image_url=item.get("imageUrl"),
                        in_stock=item.get("inStock", True),
                        discount_percent=item.get("discount"),
                        original_price=item.get("originalPrice"),
                        key_features=item.get("features", []),
                        relevance_score=item.get("relevance", 0.5)
                    )
                    products.append(product)
                
                return products
                
        except Exception as e:
            logger.error(f"Amazon API call failed: {str(e)}")
            raise

    async def _search_mock(self, keywords: List[str], brands: List[str],
                          max_price: float, limit: int) -> List[ProductDTO]:
        """Search mock Amazon products."""
        results = []
        
        for product_data in self.mock_products:
            if product_data["price"] > max_price:
                continue
            
            relevance = self.calculate_relevance_score(
                product_data, keywords, brands
            )
            
            product = ProductDTO(
                id=product_data["id"],
                name=product_data["name"],
                price=product_data["price"],
                currency="INR",
                rating=product_data["rating"],
                review_count=product_data["review_count"],
                brand=product_data["brand"],
                delivery_time=product_data["delivery_time"],
                source=ProductSource.AMAZON,
                url=product_data.get("url"),
                image_url=product_data.get("image_url"),
                in_stock=product_data.get("in_stock", True),
                discount_percent=product_data.get("discount_percent"),
                original_price=product_data.get("original_price"),
                key_features=product_data.get("key_features", []),
                relevance_score=relevance
            )
            results.append(product)
        
        results.sort(key=lambda x: x.relevance_score, reverse=True)
        return results[:limit]

    async def get_product_by_id(self, product_id: str) -> ProductDTO:
        """Get single product by ID from Amazon."""
        for product_data in self.mock_products:
            if product_data["id"] == product_id:
                return ProductDTO(
                    id=product_data["id"],
                    name=product_data["name"],
                    price=product_data["price"],
                    currency="INR",
                    rating=product_data["rating"],
                    review_count=product_data["review_count"],
                    brand=product_data["brand"],
                    delivery_time=product_data["delivery_time"],
                    source=ProductSource.AMAZON,
                    url=product_data.get("url"),
                    image_url=product_data.get("image_url"),
                    in_stock=product_data.get("in_stock", True),
                    discount_percent=product_data.get("discount_percent"),
                    original_price=product_data.get("original_price"),
                    key_features=product_data.get("key_features", [])
                )
        raise ValueError(f"Product {product_id} not found on Amazon")

    def _generate_mock_amazon_products(self) -> List[Dict[str, Any]]:
        """Generate mock Amazon products."""
        return [
            {
                "id": "AMZN_001",
                "name": "Sony WH-1000XM5 Wireless Headphones",
                "price": 24999,
                "rating": 4.5,
                "review_count": 1250,
                "brand": "Sony",
                "delivery_time": "2-3 days",
                "url": "https://amazon.in/Sony-WH-1000XM5",
                "image_url": "https://images.amazon.in/Sony-WH-1000XM5.jpg",
                "in_stock": True,
                "discount_percent": 15,
                "original_price": 29999,
                "key_features": ["Active Noise Cancellation", "30hr Battery", "Bluetooth 5.3"]
            },
            {
                "id": "AMZN_002",
                "name": "JBL Tune 770 Wireless Headphones",
                "price": 9999,
                "rating": 4.1,
                "review_count": 3400,
                "brand": "JBL",
                "delivery_time": "3-4 days",
                "url": "https://amazon.in/JBL-Tune-770",
                "image_url": "https://images.amazon.in/jbl-770.jpg",
                "in_stock": True,
                "discount_percent": 20,
                "original_price": 12499,
                "key_features": ["Foldable Design", "33hr Battery", "Bluetooth 5.2"]
            },
            {
                "id": "AMZN_003",
                "name": "Beats Solo Pro Wireless Headphones",
                "price": 19999,
                "rating": 4.3,
                "review_count": 2100,
                "brand": "Beats",
                "delivery_time": "2-3 days",
                "url": "https://amazon.in/Beats-Solo-Pro",
                "image_url": "https://images.amazon.in/beats-solo-pro.jpg",
                "in_stock": True,
                "discount_percent": 0,
                "key_features": ["Apple H1 Chip", "40hr Battery", "Bluetooth 5.0"]
            },
            {
                "id": "AMZN_004",
                "name": "Skull Candy Crusher Evo Headphones",
                "price": 8999,
                "rating": 4.0,
                "review_count": 2900,
                "brand": "Skull Candy",
                "delivery_time": "3-4 days",
                "url": "https://amazon.in/Skull-Candy-Crusher",
                "image_url": "https://images.amazon.in/skullcandy-crusher.jpg",
                "in_stock": True,
                "discount_percent": 25,
                "original_price": 11999,
                "key_features": ["Haptic Bass", "40hr Battery", "Bluetooth 5.2"]
            },
        ]

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()
