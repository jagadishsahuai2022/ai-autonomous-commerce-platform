"""
Event Processors - Handle different event types
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime, timezone

from app.models.event import DomainEvent, EventType


logger = logging.getLogger(__name__)


class UserBehaviorTracker:
    """
    Tracks user behavior for analytics and ML training
    Stores user interactions for recommendation engine
    """

    def __init__(self):
        """Initialize behavior tracker"""
        # In-memory store (replace with database in production)
        self.user_events: Dict[int, List[Dict]] = {}
        self.user_products: Dict[int, List[int]] = {}  # Products viewed by user
        logger.info("UserBehaviorTracker initialized")

    def track_product_view(self, user_id: int, product_id: int, event: DomainEvent):
        """Track product view event"""
        if user_id not in self.user_events:
            self.user_events[user_id] = []
            self.user_products[user_id] = []

        # Record event
        self.user_events[user_id].append({
            "type": "product_view",
            "product_id": product_id,
            "timestamp": event.timestamp,
            "event_id": event.event_id,
        })

        # Track product
        if product_id not in self.user_products[user_id]:
            self.user_products[user_id].append(product_id)

        logger.info(
            f"Product view tracked: user={user_id}, "
            f"product={product_id}, total_views={len(self.user_products[user_id])}"
        )

    def track_cart_item_added(self, user_id: int, product_id: int, event: DomainEvent):
        """Track cart item added event"""
        if user_id not in self.user_events:
            self.user_events[user_id] = []

        self.user_events[user_id].append({
            "type": "cart_item_added",
            "product_id": product_id,
            "quantity": event.data.extra.get("quantity") if event.data.extra else 1,
            "timestamp": event.timestamp,
            "event_id": event.event_id,
        })

        logger.info(f"Cart item added tracked: user={user_id}, product={product_id}")

    def track_cart_abandoned(self, user_id: int, event: DomainEvent):
        """Track abandoned cart event"""
        if user_id not in self.user_events:
            self.user_events[user_id] = []

        if event.data.extra:
            products = event.data.extra.get("products", [])
        else:
            products = []

        self.user_events[user_id].append({
            "type": "cart_abandoned",
            "products_count": len(products),
            "products": products,
            "timestamp": event.timestamp,
            "event_id": event.event_id,
        })

        logger.warning(f"Cart abandoned for user={user_id}, products={len(products)}")

    def get_user_profile(self, user_id: int) -> Dict:
        """Get user behavior profile"""
        if user_id not in self.user_events:
            return {
                "user_id": user_id,
                "events_count": 0,
                "products_viewed": [],
            }

        return {
            "user_id": user_id,
            "events_count": len(self.user_events[user_id]),
            "products_viewed": self.user_products.get(user_id, []),
            "recent_events": self.user_events[user_id][-5:],  # Last 5 events
        }


class OrderEventProcessor:
    """
    Processes order events for fulfillment and analytics
    """

    def __init__(self):
        """Initialize processor"""
        self.orders: Dict[int, Dict] = {}
        logger.info("OrderEventProcessor initialized")

    def process_order_created(self, event: DomainEvent):
        """Process order created event"""
        order_id = event.data.order_id
        if order_id is None:
            logger.warning("Received order event with no order_id")
            return
            
        user_id = event.data.user_id

        self.orders[order_id] = {
            "order_id": order_id,
            "user_id": user_id,
            "status": "created",
            "items": event.data.extra.get("items", []) if event.data.extra else [],
            "total": event.data.extra.get("total", 0) if event.data.extra else 0,
            "created_at": event.timestamp,
            "events": [
                {
                    "type": "order_created",
                    "timestamp": event.timestamp,
                    "event_id": event.event_id,
                }
            ],
        }

        logger.info(
            f"Order created: order_id={order_id}, user_id={user_id}, "
            f"total={self.orders[order_id]['total']}"
        )

    def process_order_status_change(self, event: DomainEvent, status: str):
        """Process order status change"""
        order_id = event.data.order_id

        if order_id in self.orders:
            self.orders[order_id]["status"] = status
            self.orders[order_id]["events"].append({
                "type": f"order_{status}",
                "timestamp": event.timestamp,
                "event_id": event.event_id,
            })

            logger.info(f"Order status updated: order_id={order_id}, status={status}")

    def get_order_info(self, order_id: int) -> Optional[Dict]:
        """Get order information"""
        return self.orders.get(order_id)


class RecommendationEngine:
    """
    Simple recommendation engine
    Generates recommendations based on user behavior
    """

    def __init__(self):
        """Initialize engine"""
        self.behavior_tracker = UserBehaviorTracker()
        self.order_processor = OrderEventProcessor()
        logger.info("RecommendationEngine initialized")

    def generate_recommendations(self, user_id: int) -> List[int]:
        """
        Generate recommendations for user
        
        Simple algorithm: Return products viewed by users who viewed same products
        """
        profile = self.behavior_tracker.get_user_profile(user_id)
        viewed_products = profile.get("products_viewed", [])

        if not viewed_products:
            logger.debug(f"No products viewed by user={user_id}, no recommendations")
            return []

        # Find other users who viewed similar products
        # and return products they viewed that current user hasn't
        recommended = set()

        for user_id_other, products in self.behavior_tracker.user_products.items():
            if user_id_other == user_id:
                continue

            # Find common products
            common = set(viewed_products) & set(products)
            if common:
                # Recommend products from other user that current user hasn't seen
                for product in products:
                    if product not in viewed_products and product not in recommended:
                        recommended.add(product)
                        if len(recommended) >= 5:  # Limit to 5 recommendations
                            break

        logger.info(
            f"Recommendations generated for user={user_id}: "
            f"{len(recommended)} products"
        )

        return list(recommended)[:5]

    def get_insights(self, user_id: int) -> Dict:
        """Get user insights for frontend"""
        profile = self.behavior_tracker.get_user_profile(user_id)
        recommendations = self.generate_recommendations(user_id)

        return {
            "user_id": user_id,
            "behavior_profile": profile,
            "recommendations": recommendations,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
