"""
Domain Event Models - Python version of NestJS events
Matches the event structure from the backend
"""
from enum import Enum
from typing import Optional, Dict, Any
from datetime import datetime
from dataclasses import dataclass, asdict
import json


class EventType(Enum):
    """Event type enumeration"""
    # Product events
    PRODUCT_VIEWED = "product.viewed"
    PRODUCT_CREATED = "product.created"
    PRODUCT_UPDATED = "product.updated"

    # Cart events
    CART_ITEM_ADDED = "cart.item_added"
    CART_ITEM_REMOVED = "cart.item_removed"
    CART_ABANDONED = "cart.abandoned"

    # Order events
    ORDER_CREATED = "order.created"
    ORDER_CONFIRMED = "order.confirmed"
    ORDER_SHIPPED = "order.shipped"
    ORDER_COMPLETED = "order.completed"
    ORDER_CANCELLED = "order.cancelled"

    # User events
    USER_REGISTERED = "user.registered"
    USER_UPDATED = "user.updated"

    # Recommendation events (from AI service)
    RECOMMENDATION_GENERATED = "recommendation.generated"


@dataclass
class DomainEventData:
    """Event data container"""
    user_id: Optional[int] = None
    product_id: Optional[int] = None
    order_id: Optional[int] = None
    cart_id: Optional[int] = None
    extra: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = {}
        if self.user_id is not None:
            data["userId"] = self.user_id
        if self.product_id is not None:
            data["productId"] = self.product_id
        if self.order_id is not None:
            data["orderId"] = self.order_id
        if self.cart_id is not None:
            data["cartId"] = self.cart_id
        if self.extra:
            data.update(self.extra)
        return data


@dataclass
class DomainEventMetadata:
    """Event metadata"""
    source: str = "ai-service"
    correlation_id: Optional[str] = None
    causation_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "source": self.source,
            "correlationId": self.correlation_id,
            "causationId": self.causation_id,
        }


@dataclass
class DomainEvent:
    """Domain event - matches NestJS DomainEvent interface"""
    event_id: str
    event_type: EventType
    timestamp: str
    version: int
    data: DomainEventData
    metadata: Optional[DomainEventMetadata] = None

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "DomainEvent":
        """Deserialize from JSON dict"""
        try:
            event_type = EventType(payload["eventType"])
            
            # Parse data
            data_dict = payload.get("data", {})
            data = DomainEventData(
                user_id=data_dict.get("userId"),
                product_id=data_dict.get("productId"),
                order_id=data_dict.get("orderId"),
                cart_id=data_dict.get("cartId"),
                extra={
                    k: v for k, v in data_dict.items()
                    if k not in ["userId", "productId", "orderId", "cartId"]
                } or None,
            )

            # Parse metadata
            meta_dict = payload.get("metadata", {})
            metadata = DomainEventMetadata(
                source=meta_dict.get("source", "api"),
                correlation_id=meta_dict.get("correlationId"),
                causation_id=meta_dict.get("causationId"),
            ) if meta_dict else None

            return cls(
                event_id=payload["eventId"],
                event_type=event_type,
                timestamp=payload["timestamp"],
                version=payload.get("version", 1),
                data=data,
                metadata=metadata,
            )
        except (KeyError, ValueError) as e:
            raise ValueError(f"Invalid domain event payload: {str(e)}")

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary"""
        return {
            "eventId": self.event_id,
            "eventType": self.event_type.value,
            "timestamp": self.timestamp,
            "version": self.version,
            "data": self.data.to_dict(),
            "metadata": self.metadata.to_dict() if self.metadata else None,
        }

    def __repr__(self) -> str:
        return f"DomainEvent(type={self.event_type.value}, id={self.event_id})"
