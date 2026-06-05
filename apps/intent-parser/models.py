"""Pydantic models for Intent Parser Service."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone


class BuyRequest(BaseModel):
    """BuyRequest input model."""

    id: int
    userId: int
    productName: str
    description: Optional[str] = None
    budgetMin: float
    budgetMax: float
    qualityScore: int
    preferredBrands: Optional[List[str]] = None
    deliveryDate: str
    autoExecute: bool
    notifyChannels: Optional[List[str]] = None
    status: str = "pending"
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class ParseIntentRequest(BaseModel):
    """Request model for intent parsing endpoint."""

    buyRequest: BuyRequest


class CategoryNormalization(BaseModel):
    """Normalized product category."""

    primary_category: str = Field(..., description="Primary product category")
    secondary_category: Optional[str] = Field(None, description="Secondary category")
    category_confidence: float = Field(..., ge=0, le=1, description="Confidence score for categorization")


class ProcessedKeyword(BaseModel):
    """Processed keyword with priority."""

    keyword: str
    priority: float = Field(..., ge=0, le=1, description="Priority score 0-1")
    type: str = Field(..., description="Type: feature, brand, quality, price, etc.")


class IntentInference(BaseModel):
    """Inferred intent details."""

    primary_use_case: str = Field(..., description="Inferred primary use case")
    secondary_use_cases: List[str] = Field(default_factory=list, description="Additional use cases")
    inferred_features: List[str] = Field(default_factory=list, description="Expected features")
    missing_details: List[str] = Field(default_factory=list, description="Missing details user should clarify")
    inference_confidence: float = Field(..., ge=0, le=1, description="Inference confidence score")


class BrandPriority(BaseModel):
    """Brand priority analysis."""

    specified_brands: List[str] = Field(default_factory=list, description="User-specified brands")
    brand_confidence: float = Field(..., ge=0, le=1, description="Confidence in brand preference")
    alternative_brands: List[str] = Field(default_factory=list, description="Recommended alternatives")


class BudgetClarity(BaseModel):
    """Budget clarity analysis."""

    min_budget: float
    max_budget: float
    budget_range: float = Field(..., description="Range: max - min")
    price_sensitivity: str = Field(..., description="low, medium, high")
    price_clarity_score: float = Field(..., ge=0, le=1, description="Clarity of budget constraints")


class ProcessedIntentResponse(BaseModel):
    """Response model for intent processing."""

    requestId: int = Field(..., description="Original BuyRequest ID")
    userId: int = Field(..., description="User ID")
    
    # Core outputs
    normalized_category: CategoryNormalization
    refined_keywords: List[ProcessedKeyword]
    inferred_use_case: IntentInference
    brand_priority_score: BrandPriority
    budget_clarity_score: BudgetClarity
    
    # Metadata
    overall_confidence: float = Field(..., ge=0, le=1, description="Overall intent parsing confidence")
    processing_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    llm_model_used: str
    raw_llm_response: Optional[str] = None
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "requestId": 1,
            "userId": 1,
            "normalized_category": {
                "primary_category": "Audio Equipment",
                "secondary_category": "Wireless Headphones",
                "category_confidence": 0.95
            },
            "refined_keywords": [
                {"keyword": "noise_cancelling", "priority": 0.95, "type": "feature"},
                {"keyword": "premium", "priority": 0.85, "type": "quality"},
                {"keyword": "wireless", "priority": 0.9, "type": "feature"}
            ],
            "inferred_use_case": {
                "primary_use_case": "professional_audio",
                "secondary_use_cases": ["travel", "casual_listening"],
                "inferred_features": ["active_noise_cancelling", "long_battery_life"],
                "missing_details": ["preferred_color", "connectivity_type"],
                "inference_confidence": 0.88
            },
            "brand_priority_score": {
                "specified_brands": ["Sony", "Bose"],
                "brand_confidence": 0.9,
                "alternative_brands": ["Apple", "Sennheiser"]
            },
            "budget_clarity_score": {
                "min_budget": 299.99,
                "max_budget": 499.99,
                "budget_range": 200.0,
                "price_sensitivity": "medium",
                "price_clarity_score": 0.95
            },
            "overall_confidence": 0.91,
            "processing_timestamp": "2026-03-22T10:30:00Z",
            "llm_model_used": "gpt-4-turbo-preview"
        }
    })


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    version: str
    llm_provider: str
    kafka_connected: bool


class ErrorResponse(BaseModel):
    """Error response model."""

    error: str
    detail: Optional[str] = None
    request_id: Optional[int] = None
