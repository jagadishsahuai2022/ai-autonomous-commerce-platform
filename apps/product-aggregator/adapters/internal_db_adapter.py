"""Internal database adapter for product retrieval — queries the real NestJS API."""

from typing import List, Dict, Any, Optional
from models import ProductDTO, ProductSource
from adapters.base_adapter import ProductAdapter
import httpx
import logging

logger = logging.getLogger(__name__)

# NestJS API base URL — configured via NESTJS_API_URL env var
import os
NESTJS_API_URL = os.getenv("NESTJS_API_URL", "http://localhost:3001/api/v1")


class InternalDBAdapter(ProductAdapter):
    """Adapter for querying products from the internal database via the NestJS API."""

    def __init__(self, db_connection: Any = None):
        """Initialize adapter. db_connection kept for interface compatibility but unused."""
        self.db = db_connection
        self.api_url = NESTJS_API_URL
        self._client = httpx.AsyncClient(timeout=10.0)

    async def search(self, query: str, keywords: List[str], brands: List[str],
                     max_price: float, limit: int) -> List[ProductDTO]:
        """Search real products from the internal database via the NestJS API."""
        try:
            params: Dict[str, Any] = {"take": limit}
            if query:
                params["search"] = query
            if max_price and max_price < 1e15:
                params["maxPrice"] = max_price
            if brands:
                params["brand"] = brands[0]

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.api_url}/products", params=params)
                response.raise_for_status()
                data = response.json()

            raw_products: List[Dict[str, Any]] = []
            if isinstance(data, list):
                raw_products = data
            elif isinstance(data, dict):
                raw_products = data.get("items", data.get("products", data.get("data", [])))

            results: List[ProductDTO] = []
            for item in raw_products:
                price = float(item.get("price", 0))
                if max_price and max_price < 1e15 and price > max_price:
                    continue

                image = item.get("imageUrl") or item.get("image") or item.get("thumbnailUrl")
                relevance = self.calculate_relevance_score(
                    {"name": item.get("name", ""), "brand": item.get("brand", "")},
                    keywords,
                    brands,
                )

                product = ProductDTO(
                    id=str(item.get("id", "")),
                    name=item.get("name", ""),
                    price=price,
                    currency="INR",
                    rating=float(item.get("rating", 4.0)),
                    review_count=int(item.get("reviewCount", item.get("ratingCount", 0))),
                    brand=item.get("brand", item.get("name", "").split()[0] if item.get("name") else ""),
                    delivery_time="3-5 days",
                    source=ProductSource.INTERNAL,
                    url=item.get("url"),
                    image_url=image,
                    in_stock=item.get("inStock", True),
                    discount_percent=item.get("discount"),
                    original_price=item.get("originalPrice") or item.get("mrp"),
                    key_features=item.get("features", []),
                    relevance_score=relevance,
                )
                results.append(product)

            results.sort(key=lambda x: x.relevance_score, reverse=True)
            return results[:limit]

        except Exception as e:
            logger.error(f"Error searching internal DB via NestJS API: {str(e)}")
            return []

    async def get_product_by_id(self, product_id: str) -> ProductDTO:
        """Get a single product by its database ID via the NestJS API."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.api_url}/products/{product_id}")
                response.raise_for_status()
                item = response.json()

            image = item.get("imageUrl") or item.get("image") or item.get("thumbnailUrl")
            return ProductDTO(
                id=str(item.get("id", product_id)),
                name=item.get("name", ""),
                price=float(item.get("price", 0)),
                currency="INR",
                rating=float(item.get("rating", 4.0)),
                review_count=int(item.get("reviewCount", item.get("ratingCount", 0))),
                brand=item.get("brand", item.get("name", "").split()[0] if item.get("name") else ""),
                delivery_time="3-5 days",
                source=ProductSource.INTERNAL,
                url=item.get("url"),
                image_url=image,
                in_stock=item.get("inStock", True),
                discount_percent=item.get("discount"),
                original_price=item.get("originalPrice") or item.get("mrp"),
                key_features=item.get("features", []),
            )
        except Exception as e:
            logger.error(f"Error fetching product {product_id} from internal DB: {str(e)}")
            raise ValueError(f"Product {product_id} not found in internal DB: {e}")
