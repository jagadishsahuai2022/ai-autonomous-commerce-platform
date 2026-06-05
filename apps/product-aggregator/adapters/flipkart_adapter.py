"""Flipkart API adapter for product retrieval."""

from typing import List, Dict, Any
from models import ProductDTO, ProductSource
from adapters.base_adapter import ProductAdapter
import httpx
import logging
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class FlipkartAdapter(ProductAdapter):
    """Adapter for querying products from Flipkart API."""

    def __init__(self, api_url: str = "http://localhost:3005/api/products", timeout: int = 5):
        """Initialize adapter with Flipkart API configuration."""
        self.api_url = api_url
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)
        self.mock_products = self._generate_mock_flipkart_products()

    async def search(self, query: str, keywords: List[str], brands: List[str],
                     max_price: float, limit: int) -> List[ProductDTO]:
        """Search products from Flipkart API."""
        try:
            results = await self._call_flipkart_api(query, max_price, limit)
            return results if results else []
        except Exception as e:
            logger.error(f"Error searching Flipkart: {str(e)}")
            # Return empty list — never serve mock/synthetic products to users.
            return []

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _call_flipkart_api(self, query: str, max_price: float, limit: int) -> List[ProductDTO]:
        """Call Flipkart API with retry logic."""
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
                        id=item.get("id", f"FLIP_{item.get('pid', '')}"),
                        name=item.get("title", ""),
                        price=float(item.get("price", 0)),
                        currency="INR",
                        rating=float(item.get("rating", 0)),
                        review_count=int(item.get("reviewCount", 0)),
                        brand=item.get("brand", ""),
                        delivery_time=item.get("deliveryTime", "3-5 days"),
                        source=ProductSource.FLIPKART,
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
            logger.error(f"Flipkart API call failed: {str(e)}")
            raise

    async def _search_mock(self, keywords: List[str], brands: List[str],
                          max_price: float, limit: int) -> List[ProductDTO]:
        """Search mock Flipkart products."""
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
                source=ProductSource.FLIPKART,
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
        """Get single product by ID from Flipkart."""
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
                    source=ProductSource.FLIPKART,
                    url=product_data.get("url"),
                    image_url=product_data.get("image_url"),
                    in_stock=product_data.get("in_stock", True),
                    discount_percent=product_data.get("discount_percent"),
                    original_price=product_data.get("original_price"),
                    key_features=product_data.get("key_features", [])
                )
        raise ValueError(f"Product {product_id} not found on Flipkart")

    def _generate_mock_flipkart_products(self) -> List[Dict[str, Any]]:
        """Generate mock Flipkart products."""
        return [
            {
                "id": "FLIP_001",
                "name": "Sony WH-1000XM5 Premium Headphones",
                "price": 22999,
                "rating": 4.4,
                "review_count": 980,
                "brand": "Sony",
                "delivery_time": "2-3 days",
                "url": "https://flipkart.com/Sony-WH-1000XM5",
                "image_url": "https://flipkart-cdn.com/sony-wh1000xm5.jpg",
                "in_stock": True,
                "discount_percent": 23,
                "original_price": 29999,
                "key_features": ["Industry Leading ANC", "30hr Battery", "Multi-device Connect"]
            },
            {
                "id": "FLIP_002",
                "name": "Realme Buds Pro 2 Wireless Earbuds",
                "price": 3999,
                "rating": 4.2,
                "review_count": 4200,
                "brand": "Realme",
                "delivery_time": "1-2 days",
                "url": "https://flipkart.com/Realme-Buds-Pro2",
                "image_url": "https://flipkart-cdn.com/realme-buds-pro2.jpg",
                "in_stock": True,
                "discount_percent": 33,
                "original_price": 5999,
                "key_features": ["LDAC Support", "8.2mm Driver", "50hr Total Battery"]
            },
            {
                "id": "FLIP_003",
                "name": "Boat Rockerz 551 ANC Headphones",
                "price": 4999,
                "rating": 4.0,
                "review_count": 3100,
                "brand": "Boat",
                "delivery_time": "1-2 days",
                "url": "https://flipkart.com/Boat-Rockerz-551",
                "image_url": "https://flipkart-cdn.com/boat-rockerz-551.jpg",
                "in_stock": True,
                "discount_percent": 50,
                "original_price": 9999,
                "key_features": ["Active Noise Cancellation", "40hr Battery", "ENx TM Technology"]
            },
            {
                "id": "FLIP_004",
                "name": "Zebronics Zeb-Thunder Wireless Headphones",
                "price": 2999,
                "rating": 3.8,
                "review_count": 2100,
                "brand": "Zebronics",
                "delivery_time": "2-3 days",
                "url": "https://flipkart.com/Zebronics-Thunder",
                "image_url": "https://flipkart-cdn.com/zebronics-thunder.jpg",
                "in_stock": True,
                "discount_percent": 40,
                "original_price": 4999,
                "key_features": ["40mm Driver", "35hr Battery", "Foldable"]
            },
            {
                "id": "FLIP_005",
                "name": "Sennheiser Momentum 4 Premium Headphones",
                "price": 17999,
                "rating": 4.6,
                "review_count": 650,
                "brand": "Sennheiser",
                "delivery_time": "3-4 days",
                "url": "https://flipkart.com/Sennheiser-Momentum4",
                "image_url": "https://flipkart-cdn.com/sennheiser-momentum4.jpg",
                "in_stock": False,
                "discount_percent": 5,
                "original_price": 18999,
                "key_features": ["60hr Battery", "Memory Foam Ear Pads", "Premium Plastics"]
            },
        ]

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()
