"""Pydantic models for Product Ranking Engine."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, timezone
from enum import Enum


# ===================== Input Models =====================

class ProductDTO(BaseModel):
    """Product from Product Aggregator."""

    id: str
    name: str
    price: float = Field(ge=0)
    currency: str = "INR"
    rating: float = Field(ge=0, le=5)
    review_count: int = 0
    brand: str
    delivery_time: str
    source: str
    url: Optional[str] = None
    image_url: Optional[str] = None
    in_stock: bool = True
    discount_percent: Optional[float] = None
    original_price: Optional[float] = None
    key_features: List[str] = Field(default_factory=list)
    relevance_score: float = 0.0
    # V2 enrichment fields
    category: str = ""
    sub_category: str = ""
    attributes: Dict[str, str] = Field(default_factory=dict)
    specifications_features: List[str] = Field(default_factory=list)
    specifications_use_cases: List[str] = Field(default_factory=list)
    specifications_search_tags: List[str] = Field(default_factory=list)
    cod_available: bool = False
    has_emi: bool = False
    learning_boost: float = 0.0
    feedback_boost: float = 0.0


class RankingRequest(BaseModel):
    """Request model for product ranking."""

    request_id: Union[int, str] = Field(..., description="Original BuyRequest ID")
    user_id: Union[int, str] = Field(..., description="User ID")
    products: List[ProductDTO] = Field(..., description="Products to rank")
    budget_max: float = Field(..., description="Budget constraint")
    budget_min: float = Field(default=0, description="Minimum budget")
    preferred_brands: List[str] = Field(default_factory=list, description="Preferred brands")
    preferred_delivery_days: int = Field(default=7, description="Preferred max delivery days")
    quality_threshold: float = Field(default=0.0, ge=0, le=1, description="Minimum quality score")
    # V2 intent enrichment fields
    category: Optional[str] = Field(default=None, description="Intent category")
    intent_brand: Optional[str] = Field(default=None, description="Intent brand")
    intent_features: List[str] = Field(default_factory=list, description="Intent feature keywords")
    use_case: Optional[str] = Field(default=None, description="Use case (gaming, office, etc)")
    keywords: List[str] = Field(default_factory=list, description="Search keywords")
    recent_click_brands: List[str] = Field(default_factory=list, description="Recently clicked brands")
    user_price_min: Optional[float] = Field(default=None, description="User's price range min")
    user_price_max: Optional[float] = Field(default=None, description="User's price range max")


# ===================== Scoring Component Models =====================

class BudgetFitScore(BaseModel):
    """Budget fit scoring component."""

    distance_from_max: float = Field(..., description="Distance from budget max")
    distance_percentage: float = Field(..., description="Percentage of budget used")
    score: float = Field(..., ge=0, le=1, description="Budget fit score (0-1)")
    reason: str = Field(..., description="Why this score")

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "distance_from_max": 5000,
            "distance_percentage": 0.83,
            "score": 0.92,
            "reason": "Price is 83% of budget, very good fit"
        }
    })


class QualityScore(BaseModel):
    """Quality assessment component."""

    brand_score: float = Field(..., ge=0, le=1, description="Brand quality factor")
    feature_count: int = Field(..., description="Number of key features")
    feature_score: float = Field(..., ge=0, le=1, description="Feature completeness")
    build_quality: float = Field(..., ge=0, le=1, description="Estimated build quality")
    score: float = Field(..., ge=0, le=1, description="Overall quality score")
    reason: str = Field(..., description="Why this quality score")


class BrandPreferenceScore(BaseModel):
    """Brand preference scoring."""

    is_preferred: bool = Field(..., description="Is brand in preferred list")
    preference_level: str = Field(..., description="brand_match, alternative, or neutral")
    score: float = Field(..., ge=0, le=1, description="Brand preference score")
    reason: str = Field(..., description="Why this score")


class DeliverySpeedScore(BaseModel):
    """Delivery speed scoring."""

    delivery_days: int = Field(..., description="Delivery time in days")
    urgency_fit: str = Field(..., description="fast, moderate, or slow")
    score: float = Field(..., ge=0, le=1, description="Delivery speed score")
    reason: str = Field(..., description="Why this score")


class RatingsScore(BaseModel):
    """Ratings assessment."""

    rating: float = Field(..., ge=0, le=5, description="Product rating")
    review_count: int = Field(..., ge=0, description="Number of reviews")
    confidence: float = Field(..., ge=0, le=1, description="Rating confidence")
    score: float = Field(..., ge=0, le=1, description="Ratings score")
    reason: str = Field(..., description="Why this score")


# ===================== Ranking Output Models =====================

class RankingExplanation(BaseModel):
    """Detailed explanation of ranking calculation."""

    product_id: str = Field(..., description="Product ID")
    product_name: str = Field(..., description="Product name")
    
    # Component scores
    budget_fit_score: BudgetFitScore
    quality_score: QualityScore
    brand_preference_score: BrandPreferenceScore
    delivery_speed_score: DeliverySpeedScore
    ratings_score: RatingsScore
    
    # Weights applied
    weights: Dict[str, float] = Field(..., description="Weights used in calculation")
    
    # Overall ranking
    final_score: float = Field(..., ge=0, le=1, description="Final ranking score")
    rank: int = Field(default=0, ge=0, description="Rank position (0=unranked, 1=best)")
    confidence: float = Field(..., ge=0, le=1, description="Confidence in ranking")
    
    # Human-readable summary
    summary: str = Field(..., description="One-line summary of why this product ranked here")
    key_strengths: List[str] = Field(..., description="Top 3 strengths of this product")
    key_weaknesses: List[str] = Field(..., description="Top 3 weaknesses of this product")
    
    # V2 dimension-level detail
    dimension_scores: Dict[str, float] = Field(default_factory=dict, description="Per-dimension raw scores")
    dimension_total: float = Field(default=0.0, description="Sum of weighted dimension scores")
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "product_id": "AMZN_001",
            "product_name": "Sony WH-1000XM5",
            "budget_fit_score": {
                "distance_from_max": 5000,
                "distance_percentage": 0.83,
                "score": 0.92,
                "reason": "Price is well within budget"
            },
            "quality_score": {
                "brand_score": 0.95,
                "feature_count": 8,
                "feature_score": 0.88,
                "build_quality": 0.90,
                "score": 0.88,
                "reason": "Premium brand with excellent features"
            },
            "brand_preference_score": {
                "is_preferred": True,
                "preference_level": "brand_match",
                "score": 1.0,
                "reason": "Sony is in preferred brands"
            },
            "delivery_speed_score": {
                "delivery_days": 2,
                "urgency_fit": "fast",
                "score": 1.0,
                "reason": "2-day delivery is excellent"
            },
            "ratings_score": {
                "rating": 4.5,
                "review_count": 1250,
                "confidence": 0.99,
                "score": 0.90,
                "reason": "High rating with many reviews"
            },
            "weights": {
                "budget_fit": 0.25,
                "quality": 0.25,
                "brand": 0.20,
                "delivery": 0.15,
                "ratings": 0.15
            },
            "final_score": 0.93,
            "rank": 1,
            "confidence": 0.94,
            "summary": "Best overall choice - premium quality, excellent price fit, fast delivery",
            "key_strengths": [
                "Industry-leading noise cancellation",
                "Exceptional battery life (30 hours)",
                "Trusted brand with great reviews"
            ],
            "key_weaknesses": [
                "Higher price point",
                "Heavier than some competitors",
                "Steep learning curve for features"
            ]
        }
    })


class RankedProduct(BaseModel):
    """Product with ranking information."""

    rank: int = Field(default=0, ge=0, description="Rank position (0=unranked, 1=best)")
    product: ProductDTO
    score: float = Field(..., ge=0, le=1, description="Ranking score")
    confidence: float = Field(..., ge=0, le=1, description="Confidence in this ranking")
    explanation: RankingExplanation


class RankingResponse(BaseModel):
    """Response model for product ranking."""

    request_id: Union[int, str] = Field(..., description="Original request ID")
    user_id: Union[int, str] = Field(..., description="User ID")
    
    # Ranking results
    total_products: int = Field(..., description="Total products ranked")
    ranked_products: List[RankedProduct] = Field(..., description="All products ranked")
    
    # Best product (optional if no products ranked)
    best_product: Optional[RankedProduct] = Field(None, description="Top-ranked product")
    
    # Metadata
    ranking_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    algorithm_version: str = Field(default="1.0", description="Ranking algorithm version")
    average_confidence: float = Field(..., ge=0, le=1, description="Average confidence across rankings")
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "request_id": 1,
            "user_id": 1,
            "total_products": 5,
            "ranked_products": [],
            "best_product": {},
            "ranking_timestamp": "2026-03-22T10:30:00Z",
            "algorithm_version": "1.0",
            "average_confidence": 0.92
        }
    })


# ===================== Event Models =====================

class ProductsRankedEvent(BaseModel):
    """Event emitted when products are ranked."""

    event_type: str = "products.ranked"
    request_id: Union[int, str]
    user_id: Union[int, str]
    best_product_id: str
    best_product_name: str
    best_product_score: float
    total_ranked: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ===================== Health & Error Models =====================

class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(..., description="Service status")
    version: str = Field(..., description="Service version")
    kafka_connected: bool = Field(..., description="Kafka connection status")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "status": "healthy",
            "version": "1.0.0",
            "kafka_connected": True,
            "timestamp": "2026-03-22T10:30:00Z"
        }
    })


class ErrorResponse(BaseModel):
    """Error response model."""

    error: str = Field(..., description="Error message")
    code: str = Field(..., description="Error code")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    details: Optional[Dict[str, Any]] = None
