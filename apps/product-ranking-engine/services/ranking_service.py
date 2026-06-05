"""Product ranking service with weighted scoring algorithm."""

import logging
import math
from typing import List, Tuple
from datetime import datetime

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
from config import get_settings

logger = logging.getLogger(__name__)


class ProductRankingService:
    """Service for ranking products using weighted scoring."""

    def __init__(self):
        """Initialize ranking service."""
        self.settings = get_settings()

    async def rank_products(self, request: RankingRequest) -> RankingResponse:
        """
        Rank products using weighted scoring algorithm.
        
        Args:
            request: RankingRequest with products and constraints
            
        Returns:
            RankingResponse with ranked products and explanations
        """
        try:
            logger.info(
                f"Starting product ranking for user {request.user_id}: "
                f"{len(request.products)} products"
            )

            # Validate products
            if not request.products:
                logger.warning(f"No products to rank for request {request.request_id}")
                return RankingResponse(
                    request_id=request.request_id,
                    user_id=request.user_id,
                    total_products=0,
                    ranked_products=[],
                    best_product=None,
                    average_confidence=0.0
                )

            # Calculate scores for all products
            scored_products: List[Tuple[ProductDTO, float, RankingExplanation]] = []

            for product in request.products:
                explanation = self._calculate_product_score(product, request)
                scored_products.append((product, explanation.final_score, explanation))

            # Sort by score (highest first)
            scored_products.sort(key=lambda x: x[1], reverse=True)

            # Create ranked products with rank numbers
            ranked_products = []
            for rank, (product, score, explanation) in enumerate(scored_products, 1):
                explanation.rank = rank
                
                ranked_product = RankedProduct(
                    rank=rank,
                    product=product,
                    score=explanation.final_score,
                    confidence=explanation.confidence,
                    explanation=explanation
                )
                ranked_products.append(ranked_product)

            # Get best product
            best_product = ranked_products[0] if ranked_products else None

            # Calculate average confidence
            average_confidence = (
                sum(rp.confidence for rp in ranked_products) / len(ranked_products)
                if ranked_products else 0.0
            )

            # Create response
            response = RankingResponse(
                request_id=request.request_id,
                user_id=request.user_id,
                total_products=len(ranked_products),
                ranked_products=ranked_products,
                best_product=best_product,
                average_confidence=round(average_confidence, 3)
            )

            logger.info(
                f"Ranking complete: {len(ranked_products)} products ranked, "
                f"best score: {best_product.score if best_product else 0:.2f}"
            )

            return response

        except Exception as e:
            logger.error(f"Error ranking products: {str(e)}")
            raise

    def _calculate_product_score(
        self,
        product: ProductDTO,
        request: RankingRequest
    ) -> RankingExplanation:
        """Calculate comprehensive score for a product."""

        # Calculate component scores
        budget_fit = self._calculate_budget_fit(product, request)
        quality = self._calculate_quality_score(product, request)
        brand = self._calculate_brand_preference(product, request)
        delivery = self._calculate_delivery_speed(product, request)
        ratings = self._calculate_ratings_score(product, request)

        # Prepare weights dictionary
        weights = {
            "budget_fit": self.settings.weight_budget_fit,
            "quality": self.settings.weight_quality_score,
            "brand": self.settings.weight_brand_preference,
            "delivery": self.settings.weight_delivery_speed,
            "ratings": self.settings.weight_ratings,
        }

        # Calculate weighted score
        final_score = (
            budget_fit.score * weights["budget_fit"] +
            quality.score * weights["quality"] +
            brand.score * weights["brand"] +
            delivery.score * weights["delivery"] +
            ratings.score * weights["ratings"]
        )

        # Calculate confidence
        confidence = self._calculate_confidence(
            budget_fit, quality, brand, delivery, ratings
        )

        # Generate human-readable summary
        summary = self._generate_summary(
            product, budget_fit, quality, brand, delivery, ratings, final_score
        )

        # Extract strengths and weaknesses
        strengths = self._extract_strengths(
            product, budget_fit, quality, brand, delivery, ratings
        )
        weaknesses = self._extract_weaknesses(
            product, budget_fit, quality, brand, delivery, ratings
        )

        # Create explanation
        explanation = RankingExplanation(
            product_id=product.id,
            product_name=product.name,
            budget_fit_score=budget_fit,
            quality_score=quality,
            brand_preference_score=brand,
            delivery_speed_score=delivery,
            ratings_score=ratings,
            weights=weights,
            final_score=round(final_score, self.settings.score_precision),
            rank=0,  # Will be set later
            confidence=round(confidence, 3),
            summary=summary,
            key_strengths=strengths,
            key_weaknesses=weaknesses,
        )

        return explanation

    def _calculate_budget_fit(
        self,
        product: ProductDTO,
        request: RankingRequest
    ) -> BudgetFitScore:
        """Calculate budget fit score."""

        # Use final price (after discount if applicable)
        final_price = product.original_price or product.price
        if product.discount_percent:
            final_price = product.price  # Already discounted

        budget_max = request.budget_max
        budget_min = request.budget_min

        # Check if in range
        if final_price < budget_min:
            # Below minimum (unusual but less attractive)
            distance = budget_min - final_price
            distance_pct = distance / budget_max if budget_max > 0 else 0
            score = max(0.5, 1.0 - (distance_pct * 0.2))
            reason = f"Price {final_price} is below minimum budget {budget_min}"
        elif final_price > budget_max:
            # Above budget (bad fit)
            excess = final_price - budget_max
            excess_pct = excess / budget_max
            score = max(0.0, 1.0 - (excess_pct * 0.8))
            reason = f"Price {final_price} exceeds budget {budget_max} by {excess_pct:.1%}"
        else:
            # Within budget (good fit)
            distance_from_max = budget_max - final_price
            distance_pct = distance_from_max / budget_max if budget_max > 0 else 0
            # Closer to budget max = better value
            score = max(0.7, 0.7 + (distance_pct * 0.3))
            reason = f"Price {final_price} is {distance_pct:.1%} below max budget"

        return BudgetFitScore(
            distance_from_max=budget_max - final_price,
            distance_percentage=final_price / budget_max if budget_max > 0 else 0,
            score=min(1.0, score),
            reason=reason
        )

    def _calculate_quality_score(
        self,
        product: ProductDTO,
        request: RankingRequest
    ) -> QualityScore:
        """Calculate quality assessment."""

        # Brand score (known brands get higher scores)
        brand_score = self._get_brand_quality_score(product.brand)

        # Feature completeness
        feature_count = len(product.key_features)
        feature_score = min(1.0, feature_count / 5)  # 5+ features = perfect score

        # Estimated build quality (based on brand and price tier)
        price_ratio = product.price / 30000 if product.price > 0 else 0
        build_quality = min(1.0, 0.5 + (brand_score * 0.3) + (price_ratio * 0.2))

        # Overall quality (average with weights)
        overall_quality = (
            brand_score * 0.4 +
            feature_score * 0.35 +
            build_quality * 0.25
        )

        # Quality threshold check
        if overall_quality < request.quality_threshold:
            reason = f"Quality {overall_quality:.2f} below threshold {request.quality_threshold}"
        else:
            reason = f"Quality {overall_quality:.2f} with {feature_count} key features"

        return QualityScore(
            brand_score=round(brand_score, 2),
            feature_count=feature_count,
            feature_score=round(feature_score, 2),
            build_quality=round(build_quality, 2),
            score=round(overall_quality, 2),
            reason=reason
        )

    def _calculate_brand_preference(
        self,
        product: ProductDTO,
        request: RankingRequest
    ) -> BrandPreferenceScore:
        """Calculate brand preference score."""

        is_preferred = product.brand in request.preferred_brands

        if is_preferred:
            score = 1.0
            preference_level = "brand_match"
            reason = f"{product.brand} is in your preferred brands"
        elif product.brand in self._get_alternative_brands(request.preferred_brands):
            score = 0.8
            preference_level = "alternative"
            reason = f"{product.brand} is a recommended alternative"
        else:
            score = 0.5
            preference_level = "neutral"
            reason = f"{product.brand} is a neutral choice"

        return BrandPreferenceScore(
            is_preferred=is_preferred,
            preference_level=preference_level,
            score=score,
            reason=reason
        )

    def _calculate_delivery_speed(
        self,
        product: ProductDTO,
        request: RankingRequest
    ) -> DeliverySpeedScore:
        """Calculate delivery speed score."""

        # Parse delivery time (e.g., "2-3 days" -> 3)
        delivery_days = self._parse_delivery_days(product.delivery_time)

        preferred = request.preferred_delivery_days

        if delivery_days <= 2:
            urgency_fit = "fast"
            score = 1.0
            reason = f"Fast delivery: {delivery_days} days"
        elif delivery_days <= preferred:
            urgency_fit = "moderate"
            score = 0.8 - ((delivery_days - 2) / (preferred - 2)) * 0.2
            reason = f"Moderate delivery: {delivery_days} days (preferred: {preferred})"
        else:
            urgency_fit = "slow"
            excess_days = delivery_days - preferred
            score = max(0.0, 0.6 - (excess_days * 0.05))
            reason = f"Slower delivery: {delivery_days} days (exceeds {preferred} day preference)"

        return DeliverySpeedScore(
            delivery_days=delivery_days,
            urgency_fit=urgency_fit,
            score=min(1.0, max(0.0, score)),
            reason=reason
        )

    def _calculate_ratings_score(
        self,
        product: ProductDTO,
        request: RankingRequest
    ) -> RatingsScore:
        """Calculate ratings assessment."""

        rating = product.rating
        review_count = product.review_count

        # Rating contribution (0-5 scale)
        rating_score = rating / 5.0

        # Review count confidence
        if review_count < 10:
            confidence = 0.3
            confidence_reason = "few reviews"
        elif review_count < 100:
            confidence = 0.6
            confidence_reason = "moderate reviews"
        elif review_count < 1000:
            confidence = 0.85
            confidence_reason = "many reviews"
        else:
            confidence = 0.99
            confidence_reason = "very many reviews"

        # Combined score
        final_score = rating_score * confidence

        if review_count == 0:
            reason = "No reviews yet"
        else:
            reason = f"Rating: {rating}/5 with {review_count} reviews ({confidence_reason})"

        return RatingsScore(
            rating=rating,
            review_count=review_count,
            confidence=round(confidence, 2),
            score=round(final_score, 2),
            reason=reason
        )

    def _calculate_confidence(
        self,
        budget: BudgetFitScore,
        quality: QualityScore,
        brand: BrandPreferenceScore,
        delivery: DeliverySpeedScore,
        ratings: RatingsScore
    ) -> float:
        """Calculate overall confidence in ranking."""

        # Base confidence from component scores
        component_confidence = (
            budget.score * 0.2 +
            quality.score * 0.3 +
            ratings.confidence * 0.3 +
            0.2
        )

        # Reduce confidence if out of budget
        if budget.score < 0.5:
            component_confidence *= 0.7

        # Reduce confidence if low ratings confidence
        if ratings.confidence < 0.6:
            component_confidence *= 0.85

        return min(1.0, max(0.0, component_confidence))

    def _generate_summary(
        self,
        product: ProductDTO,
        budget: BudgetFitScore,
        quality: QualityScore,
        brand: BrandPreferenceScore,
        delivery: DeliverySpeedScore,
        ratings: RatingsScore,
        final_score: float
    ) -> str:
        """Generate human-readable summary."""

        factors = []

        # Top factors
        if quality.score >= 0.8:
            factors.append("premium quality")
        if brand.score >= 0.8:
            factors.append("preferred brand")
        if budget.score >= 0.8:
            factors.append("great price")
        if delivery.score >= 0.8:
            factors.append("fast delivery")
        if ratings.score >= 0.75:
            factors.append("highly rated")

        if not factors:
            if final_score >= 0.8:
                factors.append("strong overall choice")
            elif final_score >= 0.6:
                factors.append("balanced option")
            else:
                factors.append("consider carefully")

        factors_text = ", ".join(factors[:3])
        return f"{product.name} - {factors_text}"

    def _extract_strengths(
        self,
        product: ProductDTO,
        budget: BudgetFitScore,
        quality: QualityScore,
        brand: BrandPreferenceScore,
        delivery: DeliverySpeedScore,
        ratings: RatingsScore
    ) -> List[str]:
        """Extract top 3 strengths."""

        strengths = []

        # Score components with labels
        components = [
            (budget.score, budget.reason),
            (quality.score, f"Quality score: {quality.score:.2f}"),
            (brand.score, brand.reason if brand.score >= 0.8 else None),
            (delivery.score, delivery.reason if delivery.score >= 0.8 else None),
            (ratings.score, f"{product.rating}/5 rating with {product.review_count} reviews" if product.rating >= 4 else None),
        ]

        # Get top scorers
        sorted_components = sorted(
            [(score, reason) for score, reason in components if reason],
            key=lambda x: x[0],
            reverse=True
        )

        for score, reason in sorted_components[:3]:
            if reason:
                strengths.append(reason)

        # Add product features if available
        if product.key_features and len(strengths) < 3:
            strengths.append(f"Includes: {', '.join(product.key_features[:2])}")

        return strengths[:3]

    def _extract_weaknesses(
        self,
        product: ProductDTO,
        budget: BudgetFitScore,
        quality: QualityScore,
        brand: BrandPreferenceScore,
        delivery: DeliverySpeedScore,
        ratings: RatingsScore
    ) -> List[str]:
        """Extract top 3 weaknesses."""

        weaknesses = []

        # Score components with labels (inverted - lower scores are weaknesses)
        components = [
            (1 - budget.score, budget.reason if budget.score < 0.7 else None),
            (1 - quality.score, f"Limited quality factors" if quality.score < 0.7 else None),
            (1 - brand.score, brand.reason if brand.score < 0.7 else None),
            (1 - delivery.score, delivery.reason if delivery.score < 0.7 else None),
            (1 - ratings.score, f"Limited reviews ({product.review_count})" if ratings.confidence < 0.6 else None),
        ]

        # Get worst performers
        sorted_components = sorted(
            [(score, reason) for score, reason in components if reason],
            key=lambda x: x[0],
            reverse=True
        )

        for score, reason in sorted_components[:3]:
            if reason:
                weaknesses.append(reason)

        if not weaknesses:
            weaknesses.append("No significant weaknesses identified")

        return weaknesses[:3]

    @staticmethod
    def _get_brand_quality_score(brand: str) -> float:
        """Get quality score for a brand."""

        premium_brands = {"Sony", "Bose", "Apple", "Sennheiser", "Beats"}
        mid_brands = {"JBL", "Soundcore", "Technics", "Audio-Technica"}
        budget_brands = {"Boat", "Realme", "Zebronics", "Skull Candy"}

        if brand in premium_brands:
            return 0.95
        elif brand in mid_brands:
            return 0.75
        elif brand in budget_brands:
            return 0.60
        else:
            return 0.65

    @staticmethod
    def _get_alternative_brands(preferred: List[str]) -> List[str]:
        """Get alternative brands based on preferences."""

        brand_alternatives = {
            "Sony": ["Sennheiser", "Audio-Technica"],
            "Bose": ["Sony", "Sennheiser"],
            "Apple": ["Beats", "JBL"],
        }

        alternatives = []
        for brand in preferred:
            alternatives.extend(brand_alternatives.get(brand, []))

        return alternatives

    @staticmethod
    def _parse_delivery_days(delivery_time: str) -> int:
        """Parse delivery time string to days."""

        import re

        # Extract numbers from string like "2-3 days"
        numbers = re.findall(r'\d+', delivery_time)

        if numbers:
            # Use the maximum number (e.g., "2-3 days" -> 3)
            return max(int(n) for n in numbers)

        # Default to 7 days if can't parse
        return 7
