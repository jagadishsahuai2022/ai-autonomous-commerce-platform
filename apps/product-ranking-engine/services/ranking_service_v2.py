"""
Product Ranking Service V2 — 22-Dimension Scoring Engine.

Replaces the old 5-weight system with the full dimension-based scoring
that mirrors the TypeScript ranking-engine.ts. Each active dimension
contributes: rawScore × weight × 100 points.
"""

import logging
import math
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass

from models import (
    ProductDTO,
    RankingRequest,
    RankingResponse,
    RankedProduct,
    RankingExplanation,
    BudgetFitScore,
    QualityScore,
    BrandPreferenceScore,
    DeliverySpeedScore,
    RatingsScore,
)
from services.scorer_registry import ScorerContext, execute_scorer
from services.dimension_weights import get_active_dimensions, DimensionConfig

logger = logging.getLogger(__name__)


@dataclass
class DimensionResult:
    """Result of scoring a product on one dimension."""
    key: str
    scorer_key: str
    raw_score: float
    weight: float
    weighted_score: float
    is_negative: bool
    group: str


class ProductRankingService:
    """Service for ranking products using 22-dimension weighted scoring."""

    async def rank_products(self, request: RankingRequest) -> RankingResponse:
        """Rank products using the dimension-based scoring algorithm."""
        try:
            logger.info(
                f"Ranking {len(request.products)} products for user {request.user_id} "
                f"(request {request.request_id})"
            )

            if not request.products:
                return RankingResponse(
                    request_id=request.request_id,
                    user_id=request.user_id,
                    total_products=0,
                    ranked_products=[],
                    best_product=None,
                    average_confidence=0.0,
                    algorithm_version="2.0",
                )

            # Load dimension configuration (cached, 60s TTL)
            dimensions = get_active_dimensions()

            # Score all products
            scored: List[Tuple[ProductDTO, float, RankingExplanation, Dict[str, float]]] = []

            for product in request.products:
                dim_results = self._score_product_dimensions(product, request, dimensions)
                explanation = self._build_explanation(product, request, dim_results)
                dim_scores = {r.key: r.raw_score for r in dim_results}
                scored.append((product, explanation.final_score, explanation, dim_scores))

            # Sort by score descending, stable by product ID
            scored.sort(key=lambda x: (-x[1], x[0].id))

            # Build response
            ranked_products = []
            for rank_pos, (product, score, explanation, dim_scores) in enumerate(scored, 1):
                updated = explanation.model_copy(update={"rank": rank_pos})
                ranked_products.append(RankedProduct(
                    rank=rank_pos,
                    product=product,
                    score=updated.final_score,
                    confidence=updated.confidence,
                    explanation=updated,
                ))

            best = ranked_products[0] if ranked_products else None
            avg_conf = (
                sum(rp.confidence for rp in ranked_products) / len(ranked_products)
                if ranked_products else 0.0
            )

            response = RankingResponse(
                request_id=request.request_id,
                user_id=request.user_id,
                total_products=len(ranked_products),
                ranked_products=ranked_products,
                best_product=best,
                average_confidence=round(avg_conf, 3),
                algorithm_version="2.0",
            )

            logger.info(
                f"Ranking complete: {len(ranked_products)} products, "
                f"best={best.score if best else 0:.3f}, "
                f"dims={len(dimensions)}"
            )
            return response

        except Exception as e:
            logger.error(f"Error ranking products: {e}", exc_info=True)
            raise

    def _score_product_dimensions(
        self,
        product: ProductDTO,
        request: RankingRequest,
        dimensions: List[DimensionConfig],
    ) -> List[DimensionResult]:
        """Score a product across all active dimensions."""

        # Build scorer context from product + request
        ctx = self._build_scorer_context(product, request)

        results = []
        for dim in dimensions:
            if not dim.is_active or not dim.scorer_key:
                continue

            raw = execute_scorer(dim.scorer_key, ctx)
            weighted = raw * dim.weightage * 100

            results.append(DimensionResult(
                key=dim.key,
                scorer_key=dim.scorer_key,
                raw_score=raw,
                weight=dim.weightage,
                weighted_score=weighted,
                is_negative=dim.is_negative,
                group=dim.group,
            ))

        return results

    def _build_scorer_context(
        self, product: ProductDTO, request: RankingRequest
    ) -> ScorerContext:
        """Convert product + request into a flat ScorerContext."""
        delivery_days = self._parse_delivery_days(product.delivery_time)
        return ScorerContext(
            product_id=product.id,
            product_name=product.name,
            brand=product.brand,
            price=product.price,
            original_price=product.original_price or product.price,
            category=getattr(product, "category", ""),
            sub_category=getattr(product, "sub_category", ""),
            rating=product.rating,
            review_count=product.review_count,
            in_stock=product.in_stock,
            delivery_days_min=max(1, delivery_days - 1),
            delivery_days_max=delivery_days,
            delivery_free=product.price >= 500,
            attributes=getattr(product, "attributes", {}),
            features=product.key_features,
            key_features=product.key_features,
            specifications_features=getattr(product, "specifications_features", []),
            specifications_use_cases=getattr(product, "specifications_use_cases", []),
            specifications_search_tags=getattr(product, "specifications_search_tags", []),
            cod_available=getattr(product, "cod_available", False),
            has_emi=getattr(product, "has_emi", False),
            intent_category=getattr(request, "category", None),
            intent_brand=getattr(request, "intent_brand", None),
            intent_budget_min=request.budget_min,
            intent_budget_max=request.budget_max,
            intent_features=getattr(request, "intent_features", []),
            intent_use_case=getattr(request, "use_case", None),
            intent_keywords=getattr(request, "keywords", []),
            preferred_brands=request.preferred_brands,
            recent_click_brands=getattr(request, "recent_click_brands", []),
            user_price_range_min=getattr(request, "user_price_min", None),
            user_price_range_max=getattr(request, "user_price_max", None),
            learning_boost=getattr(product, "learning_boost", 0.0),
            feedback_boost=getattr(product, "feedback_boost", 0.0),
        )

    def _build_explanation(
        self,
        product: ProductDTO,
        request: RankingRequest,
        dim_results: List[DimensionResult],
    ) -> RankingExplanation:
        """Build a backwards-compatible RankingExplanation from dimension results."""

        # Aggregate scores
        total_positive = sum(r.weighted_score for r in dim_results if not r.is_negative)
        total_penalty = sum(r.weighted_score for r in dim_results if r.is_negative)
        dimension_total = total_positive - total_penalty
        final_score = max(0.0, min(1.0, dimension_total / 100.0))

        # Map dimension results to legacy component scores for backwards compat
        dim_map = {r.key: r.raw_score for r in dim_results}

        budget_fit = BudgetFitScore(
            distance_from_max=request.budget_max - product.price,
            distance_percentage=product.price / request.budget_max if request.budget_max > 0 else 0,
            score=dim_map.get("budget_fit", 0.5),
            reason=self._budget_reason(product.price, request.budget_min, request.budget_max),
        )

        quality = QualityScore(
            brand_score=dim_map.get("manufacturer_profile", 0.5),
            feature_count=len(product.key_features),
            feature_score=dim_map.get("spec_match", 0.5),
            build_quality=dim_map.get("brand_trust", 0.5),
            score=self._avg([
                dim_map.get("spec_match", 0.5),
                dim_map.get("warranty_coverage", 0.5),
                dim_map.get("manufacturer_profile", 0.5),
                dim_map.get("brand_trust", 0.5),
            ]),
            reason=f"Quality across {len(product.key_features)} features",
        )

        brand = BrandPreferenceScore(
            is_preferred=product.brand in request.preferred_brands,
            preference_level="brand_match" if product.brand in request.preferred_brands else "neutral",
            score=dim_map.get("preferred_brand_boost", 0.0) if request.preferred_brands else dim_map.get("brand_match", 0.5),
            reason=f"{product.brand} {'is preferred' if product.brand in request.preferred_brands else 'neutral'}",
        )

        delivery_days = self._parse_delivery_days(product.delivery_time)
        delivery = DeliverySpeedScore(
            delivery_days=delivery_days,
            urgency_fit="fast" if delivery_days <= 2 else ("moderate" if delivery_days <= 5 else "slow"),
            score=dim_map.get("delivery_performance", 0.5),
            reason=f"Delivery: {delivery_days} days",
        )

        ratings = RatingsScore(
            rating=product.rating,
            review_count=product.review_count,
            confidence=min(1.0, 0.3 + product.review_count / 1000) if product.review_count > 0 else 0.1,
            score=dim_map.get("verified_ratings", 0.5),
            reason=f"Rating: {product.rating}/5 ({product.review_count} reviews)",
        )

        # Group scores for weights display
        group_weights: Dict[str, float] = {}
        for r in dim_results:
            group_weights[r.group] = group_weights.get(r.group, 0.0) + r.weight

        # Confidence based on data completeness
        confidence = self._compute_confidence(dim_results, product)

        # Summary + strengths/weaknesses
        top_dims = sorted(dim_results, key=lambda r: r.weighted_score, reverse=True)
        strengths = [f"{r.key}: {r.raw_score:.2f}" for r in top_dims[:3] if r.raw_score >= 0.5]
        weak_dims = sorted(
            [r for r in dim_results if not r.is_negative],
            key=lambda r: r.raw_score,
        )
        weaknesses = [f"{r.key}: {r.raw_score:.2f}" for r in weak_dims[:3] if r.raw_score < 0.5]

        if not strengths:
            strengths = ["Balanced overall scores"]
        if not weaknesses:
            weaknesses = ["No significant weaknesses"]

        summary = f"{product.name} — score {final_score:.2f} across {len(dim_results)} dimensions"

        return RankingExplanation(
            product_id=product.id,
            product_name=product.name,
            budget_fit_score=budget_fit,
            quality_score=quality,
            brand_preference_score=brand,
            delivery_speed_score=delivery,
            ratings_score=ratings,
            weights=group_weights,
            final_score=round(final_score, 3),
            rank=1,  # placeholder; overwritten by _build_explanation_with_rank
            confidence=round(confidence, 3),
            summary=summary,
            key_strengths=strengths[:3],
            key_weaknesses=weaknesses[:3],
            dimension_scores={r.key: round(r.raw_score, 3) for r in dim_results},
            dimension_total=round(dimension_total, 1),
        )

    def _build_explanation_with_rank(
        self, product: ProductDTO, request: RankingRequest,
        dim_results: list, rank: int,
    ) -> RankingExplanation:
        """Build explanation with correct rank set at creation time."""
        explanation = self._build_explanation(product, request, dim_results)
        # Pydantic model is immutable by default; use model_copy to set rank
        return explanation.model_copy(update={"rank": rank})

    def _compute_confidence(
        self, dim_results: List[DimensionResult], product: ProductDTO
    ) -> float:
        """Calculate confidence in ranking."""
        base = 0.5
        # More data = higher confidence
        if product.review_count >= 100:
            base += 0.15
        elif product.review_count >= 10:
            base += 0.08
        # More non-zero dimensions = higher confidence
        non_zero = sum(1 for r in dim_results if r.raw_score > 0.01)
        base += min(0.25, non_zero * 0.02)
        # High rating boosts confidence
        if product.rating >= 4.0:
            base += 0.1
        return min(1.0, max(0.0, base))

    @staticmethod
    def _budget_reason(price: float, bmin: float, bmax: float) -> str:
        if bmin <= price <= bmax:
            return f"Price {price} within budget [{bmin}-{bmax}]"
        if price > bmax:
            return f"Price {price} exceeds budget max {bmax}"
        return f"Price {price} below budget min {bmin}"

    @staticmethod
    def _avg(values: List[float]) -> float:
        return round(sum(values) / len(values), 2) if values else 0.0

    @staticmethod
    def _parse_delivery_days(delivery_time: str) -> int:
        import re
        nums = re.findall(r"\d+", delivery_time)
        return max(int(n) for n in nums) if nums else 7
