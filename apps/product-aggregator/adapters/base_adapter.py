"""Base adapter for product sources."""

from abc import ABC, abstractmethod
from typing import List, Dict, Any
from models import ProductDTO, ProductSource
import logging

logger = logging.getLogger(__name__)


class ProductAdapter(ABC):
    """Abstract base class for product source adapters."""

    @abstractmethod
    async def search(self, query: str, keywords: List[str], brands: List[str], 
                     max_price: float, limit: int) -> List[ProductDTO]:
        """
        Search for products in this source.
        
        Args:
            query: Main search query
            keywords: List of refined keywords from intent
            brands: List of preferred brands
            max_price: Maximum acceptable price
            limit: Maximum results to return
            
        Returns:
            List of ProductDTO objects
        """
        pass

    @abstractmethod
    async def get_product_by_id(self, product_id: str) -> ProductDTO:
        """Get single product by ID."""
        pass

    def calculate_relevance_score(self, product: Dict[str, Any], 
                                 keywords: List[str], brands: List[str]) -> float:
        """
        Calculate relevance score for a product (0-1).
        
        Scoring factors:
        - Keyword matching (0.5 weight)
        - Brand matching (0.3 weight)
        - Rating (0.2 weight)
        """
        score = 0.0
        
        # Keyword matching
        product_name = product.get("name", "").lower()
        matching_keywords = sum(1 for kw in keywords if kw.lower() in product_name)
        keyword_score = min(matching_keywords / max(len(keywords), 1), 1.0) * 0.5
        score += keyword_score
        
        # Brand matching
        product_brand = product.get("brand", "").lower()
        brand_match = any(brand.lower() in product_brand for brand in brands)
        brand_score = 0.3 if brand_match else 0.0
        score += brand_score
        
        # Rating contribution
        rating = product.get("rating", 0.0)
        rating_score = (rating / 5.0) * 0.2
        score += rating_score
        
        return min(score, 1.0)
