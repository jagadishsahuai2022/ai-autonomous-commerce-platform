"""Pydantic models for Product Aggregator Service."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum


# ===================== Request/Response Models =====================

class ProcessedIntent(BaseModel):
    """Processed intent from Intent Parser Service."""

    requestId: int
    userId: int
    normalized_category: Dict[str, Any]
    refined_keywords: List[Dict[str, Any]]
    inferred_use_case: Dict[str, Any]
    brand_priority_score: Dict[str, Any]
    budget_clarity_score: Dict[str, Any]
    overall_confidence: float


class SearchRequest(BaseModel):
    """Request model for product search endpoint."""

    intent: ProcessedIntent = Field(..., description="Processed intent from Intent Parser")
    include_sources: Optional[List[str]] = Field(
        default_factory=lambda: ["internal", "amazon", "flipkart"],
        description="Sources to search (internal, amazon, flipkart)"
    )
    limit: int = Field(default=20, ge=1, le=100, description="Maximum results to return")
    sort_by: str = Field(default="relevance", description="Sort criteria: relevance, price_asc, price_desc, rating")


# ===================== Product Models =====================

class ProductSource(str, Enum):
    """Product source enumeration."""
    INTERNAL = "internal"
    AMAZON = "amazon"
    FLIPKART = "flipkart"


class ProductDTO(BaseModel):
    """Unified Product Data Transfer Object."""

    id: str = Field(..., description="Product ID from source")
    name: str = Field(..., description="Product name")
    price: float = Field(..., ge=0, description="Product price")
    currency: str = Field(default="INR", description="Price currency")
    rating: float = Field(default=0.0, ge=0, le=5, description="Product rating (0-5)")
    review_count: int = Field(default=0, ge=0, description="Number of reviews")
    brand: str = Field(..., description="Brand name")
    delivery_time: str = Field(default="2-3 days", description="Estimated delivery time")
    source: ProductSource = Field(..., description="Product source")
    url: Optional[str] = Field(None, description="Product URL")
    image_url: Optional[str] = Field(None, description="Product image URL")
    in_stock: bool = Field(default=True, description="Stock availability")
    discount_percent: Optional[float] = Field(None, ge=0, le=100, description="Discount percentage")
    original_price: Optional[float] = Field(None, ge=0, description="Original price before discount")
    key_features: List[str] = Field(default_factory=list, description="Key product features")
    relevance_score: float = Field(default=0.0, ge=0, le=1, description="Relevance to search query")
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "id": "PROD_123",
            "name": "Sony WH-1000XM5 Wireless Headphones",
            "price": 24999,
            "currency": "INR",
            "rating": 4.5,
            "review_count": 1250,
            "brand": "Sony",
            "delivery_time": "2-3 days",
            "source": "amazon",
            "url": "https://amazon.in/Sony-WH-1000XM5",
            "image_url": "https://images.amazon.in/Sony-WH-1000XM5.jpg",
            "in_stock": True,
            "discount_percent": 15,
            "original_price": 29999,
            "key_features": ["Active Noise Cancellation", "30hr Battery", "Bluetooth 5.3"],
            "relevance_score": 0.95
        }
    })


class SearchResponse(BaseModel):
    """Response model for product search."""

    request_id: int = Field(..., description="Original request ID")
    user_id: int = Field(..., description="User ID")
    query: str = Field(..., description="Search query from intent")
    total_products: int = Field(..., description="Total products found")
    products: List[ProductDTO] = Field(..., description="List of products")
    sources_searched: List[str] = Field(..., description="Sources that were searched")
    search_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    search_duration_ms: float = Field(..., description="Search execution time in milliseconds")
    cache_hit: bool = Field(default=False, description="Whether result was from cache")
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "request_id": 1,
            "user_id": 1,
            "query": "wireless headphones",
            "total_products": 25,
            "products": [
                {
                    "id": "PROD_123",
                    "name": "Sony WH-1000XM5",
                    "price": 24999,
                    "currency": "INR",
                    "rating": 4.5,
                    "review_count": 1250,
                    "brand": "Sony",
                    "delivery_time": "2-3 days",
                    "source": "amazon",
                    "relevance_score": 0.95
                }
            ],
            "sources_searched": ["internal", "amazon", "flipkart"],
            "search_duration_ms": 2345.67,
            "cache_hit": False
        }
    })


# ===================== Event Models =====================

class ProductsFetchedEvent(BaseModel):
    """Event emitted when products are fetched."""

    event_type: str = "products.fetched"
    request_id: int
    user_id: int
    product_count: int
    sources: List[str]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    search_duration_ms: float


# ===================== Cache Models =====================

class CacheEntry(BaseModel):
    """Cache entry structure."""

    key: str
    value: SearchResponse
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ttl: int


# ===================== Health & Error Models =====================

class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(..., description="Service status")
    version: str = Field(..., description="Service version")
    redis_connected: bool = Field(..., description="Redis connection status")
    kafka_connected: bool = Field(..., description="Kafka connection status")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "status": "healthy",
            "version": "1.0.0",
            "redis_connected": True,
            "kafka_connected": True,
            "timestamp": "2026-03-22T10:30:00Z"
        }
    })


class ErrorResponse(BaseModel):
    """Error response model."""

    error: str = Field(..., description="Error message")
    code: str = Field(..., description="Error code")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "error": "No products found matching criteria",
            "code": "NO_PRODUCTS_FOUND",
            "details": {"query": "xyz"}
        }
    })
