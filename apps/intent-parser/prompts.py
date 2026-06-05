"""Prompt templates for LLM-based intent parsing."""

# System prompt for intent parsing
INTENT_PARSING_SYSTEM_PROMPT = """You are an expert AI assistant specialized in parsing and understanding customer purchase intentions. Your task is to analyze buy requests and extract structured, actionable insights that help improve product matching and recommendations.

Your responses must be valid JSON that follows the exact structure provided. Be precise, extract concrete details, and provide confidence scores for your assessments.

Key responsibilities:
1. Normalize product categories to standard taxonomy
2. Extract and refine search keywords
3. Infer the actual use case beyond the stated request
4. Analyze brand preferences and suggest alternatives
5. Assess budget clarity and price sensitivity

Keep your analysis practical and grounded in real product characteristics."""


# Main intent parsing prompt
INTENT_PARSING_PROMPT = """Analyze the following buy request and provide structured intent insights.

BUY REQUEST:
- Product: {product_name}
- Description: {description}
- Budget: ${budget_min} - ${budget_max}
- Quality Score: {quality_score}/10
- Preferred Brands: {preferred_brands}
- Delivery Date: {delivery_date}
- Auto-Execute: {auto_execute}
- Notification Channels: {notify_channels}

Provide a detailed JSON response with the following structure:

{{
  "normalized_category": {{
    "primary_category": "string - standardized product category",
    "secondary_category": "string - specific subcategory or null",
    "category_confidence": 0.0-1.0 - confidence in categorization
  }},
  
  "refined_keywords": [
    {{
      "keyword": "string - extracted keyword or phrase",
      "priority": 0.0-1.0 - importance for product matching",
      "type": "string - one of: feature, brand, quality, price, use_case"
    }}
    // Include 5-8 most relevant keywords
  ],
  
  "inferred_use_case": {{
    "primary_use_case": "string - primary intended use",
    "secondary_use_cases": ["string", "string"] - additional use cases,
    "inferred_features": ["string", "string"] - expected/inferred features,
    "missing_details": ["string"] - unclear or missing preferences,
    "inference_confidence": 0.0-1.0 - confidence in use case inference
  }},
  
  "brand_priority": {{
    "specified_brands": ["string"] - user-specified brands,
    "brand_confidence": 0.0-1.0 - confidence in brand preference,
    "alternative_brands": ["string", "string"] - recommended alternatives based on quality/price
  }},
  
  "budget_analysis": {{
    "min_budget": {budget_min},
    "max_budget": {budget_max},
    "budget_range": calculated difference,
    "price_sensitivity": "low|medium|high" - based on range vs price level,
    "price_clarity_score": 0.0-1.0 - clarity of budget constraints
  }}
}}

Analysis guidelines:
- For normalized_category: Use standard e-commerce categories (Electronics, Appliances, Fashion, etc.)
- For keywords: Include both explicit keywords and inferred important terms
- For use_case: Go beyond the stated need and infer practical applications
- For alternatives: Suggest brands known for quality/price balance in this category
- For price_sensitivity: base on the range percentage (low: 0-20% range, medium: 20-50%, high: >50%)
- For missing_details: Mention any preferences not specified that would help with matching"""


# Category normalization helper prompt
CATEGORY_NORMALIZATION_PROMPT = """Given a product description and name, normalize it to a standard product category.

Product Name: {product_name}
Description: {description}

Return ONLY valid JSON:
{{
  "primary_category": "standardized category (e.g., 'Electronics > Audio', 'Fashion > Footwear')",
  "secondary_category": "specific subcategory or null",
  "category_confidence": 0.85,
  "reasoning": "brief reasoning for categorization"
}}

Use these standard categories:
- Electronics (Audio, Video, Computing, Gaming, Wearables, Networking)
- Appliances (Kitchen, Laundry, Climate, Heating)
- Fashion (Clothing, Footwear, Accessories, Bags)
- Home & Garden (Furniture, Decor, Gardening, Tools)
- Sports & Outdoors (Sports Equipment, Outdoor Gear, Cycling)
- Beauty & Personal Care (Skincare, Haircare, Fragrances)
- Toys & Games (Board Games, Video Games, Building Toys)
- Books & Media (Books, Audiobooks, Movies, Music)"""


