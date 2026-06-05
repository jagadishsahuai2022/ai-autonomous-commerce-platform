from typing import List, Dict, Any


class RecommendationEngine:
    """AI-powered recommendation engine"""

    def __init__(self):
        """Initialize the recommendation engine"""
        self.mock_products = [
            {
                "id": 1,
                "name": "Pro Mechanical Keyboard",
                "description": "High-performance mechanical keyboard for gaming and typing",
                "price": 129.99,
                "category": "Accessories",
                "rating": 4.8,
            },
            {
                "id": 2,
                "name": "Wireless Mouse Pro",
                "description": "Precision wireless mouse with adjustable DPI settings",
                "price": 49.99,
                "category": "Accessories",
                "rating": 4.6,
            },
            {
                "id": 3,
                "name": "USB-C Hub",
                "description": "Multi-port USB-C hub with HDMI, USB 3.0, and SD card reader",
                "price": 39.99,
                "category": "Accessories",
                "rating": 4.5,
            },
            {
                "id": 4,
                "name": "Monitor Arm Stand",
                "description": "Adjustable dual monitor arm stand for ergonomic setup",
                "price": 59.99,
                "category": "Accessories",
                "rating": 4.7,
            },
            {
                "id": 5,
                "name": "Mechanical Switch Tester",
                "description": "Sample pack of 9 different mechanical switches",
                "price": 24.99,
                "category": "Accessories",
                "rating": 4.4,
            },
        ]

    def get_recommendations(self, user_id: int) -> List[Dict[str, Any]]:
        """
        Get personalized recommendations for a user.

        Args:
            user_id: The unique identifier for the user

        Returns:
            List of recommended products with details
        """
        # AI logic: In production, this would use ML models to personalize recommendations
        # For now, returning top-rated products as recommendations
        recommendations = sorted(self.mock_products, key=lambda x: x["rating"], reverse=True)[
            :3
        ]

        return recommendations

    def train_model(self, historical_data: List[Dict]) -> bool:
        """Train the recommendation model with historical data"""
        # TODO: Implement model training
        return True
