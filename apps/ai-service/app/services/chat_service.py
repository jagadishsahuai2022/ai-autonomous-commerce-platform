"""
Chat Service for AI Shopping Assistant
Handles intent parsing, entity extraction, and product recommendations
"""

import logging
import json
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class IntentType(str, Enum):
    """Supported chat intents"""
    SEARCH_PRODUCT = "search_product"
    BROWSE_CATEGORY = "browse_category"
    PRICE_INQUIRY = "price_inquiry"
    RECOMMENDATION = "recommendation"
    PRODUCT_DETAILS = "product_details"
    COMPARE_PRODUCTS = "compare_products"
    GENERAL_QUESTION = "general_question"
    NOT_UNDERSTOOD = "not_understood"


class ChatService:
    """
    AI Chat Service for shopping assistant
    Processes natural language queries and returns product information
    """

    def __init__(self):
        self.intents_map = {
            "search": IntentType.SEARCH_PRODUCT,
            "find": IntentType.SEARCH_PRODUCT,
            "look for": IntentType.SEARCH_PRODUCT,
            "show me": IntentType.SEARCH_PRODUCT,
            "what": IntentType.SEARCH_PRODUCT,
            "category": IntentType.BROWSE_CATEGORY,
            "browse": IntentType.BROWSE_CATEGORY,
            "see": IntentType.BROWSE_CATEGORY,
            "price": IntentType.PRICE_INQUIRY,
            "cost": IntentType.PRICE_INQUIRY,
            "how much": IntentType.PRICE_INQUIRY,
            "afford": IntentType.PRICE_INQUIRY,
            "budget": IntentType.PRICE_INQUIRY,
            "recommend": IntentType.RECOMMENDATION,
            "suggest": IntentType.RECOMMENDATION,
            "best": IntentType.RECOMMENDATION,
            "popular": IntentType.RECOMMENDATION,
            "trending": IntentType.RECOMMENDATION,
            "details": IntentType.PRODUCT_DETAILS,
            "info": IntentType.PRODUCT_DETAILS,
            "about": IntentType.PRODUCT_DETAILS,
            "compare": IntentType.COMPARE_PRODUCTS,
            "difference": IntentType.COMPARE_PRODUCTS,
            "vs": IntentType.COMPARE_PRODUCTS,
        }

        self.categories = [
            "electronics",
            "fashion",
            "home",
            "sports",
            "books",
            "toys",
            "beauty",
            "food",
        ]

    def parse_intent(self, message: str) -> IntentType:
        """
        Parse user intent from message using keyword matching
        In production, would use NLP/LLM
        """
        message_lower = message.lower()

        for keyword, intent in self.intents_map.items():
            if keyword in message_lower:
                return intent

        return IntentType.NOT_UNDERSTOOD

    def extract_entities(self, message: str) -> Dict[str, Any]:
        """
        Extract entities from message (category, price range, keywords)
        In production, would use NER/LLM
        """
        message_lower = message.lower()
        entities = {
            "keywords": [],
            "category": None,
            "min_price": None,
            "max_price": None,
            "search_term": None,
        }

        # Extract category
        for category in self.categories:
            if category in message_lower:
                entities["category"] = category
                break

        # Extract price range (simple pattern matching)
        # Examples: "under $100", "$50-$100", "less than 50"
        import re

        price_patterns = [
            (r"under\s*\$?(\d+)", "max_price"),
            (r"less than\s*\$?(\d+)", "max_price"),
            (r"around\s*\$?(\d+)", "target_price"),
            (r"\$?(\d+)\s*-\s*\$?(\d+)", "price_range"),
            (r"budget.*?\$?(\d+)", "max_price"),
        ]

        for pattern, price_type in price_patterns:
            match = re.search(pattern, message_lower)
            if match:
                if price_type == "max_price":
                    entities["max_price"] = int(match.group(1))
                elif price_type == "target_price":
                    price_val = int(match.group(1))
                    entities["min_price"] = max(0, price_val - 20)
                    entities["max_price"] = price_val + 20
                elif price_type == "price_range":
                    entities["min_price"] = int(match.group(1))
                    entities["max_price"] = int(match.group(2))

        # Extract search term (words not matching keywords)
        # Simple implementation: split and pick non-stop words
        stop_words = {
            "the", "a", "an", "and", "or", "but", "in", "at", "to", "for",
            "of", "with", "by", "from", "is", "are", "was", "were", "i",
            "you", "he", "she", "it", "we", "they", "what", "which", "who",
            "show", "find", "search", "look", "see",
        }

        words = [
            w for w in message_lower.split()
            if w not in stop_words and len(w) > 2 and not w.replace("$", "").isdigit()
        ]

        entities["keywords"] = words[:5]  # Limit to 5 keywords
        entities["search_term"] = " ".join(words)

        return entities

    def generate_response(
        self,
        intent: IntentType,
        entities: Dict[str, Any],
        user_message: str,
        products: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Generate AI response based on intent and entities
        """

        base_response = {
            "intent": intent.value,
            "success": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Response templates by intent
        if intent == IntentType.SEARCH_PRODUCT:
            base_response["message"] = f"I'm searching for products matching '{entities.get('search_term', '')}'"
            if entities.get("category"):
                base_response["message"] += f" in the {entities['category']} category"
            if entities.get("max_price"):
                base_response["message"] += f" under ${entities['max_price']}"
            base_response["message"] += ". Let me show you what I found!"

        elif intent == IntentType.BROWSE_CATEGORY:
            category = entities.get("category", "our catalog")
            base_response["message"] = f"Great! Let me show you products from the {category} category."

        elif intent == IntentType.PRICE_INQUIRY:
            base_response["message"] = "I can help you find products within your budget. What category are you interested in?"

        elif intent == IntentType.RECOMMENDATION:
            base_response["message"] = "Here are my top recommendations for you based on your browsing history!"

        elif intent == IntentType.PRODUCT_DETAILS:
            base_response["message"] = "Let me fetch the detailed information for you."

        elif intent == IntentType.COMPARE_PRODUCTS:
            base_response["message"] = "I'll help you compare products. Which products would you like to compare?"

        elif intent == IntentType.GENERAL_QUESTION:
            base_response["message"] = f"That's a great question! Let me help: {user_message}"

        else:  # NOT_UNDERSTOOD
            base_response["message"] = "I'm not sure what you're looking for. Would you like to search for something or browse our categories?"
            base_response["success"] = False
            base_response["suggestions"] = [
                "Search for products",
                "Browse categories",
                "View recommendations",
                "Compare products",
            ]

        # Add products if provided
        if products:
            base_response["products"] = products
            base_response["product_count"] = len(products)

        return base_response

    def process_chat_message(
        self,
        user_id: int,
        message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        available_products: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Main method to process chat message and return response
        """

        try:
            logger.info(f"Processing chat from user {user_id}: {message[:50]}...")

            # Parse intent
            intent = self.parse_intent(message)

            # Extract entities
            entities = self.extract_entities(message)

            # In production, would query actual database
            # For now, return mock products based on intent
            products = self._get_mock_products(intent, entities, available_products)

            # Generate response
            response = self.generate_response(intent, entities, message, products)

            # Add metadata
            response["user_id"] = user_id
            response["entities"] = {
                "category": entities.get("category"),
                "search_term": entities.get("search_term"),
                "min_price": entities.get("min_price"),
                "max_price": entities.get("max_price"),
                "keywords": entities.get("keywords", []),
            }

            logger.info(f"Chat processed successfully. Intent: {intent.value}")
            return response

        except Exception as e:
            logger.error(f"Error processing chat: {str(e)}")
            return {
                "success": False,
                "message": "Sorry, I encountered an error processing your request.",
                "intent": IntentType.NOT_UNDERSTOOD.value,
                "user_id": user_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": str(e),
            }

    def _get_mock_products(
        self,
        intent: IntentType,
        entities: Dict[str, Any],
        available_products: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get mock products based on intent
        In production, would query database with filters
        """

        mock_products = [
            {
                "id": 1,
                "name": "Premium Wireless Headphones",
                "category": "electronics",
                "price": 79.99,
                "rating": 4.5,
                "reviews": 234,
                "description": "High-quality wireless headphones with noise cancellation",
            },
            {
                "id": 2,
                "name": "Smart Watch Pro",
                "category": "electronics",
                "price": 299.99,
                "rating": 4.7,
                "reviews": 512,
                "description": "Advanced fitness tracking and health monitoring",
            },
            {
                "id": 3,
                "name": "Wireless Charger",
                "category": "electronics",
                "price": 29.99,
                "rating": 4.3,
                "reviews": 156,
                "description": "Fast wireless charging pad compatible with all devices",
            },
            {
                "id": 4,
                "name": "Designer T-Shirt",
                "category": "fashion",
                "price": 49.99,
                "rating": 4.4,
                "reviews": 89,
                "description": "Premium cotton t-shirt with modern design",
            },
            {
                "id": 5,
                "name": "Running Shoes",
                "category": "sports",
                "price": 119.99,
                "rating": 4.6,
                "reviews": 342,
                "description": "Professional-grade running shoes with cushioning",
            },
        ]

        # Filter by intent
        result = mock_products.copy()

        if entities.get("category"):
            result = [p for p in result if p["category"] == entities["category"]]

        if entities.get("max_price"):
            result = [p for p in result if p["price"] <= entities["max_price"]]

        if entities.get("min_price"):
            result = [p for p in result if p["price"] >= entities["min_price"]]

        # Sort by rating for recommendations
        if intent == IntentType.RECOMMENDATION:
            result = sorted(result, key=lambda x: x["rating"], reverse=True)

        return result[:5]  # Return top 5 products