# Use case inference prompt
USE_CASE_INFERENCE_PROMPT = """Infer the real-world use case from this product search.

Product: {product_name}
Description: {description}
Budget: ${budget_min} - ${budget_max}
Quality: {quality_score}/10
Brands: {preferred_brands}

Determine:
1. What is the PRIMARY use case (be specific)?
2. What are secondary use cases?
3. What features would someone with this use case need?
4. What details are missing that should be clarified?

Return JSON:
{{
  "primary_use_case": "string - be specific, e.g., 'daily_commute_audio' not just 'audio'",
  "secondary_use_cases": ["string"],
  "inferred_features": ["string"],
  "missing_details": ["string"],
  "reasoning": "string - brief explanation of inference"
}}"""


# Brand analysis prompt
BRAND_ANALYSIS_PROMPT = """Analyze brand preferences for this product request.

Product: {product_name}
Budget: ${budget_min} - ${budget_max}
Specified Brands: {preferred_brands}
Quality Score: {quality_score}/10

Suggest:
1. How confident is the brand preference?
2. What are good alternative brands at this price point?
3. What does the brand choice tell us about priorities?

Return JSON:
{{
  "specified_brands": {specified_brands},
  "brand_confidence": 0.85,
  "brand_confidence_reasoning": "string",
  "alternative_brands": ["string", "string", "string"],
  "brand_choice_indicates": "string - what the choice reveals about priorities"
}}"""


# Budget clarity prompt
BUDGET_CLARITY_PROMPT = """Analyze budget clarity and price sensitivity.

Budget Min: ${budget_min}
Budget Max: ${budget_max}
Quality Target: {quality_score}/10

Determine:
1. How clear is the budget requirement?
2. Is this price-sensitive or quality-focused?
3. What does the budget range suggest?

Return JSON:
{{
  "min_budget": {budget_min},
  "max_budget": {budget_max},
  "budget_range": calculated_difference,
  "range_percentage": percentage_of_min,
  "price_sensitivity": "low|medium|high",
  "price_clarity_score": 0.85,
  "budget_interpretation": "string"
}}"""


def get_intent_parsing_prompt(buy_request: dict) -> str:
    """Generate intent parsing prompt with buy request data."""
    return INTENT_PARSING_PROMPT.format(
        product_name=buy_request.get("productName", "Unknown"),
        description=buy_request.get("description", "No description"),
        budget_min=buy_request.get("budgetMin", 0),
        budget_max=buy_request.get("budgetMax", 0),
        quality_score=buy_request.get("qualityScore", 5),
        preferred_brands=", ".join(buy_request.get("preferredBrands", [])) or "Not specified",
        delivery_date=buy_request.get("deliveryDate", "ASAP"),
        auto_execute=buy_request.get("autoExecute", False),
        notify_channels=", ".join(buy_request.get("notifyChannels", [])) or "Not specified"
    )


def get_category_normalization_prompt(product_name: str, description: str) -> str:
    """Generate category normalization prompt."""
    return CATEGORY_NORMALIZATION_PROMPT.format(
        product_name=product_name,
        description=description or "No description provided"
    )


def get_use_case_inference_prompt(buy_request: dict) -> str:
    """Generate use case inference prompt."""
    return USE_CASE_INFERENCE_PROMPT.format(
        product_name=buy_request.get("productName", "Unknown"),
        description=buy_request.get("description", "No description"),
        budget_min=buy_request.get("budgetMin", 0),
        budget_max=buy_request.get("budgetMax", 0),
        quality_score=buy_request.get("qualityScore", 5),
        preferred_brands=", ".join(buy_request.get("preferredBrands", [])) or "Not specified"
    )


def get_brand_analysis_prompt(buy_request: dict) -> str:
    """Generate brand analysis prompt."""
    specified_brands = buy_request.get("preferredBrands", [])
    return BRAND_ANALYSIS_PROMPT.format(
        product_name=buy_request.get("productName", "Unknown"),
        budget_min=buy_request.get("budgetMin", 0),
        budget_max=buy_request.get("budgetMax", 0),
        preferred_brands=specified_brands or ["None specified"],
        quality_score=buy_request.get("qualityScore", 5),
        specified_brands=specified_brands
    )


def get_budget_clarity_prompt(buy_request: dict) -> str:
    """Generate budget clarity analysis prompt."""
    return BUDGET_CLARITY_PROMPT.format(
        budget_min=buy_request.get("budgetMin", 0),
        budget_max=buy_request.get("budgetMax", 0),
        quality_score=buy_request.get("qualityScore", 5)
    )
