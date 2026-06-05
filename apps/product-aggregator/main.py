"""FastAPI Product Aggregator Service."""

import logging
import asyncio
import platform
from contextlib import asynccontextmanager
from typing import Optional
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, BackgroundTasks, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from config import settings
from models import (
    SearchRequest,
    SearchResponse,
    ProcessedIntent,
    HealthResponse,
    ErrorResponse,
    ProductsFetchedEvent
)
from services.cache_service import CacheService
from services.product_aggregator_service import ProductAggregatorService
from services.kafka_service import KafkaService

# Logging configuration
logging.basicConfig(
    level=settings.log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Global service instances
cache_service: Optional[CacheService] = None
aggregator_service: Optional[ProductAggregatorService] = None
kafka_service: Optional[KafkaService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # Startup
    logger.info(
        f"Starting Product Aggregator Service "
        f"| Python {platform.python_version()} ({platform.python_implementation()}) "
        f"| FastAPI lifespan"
    )
    try:
        global cache_service, aggregator_service, kafka_service
        
        # Initialize cache service
        cache_service = CacheService()
        await cache_service.connect()
        logger.info("Cache service initialized")
        
        # Initialize aggregator service
        aggregator_service = ProductAggregatorService(cache_service=cache_service)
        logger.info("Aggregator service initialized")
        
        # Initialize Kafka service
        kafka_service = KafkaService()
        await kafka_service.initialize_producer()
        await kafka_service.initialize_consumer()
        
        # Start Kafka consumer in background thread
        kafka_service.start_consuming_thread(callback=handle_intent_event)
        logger.info("Kafka service initialized")
        
        logger.info("Product Aggregator Service started successfully")
        
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Product Aggregator Service...")
    try:
        if kafka_service:
            await kafka_service.close()
        
        if cache_service:
            await cache_service.disconnect()
        
        if aggregator_service:
            await aggregator_service.close()
        
        logger.info("Product Aggregator Service shutdown complete")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")


# Create FastAPI app
app = FastAPI(
    title=settings.service_name,
    version=settings.service_version,
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


# ===================== Event Handlers =====================

async def handle_intent_event(message: dict):
    """Handle intent.processed events from Kafka."""
    try:
        logger.info(f"Received intent event: {message}")
        
        # Parse intent from event
        intent_data = message.get("data", {})
        intent = ProcessedIntent(**intent_data)
        
        # Process search
        if aggregator_service:
            response = await aggregator_service.search(intent)
            
            # Produce products.fetched event
            if kafka_service:
                event = KafkaService.products_fetched_event(
                    request_id=response.request_id,
                    user_id=response.user_id,
                    product_count=response.total_products,
                    sources=response.sources_searched,
                    duration_ms=response.search_duration_ms
                )
                
                await kafka_service.produce_message(
                    settings.kafka_topic_products_fetched,
                    event
                )
                
                logger.info(f"Produced products.fetched event for request {response.request_id}")
        
    except Exception as e:
        logger.error(f"Error handling intent event: {str(e)}")


async def produce_products_fetched_event(response: SearchResponse):
    """Background task to produce products.fetched event."""
    if kafka_service:
        try:
            event = KafkaService.products_fetched_event(
                request_id=response.request_id,
                user_id=response.user_id,
                product_count=response.total_products,
                sources=response.sources_searched,
                duration_ms=response.search_duration_ms
            )
            
            await kafka_service.produce_message(
                settings.kafka_topic_products_fetched,
                event
            )
            
        except Exception as e:
            logger.error(f"Error producing products.fetched event: {str(e)}")


# ===================== Endpoints =====================

@app.get("/", tags=["info"])
async def root():
    """Root endpoint with service information."""
    return {
        "service": settings.service_name,
        "version": settings.service_version,
        "description": "Product Search Aggregator Service",
        "endpoints": {
            "health": "/health",
            "search": "/search",
            "cache_stats": "/cache/stats",
            "cache_clear": "/cache/clear"
        }
    }


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    """Health check endpoint."""
    try:
        redis_connected = False
        kafka_connected = False
        
        if cache_service:
            redis_connected = await cache_service.is_connected()
        
        if kafka_service:
            kafka_connected = await kafka_service.check_connectivity()
        
        return HealthResponse(
            status="healthy",
            version=settings.service_version,
            redis_connected=redis_connected,
            kafka_connected=kafka_connected
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service health check failed"
        )


@app.post(
    "/search",
    response_model=SearchResponse,
    status_code=status.HTTP_200_OK,
    tags=["search"]
)
async def search_products(request: SearchRequest, background_tasks: BackgroundTasks):
    """
    Search for products across multiple sources.
    
    Input: ProcessedIntent from Intent Parser Service
    Output: Aggregated list of products with unified DTO
    """
    try:
        logger.info(f"Starting product search for user {request.intent.userId}")
        
        if not aggregator_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Aggregator service not ready"
            )
        
        # Perform search
        response = await aggregator_service.search(
            intent=request.intent,
            include_sources=request.include_sources,
            limit=request.limit,
            sort_by=request.sort_by
        )
        
        # Produce event in background
        background_tasks.add_task(produce_products_fetched_event, response)
        
        logger.info(f"Search complete: {response.total_products} products found")
        
        return response
        
    except Exception as e:
        logger.error(f"Error searching products: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error searching products"
        )


@app.get("/cache/stats", tags=["cache"])
async def cache_stats():
    """Get cache statistics."""
    try:
        if not cache_service:
            return {"status": "cache service not initialized"}
        
        stats = await cache_service.get_stats()
        return stats
        
    except Exception as e:
        logger.error(f"Error getting cache stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving cache statistics"
        )


@app.post("/cache/clear", tags=["cache"])
async def cache_clear(user_id: Optional[int] = None):
    """Clear cache entries."""
    try:
        if not cache_service:
            return {"status": "cache service not initialized"}
        
        if user_id:
            await cache_service.invalidate(user_id)
            return {"status": "cleared", "message": f"Cleared cache for user {user_id}"}
        else:
            await cache_service.clear_all()
            return {"status": "cleared", "message": "Cleared all cache entries"}
            
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error clearing cache"
        )


@app.post("/mock-intent", tags=["testing"])
async def mock_intent_search(request: SearchRequest, background_tasks: BackgroundTasks):
    """Mock endpoint for testing without connecting to Intent Parser."""
    try:
        if not aggregator_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Aggregator service not ready"
            )
        
        response = await aggregator_service.search(
            intent=request.intent,
            include_sources=request.include_sources,
            limit=request.limit,
            sort_by=request.sort_by
        )
        
        background_tasks.add_task(produce_products_fetched_event, response)
        
        return response
        
    except Exception as e:
        logger.error(f"Error in mock search: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error in product search"
        )


# ===================== Error Handlers =====================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "code": "HTTP_ERROR",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "code": "INTERNAL_SERVER_ERROR",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.environment == "development",
        log_level=settings.log_level.lower()
    )
