"""
FastAPI AI Service with Event-Driven Architecture
Consumes events from Kafka and provides recommendations via API
"""
import logging
import os
import platform
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from app.models.event import EventType, DomainEvent
from app.consumers.kafka_consumer import KafkaEventConsumer
from app.services.event_processor import RecommendationEngine
from app.services.chat_service import ChatService

# Try to import legacy recommendation engine if it exists
try:
    from app.recommender.engine import RecommendationEngine as LegacyEngine
    LEGACY_ENGINE_AVAILABLE = True
except ImportError:
    LEGACY_ENGINE_AVAILABLE = False


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Global instances
kafka_consumer: Optional[KafkaEventConsumer] = None
recommendation_engine: Optional[RecommendationEngine] = None
chat_service: Optional[ChatService] = None


def init_event_handlers(consumer: Optional[KafkaEventConsumer], engine: Optional[RecommendationEngine]):
    """Initialize event handlers"""
    if not consumer or not engine:
        logger.warning("Cannot initialize handlers: consumer or engine is None")
        return
    
    def handle_product_viewed(event: DomainEvent):
        """Handle product viewed event"""
        if event.data.user_id and event.data.product_id:
            engine.behavior_tracker.track_product_view(
                event.data.user_id, event.data.product_id, event
            )

    def handle_cart_item_added(event: DomainEvent):
        """Handle cart item added event"""
        if event.data.user_id and event.data.product_id:
            engine.behavior_tracker.track_cart_item_added(
                event.data.user_id, event.data.product_id, event
            )

    def handle_cart_abandoned(event: DomainEvent):
        """Handle cart abandoned event"""
        if event.data.user_id:
            engine.behavior_tracker.track_cart_abandoned(event.data.user_id, event)

    def handle_order_created(event: DomainEvent):
        """Handle order created event"""
        engine.order_processor.process_order_created(event)

    def handle_order_confirmed(event: DomainEvent):
        """Handle order confirmed event"""
        engine.order_processor.process_order_status_change(event, "confirmed")

    def handle_order_shipped(event: DomainEvent):
        """Handle order shipped event"""
        engine.order_processor.process_order_status_change(event, "shipped")

    def handle_order_completed(event: DomainEvent):
        """Handle order completed event"""
        engine.order_processor.process_order_status_change(event, "completed")

    # Register handlers
    consumer.register_handler(EventType.PRODUCT_VIEWED, handle_product_viewed)
    consumer.register_handler(EventType.CART_ITEM_ADDED, handle_cart_item_added)
    consumer.register_handler(EventType.CART_ABANDONED, handle_cart_abandoned)
    consumer.register_handler(EventType.ORDER_CREATED, handle_order_created)
    consumer.register_handler(EventType.ORDER_CONFIRMED, handle_order_confirmed)
    consumer.register_handler(EventType.ORDER_SHIPPED, handle_order_shipped)
    consumer.register_handler(EventType.ORDER_COMPLETED, handle_order_completed)

    logger.info("✅ Event handlers initialized")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown"""
    global kafka_consumer, recommendation_engine, chat_service

    # Startup
    logger.info(
        f"Starting AI Service v2.0.0 "
        f"| Python {platform.python_version()} ({platform.python_implementation()}) "
        f"| FastAPI lifespan"
    )

    # Initialize components
    recommendation_engine = RecommendationEngine()
    chat_service = ChatService()
    kafka_consumer = KafkaEventConsumer(
        brokers=os.getenv("KAFKA_BROKERS", "kafka:29092"),
        group_id="ai-service-consumer",
    )

    # Initialize event handlers
    init_event_handlers(kafka_consumer, recommendation_engine)

    # Start Kafka consumer
    try:
        kafka_consumer.start()
        logger.info("✅ Kafka consumer started")
    except Exception as e:
        logger.error(f"Failed to start Kafka consumer: {str(e)}")
        logger.warning("Continuing without Kafka - API-only mode")

    yield

    # Shutdown
    logger.info("🛑 Shutting down AI Service...")
    if kafka_consumer:
        kafka_consumer.stop()
    logger.info("✅ AI Service stopped")


# Create FastAPI app
app = FastAPI(
    title="AI Services - Event-Driven Recommendation Engine",
    description="AI-powered recommendations with Kafka event processing",
    version="2.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Routes

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "status": "AI Service Running",
        "message": "Event-Driven Recommendation Engine",
        "version": "2.0.0",
        "kafka_enabled": kafka_consumer is not None,
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    kafka_status = None
    if kafka_consumer:
        kafka_status = kafka_consumer.get_status()

    return {
        "status": "healthy",
        "service": "ai-recommendation",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "kafka": kafka_status,
    }


@app.get("/api/recommendations/{user_id}")
async def get_recommendations(user_id: int):
    """Get recommendations for user"""
    if not recommendation_engine:
        raise HTTPException(status_code=503, detail="Service not ready")

    try:
        insights = recommendation_engine.get_insights(user_id)
        return JSONResponse(status_code=200, content=insights)
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate recommendations")


@app.get("/api/user-profile/{user_id}")
async def get_user_profile(user_id: int):
    """Get user behavior profile"""
    if not recommendation_engine:
        raise HTTPException(status_code=503, detail="Service not ready")

    try:
        profile = recommendation_engine.behavior_tracker.get_user_profile(user_id)
        return JSONResponse(status_code=200, content=profile)
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch user profile")


@app.get("/api/kafka/status")
async def get_kafka_status():
    """Get Kafka consumer status"""
    if not kafka_consumer:
        return {"error": "Kafka consumer not initialized", "mode": "api-only"}

    return kafka_consumer.get_status()


@app.get("/api/stats")
async def get_stats():
    """Get service statistics"""
    if not recommendation_engine:
        raise HTTPException(status_code=503, detail="Service not ready")

    return {
        "total_users": len(recommendation_engine.behavior_tracker.user_events),
        "total_events": sum(
            len(events)
            for events in recommendation_engine.behavior_tracker.user_events.values()
        ),
        "total_orders": len(recommendation_engine.order_processor.orders),
        "kafka_status": kafka_consumer.get_status() if kafka_consumer else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/events/test")
async def test_event_processing(event_data: dict):
    """Test event processing (development endpoint)"""
    if not recommendation_engine:
        raise HTTPException(status_code=503, detail="Service not ready")

    try:
        event = DomainEvent.from_dict(event_data)
        logger.info(f"Test event: {event}")

        if event.event_type == EventType.PRODUCT_VIEWED:
            if event.data.user_id and event.data.product_id:
                recommendation_engine.behavior_tracker.track_product_view(
                    event.data.user_id, event.data.product_id, event
                )
        elif event.event_type == EventType.ORDER_CREATED:
            recommendation_engine.order_processor.process_order_created(event)

        return {
            "status": "ok",
            "message": f"Event {event.event_type.value} processed",
            "event_id": event.event_id,
        }
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/recommend/{user_id}")
async def get_recommendations_legacy(user_id: int):
    """Legacy recommendations endpoint (for backward compatibility)"""
    if not recommendation_engine:
        raise HTTPException(status_code=503, detail="Service not ready")

    try:
        recommendations = recommendation_engine.generate_recommendations(user_id)
        return {
            "user_id": user_id,
            "recommendations": recommendations,
            "total": len(recommendations),
        }
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate recommendations")


@app.post("/feedback")
async def submit_feedback(user_id: int, product_id: int, feedback: int):
    """Submit feedback for recommendation (legacy endpoint)"""
    return {
        "success": True,
        "message": "Feedback recorded",
        "user_id": user_id,
        "product_id": product_id,
        "feedback": feedback,
    }


@app.post("/api/chat")
async def chat(request_data: dict):
    """
    AI Chat endpoint for shopping assistant
    Accepts: {user_id, message, conversation_history (optional)}
    Returns: {intent, message, products, entities, etc}
    """
    if not chat_service:
        raise HTTPException(status_code=503, detail="Chat service not ready")

    try:
        user_id = request_data.get("user_id")
        message = request_data.get("message")
        conversation_history = request_data.get("conversation_history", [])

        if not user_id or not message:
            raise HTTPException(
                status_code=400,
                detail="user_id and message are required"
            )

        # Process chat message
        response = chat_service.process_chat_message(
            user_id=user_id,
            message=message,
            conversation_history=conversation_history,
        )

        logger.info(f"Chat response generated for user {user_id}")
        return JSONResponse(status_code=200, content=response)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process chat message"
        )


@app.get("/api/chat/health")
async def chat_health():
    """Health check for chat service"""
    return {
        "status": "healthy" if chat_service else "unavailable",
        "service": "ai-chat",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENV") == "development",
    )
