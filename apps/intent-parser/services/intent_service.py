"""Intent Processing Service - Main business logic."""

import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from models import (
    BuyRequest,
    ProcessedIntentResponse,
    CategoryNormalization,
    ProcessedKeyword,
    IntentInference,
    BrandPriority,
    BudgetClarity
)
from prompts import (
    INTENT_PARSING_SYSTEM_PROMPT,
    get_intent_parsing_prompt,
    get_category_normalization_prompt,
    get_use_case_inference_prompt,
    get_brand_analysis_prompt,
    get_budget_clarity_prompt
)
from services.llm_service import LLMService

logger = logging.getLogger(__name__)


class IntentProcessingService:
    """Service for processing buy requests into structured intent."""

    def __init__(self, llm_service: LLMService, confidence_threshold: float = 0.7):
        """Initialize intent processing service."""
        self.llm = llm_service
        self.confidence_threshold = confidence_threshold

    async def process_buy_request(
        self,
        buy_request: BuyRequest,
        temperature: float = 0.3,
        max_tokens: int = 500
    ) -> ProcessedIntentResponse:
        """Process a buy request into structured intent."""
        logger.info(f"Processing buy request {buy_request.id}")

        try:
            # Generate the main intent parsing prompt
            user_prompt = get_intent_parsing_prompt(buy_request.model_dump())

            # Call LLM for intent parsing
            response_dict = await self.llm.parse_intent(
                system_prompt=INTENT_PARSING_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=max_tokens
            )

            logger.debug(f"LLM response: {json.dumps(response_dict)[:500]}")

            # Extract components
            normalized_category = self._parse_category(response_dict.get("normalized_category", {}))
            refined_keywords = self._parse_keywords(response_dict.get("refined_keywords", []))
            inferred_use_case = self._parse_use_case(response_dict.get("inferred_use_case", {}))
            brand_priority = self._parse_brand_priority(response_dict.get("brand_priority", {}))
            budget_clarity = self._parse_budget_clarity(response_dict.get("budget_analysis", {}), buy_request)

            # Calculate overall confidence
            confidences = [
                normalized_category.category_confidence,
                inferred_use_case.inference_confidence,
                brand_priority.brand_confidence,
                budget_clarity.price_clarity_score
            ]
            overall_confidence = sum(confidences) / len(confidences)

            # Build response
            response = ProcessedIntentResponse(
                requestId=buy_request.id,
                userId=buy_request.userId,
                normalized_category=normalized_category,
                refined_keywords=refined_keywords,
                inferred_use_case=inferred_use_case,
                brand_priority_score=brand_priority,
                budget_clarity_score=budget_clarity,
                overall_confidence=overall_confidence,
                processing_timestamp=datetime.now(timezone.utc),
                llm_model_used=self.llm.provider.get_model_name(),
                raw_llm_response=json.dumps(response_dict)
            )

            logger.info(f"Successfully processed buy request {buy_request.id}, confidence: {overall_confidence:.2f}")
            return response

        except Exception as e:
            logger.error(f"Failed to process buy request {buy_request.id}: {e}")
            raise

    def _parse_category(self, category_data: Dict[str, Any]) -> CategoryNormalization:
        """Parse and validate category data."""
        return CategoryNormalization(
            primary_category=category_data.get("primary_category", "Unknown"),
            secondary_category=category_data.get("secondary_category"),
            category_confidence=float(category_data.get("category_confidence", 0.5))
        )

    def _parse_keywords(self, keywords_data: list) -> list:
        """Parse and validate keywords."""
        keywords = []
        for kw in keywords_data:
            try:
                keyword = ProcessedKeyword(
                    keyword=kw.get("keyword", ""),
                    priority=float(kw.get("priority", 0.5)),
                    type=kw.get("type", "feature")
                )
                keywords.append(keyword)
            except Exception as e:
                logger.warning(f"Failed to parse keyword: {kw}, error: {e}")
                continue
        return keywords

    def _parse_use_case(self, use_case_data: Dict[str, Any]) -> IntentInference:
        """Parse and validate use case data."""
        return IntentInference(
            primary_use_case=use_case_data.get("primary_use_case", "general"),
            secondary_use_cases=use_case_data.get("secondary_use_cases", []),
            inferred_features=use_case_data.get("inferred_features", []),
            missing_details=use_case_data.get("missing_details", []),
            inference_confidence=float(use_case_data.get("inference_confidence", 0.5))
        )

    def _parse_brand_priority(self, brand_data: Dict[str, Any]) -> BrandPriority:
        """Parse and validate brand priority data."""
        return BrandPriority(
            specified_brands=brand_data.get("specified_brands", []),
            brand_confidence=float(brand_data.get("brand_confidence", 0.5)),
            alternative_brands=brand_data.get("alternative_brands", [])
        )

    def _parse_budget_clarity(self, budget_data: Dict[str, Any], buy_request: BuyRequest) -> BudgetClarity:
        """Parse and validate budget clarity data."""
        budget_range = buy_request.budgetMax - buy_request.budgetMin
        price_sensitivity = self._calculate_price_sensitivity(budget_range, buy_request.budgetMin)
        
        return BudgetClarity(
            min_budget=float(budget_data.get("min_budget", buy_request.budgetMin)),
            max_budget=float(budget_data.get("max_budget", buy_request.budgetMax)),
            budget_range=budget_range,
            price_sensitivity=price_sensitivity,
            price_clarity_score=float(budget_data.get("price_clarity_score", 0.8))
        )

    def _calculate_price_sensitivity(self, budget_range: float, budget_min: float) -> str:
        """Calculate price sensitivity based on budget range."""
        if budget_min <= 0:
            return "high"  # No lower bound, very flexible
        
        range_percentage = (budget_range / budget_min) * 100
        
        if range_percentage <= 20:
            return "low"
        elif range_percentage <= 50:
            return "medium"
        else:
            return "high"

    def calculate_confidence_score(self, response: ProcessedIntentResponse) -> float:
        """Calculate final confidence score."""
        weights = {
            "category": 0.25,
            "keywords": 0.2,
            "use_case": 0.25,
            "brand": 0.15,
            "budget": 0.15
        }

        score = (
            response.normalized_category.category_confidence * weights["category"] +
            min(0.95, len(response.refined_keywords) / 10) * weights["keywords"] +
            response.inferred_use_case.inference_confidence * weights["use_case"] +
            response.brand_priority_score.brand_confidence * weights["brand"] +
            response.budget_clarity_score.price_clarity_score * weights["budget"]
        )

        return min(1.0, max(0.0, score))

    def meets_confidence_threshold(self, response: ProcessedIntentResponse) -> bool:
        """Check if response meets confidence threshold."""
        return response.overall_confidence >= self.confidence_threshold
