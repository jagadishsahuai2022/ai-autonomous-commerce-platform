"""FastAPI Intent Parser Service."""

import logging
import platform
from contextlib import asynccontextmanager
from typing import Optional
from datetime import datetime, timezone
import asyncio

from fastapi import FastAPI, HTTPException, BackgroundTasks, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from config import settings
from models import (
    ParseIntentRequest,
    ProcessedIntentResponse,
    HealthResponse,
    ErrorResponse,
    BuyRequest
)
from services.llm_service import LLMService
from services.intent_service import IntentProcessingService
from services.kafka_service import KafkaService, IntentProcessedEvent, BuyRequestCreatedEvent

# Logging configuration
logging.basicConfig(
    level=settings.log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Global service instances
llm_service: Optional[LLMService] = None
intent_service: Optional[IntentProcessingService] = None
kafka_service: Optional[KafkaService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # Startup
    logger.info(
        f"Starting Intent Parser Service "
        f"| Python {platform.python_version()} ({platform.python_implementation()}) "
        f"| FastAPI lifespan"
    )
    try:
        global llm_service, intent_service, kafka_service
        
        # Initialize LLM service
        llm_service = LLMService(
            provider=settings.llm_provider,
            openai_api_key=settings.openai_api_key,
            openai_model=settings.openai_model,
            anthropic_api_key=settings.anthropic_api_key,
            anthropic_model=settings.anthropic_model
        )
        logger.info(f"LLM Service initialized: {settings.llm_provider}")
        
        # Initialize Intent service
        intent_service = IntentProcessingService(
            llm_service=llm_service,
            confidence_threshold=settings.intent_confidence_threshold
        )
        logger.info("Intent Processing Service initialized")
        
        # Initialize Kafka service
        kafka_service = KafkaService(
            bootstrap_servers=settings.kafka_bootstrap_servers,
            consumer_group=settings.kafka_consumer_group,
            security_protocol=settings.kafka_security_protocol
        )
        is_kafka_ready = await kafka_service.check_connectivity()
        logger.info(f"Kafka Service initialized, connectivity: {is_kafka_ready}")
        
        # Start Kafka consumer in background
        kafka_service.initialize_consumer(settings.kafka_topic_buy_request)
        kafka_service.start_consuming_thread(
            settings.kafka_topic_buy_request,
            handle_buy_request_event
        )
        logger.info("Kafka consumer started")
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Intent Parser Service...")
    if kafka_service:
        kafka_service.stop_consuming()
        kafka_service.close()
    logger.info("Service shutdown complete")


# Initialize FastAPI app
app = FastAPI(
    title="Intent Parser Service",
    description="AI-powered intent parsing for buy requests",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Endpoint Handlers

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    kafka_connected = False
    if kafka_service:
        kafka_connected = await kafka_service.check_connectivity()
    
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        llm_provider=settings.llm_provider,
        kafka_connected=kafka_connected
    )


@app.post("/intent/parse", response_model=ProcessedIntentResponse)
async def parse_intent(request: ParseIntentRequest, background_tasks: BackgroundTasks):
    """
    Parse a buy request into structured intent.
    
    This endpoint:
    1. Accepts a BuyRequest in JSON format
    2. Uses LLM to extract and normalize intent
    3. Produces to Kafka topic: intent.processed
    4. Returns structured intent response
    """
    logger.info(f"Parsing intent for buy request {request.buyRequest.id}")
    
    if not llm_service or not intent_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Services not initialized"
        )
    
    try:
        # Process the buy request
        processed_intent = await intent_service.process_buy_request(
            buy_request=request.buyRequest,
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens
        )
        
        # Produce event to Kafka in background
        background_tasks.add_task(
            produce_intent_processed_event,
            request.buyRequest,
            processed_intent
        )
        
        logger.info(f"Intent parsing successful for request {request.buyRequest.id}")
        return processed_intent
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Intent parsing failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse intent"
        )


@app.post("/kafka/mock-buy-request")
async def mock_buy_request(request: ParseIntentRequest, background_tasks: BackgroundTasks):
    """
    Mock endpoint to simulate buy request event from Kafka.
    Useful for testing without Kafka broker.
    """
    logger.info(f"Mocking buy request event for request {request.buyRequest.id}")
    
    background_tasks.add_task(
        handle_buy_request_event_sync,
        BuyRequestCreatedEvent.create(request.buyRequest.model_dump())
    )
    
    return {
        "status": "success",
        "message": "Buy request event queued for processing",
        "requestId": request.buyRequest.id
    }


# Background Tasks

async def handle_buy_request_event(event: dict):
    """Handle buy_request.created Kafka event."""
    try:
        logger.info("Processing buy request event from Kafka")
        
        # Extract buy request data
        buy_request_data = event.get("buyRequest", {})
        buy_request = BuyRequest(**buy_request_data)
        
        # Parse intent
        if not intent_service:
            logger.error("Intent service not initialized")
            return
        processed_intent = await intent_service.process_buy_request(buy_request)
        
        # Produce to intent.processed topic
        await produce_intent_processed_event(buy_request, processed_intent)
        
    except Exception as e:
        logger.error(f"Failed to handle buy request event: {e}")


def handle_buy_request_event_sync(event: dict):
    """Synchronous wrapper for handling events."""
    asyncio.run(handle_buy_request_event(event))


async def produce_intent_processed_event(buy_request: BuyRequest, processed_intent: ProcessedIntentResponse):
    """Produce intent.processed event to Kafka."""
    if not kafka_service:
        logger.warning("Kafka service not available, skipping event production")
        return
    
    try:
        event = IntentProcessedEvent.create(
            buy_request_id=buy_request.id,
            user_id=buy_request.userId,
            processed_intent=processed_intent.model_dump(),
            llm_model=processed_intent.llm_model_used
        )
        
        await kafka_service.produce_message(
            topic=settings.kafka_topic_intent_processed,
            message=event,
            key=f"buyrequest-{buy_request.id}"
        )
        
        logger.info(f"Produced intent.processed event for request {buy_request.id}")
        
    except Exception as e:
        logger.error(f"Failed to produce Kafka event: {e}")


# Error Handlers

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.detail,
            detail=getattr(exc, 'detail', None)
        ).model_dump()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error="Internal server error",
            detail=str(exc) if settings.environment == "development" else None
        ).model_dump()
    )


# Root endpoint

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Intent Parser Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "parse_intent": "/intent/parse",
            "mock_event": "/kafka/mock-buy-request",
            "docs": "/docs",
            "redoc": "/redoc"
        }
    }


# Run the app

if __name__ == "__main__":
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower()
    )
