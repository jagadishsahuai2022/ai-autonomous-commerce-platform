"""Main FastAPI application for product ranking engine."""

import logging
import sys
import platform
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings
from models import (
    RankingRequest,
    RankingResponse,
    HealthResponse,
    ErrorResponse,
)
from services.ranking_service import ProductRankingService
from services.ranking_service_v2 import ProductRankingService as ProductRankingServiceV2
from services.kafka_service import get_kafka_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("ranking_engine.log"),
    ],
)

logger = logging.getLogger(__name__)

# Initialize services
settings = get_settings()
ranking_service = ProductRankingService()
ranking_service_v2 = ProductRankingServiceV2()
kafka_service = get_kafka_service()

# Set ranking service for Kafka (V2 by default)
kafka_service.ranking_service = ranking_service_v2


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # Startup
    logger.info(
        f"Starting {settings.service_name} v{settings.service_version} "
        f"| Python {platform.python_version()} | FastAPI lifespan"
    )
    try:
        kafka_service.initialize()
        kafka_service.start_consuming()
        logger.info("Application started successfully with Kafka")
    except Exception as e:
        logger.warning(
            f"Kafka unavailable at startup — running in API-only mode: {e}"
        )
        # Service stays up for HTTP ranking requests (/rank/v2) even without Kafka.
        # A background retry will attempt reconnection.
        import asyncio

        async def _retry_kafka():
            for attempt in range(1, 11):
                await asyncio.sleep(min(2 ** attempt, 60))
                try:
                    kafka_service.initialize()
                    kafka_service.start_consuming()
                    logger.info(f"Kafka connected on retry attempt {attempt}")
                    return
                except Exception as retry_err:
                    logger.warning(f"Kafka retry {attempt}/10 failed: {retry_err}")
            logger.error("Kafka: all 10 retry attempts exhausted — Kafka features disabled")

        asyncio.create_task(_retry_kafka())

    yield

    # Shutdown — clean consumer commit before close prevents offset regression
    logger.info("Shutting down Product Ranking Engine...")
    kafka_service.close()
    logger.info("Application shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Product Ranking Engine",
    description="Weighted ranking system for e-commerce products",
    version=settings.service_version,
    lifespan=lifespan,
)

# CORS middleware — allows browser health checks from the web dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3010", "http://localhost:3001"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ============================================================================
# Health Check Endpoints
# ============================================================================

@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Health check endpoint",
)
async def health_check() -> HealthResponse:
    """
    Check service health status.
    
    Returns:
        HealthResponse with service status and version
    """
    return HealthResponse(
        status="healthy",
        version=settings.service_version,
        kafka_connected=kafka_service is not None and kafka_service.producer is not None,
    )


@app.get(
    "/health/ready",
    tags=["Health"],
    summary="Readiness check",
)
async def readiness_check():
    """
    Check if service is ready to process requests.
    
    Returns:
        Status and readiness details
    """
    return {
        "ready": True,
        "kafka_connected": kafka_service.consumer is not None,
        "kafka_consuming": kafka_service.running,
    }


@app.get(
    "/health/v2",
    tags=["Health"],
    summary="V2 engine health check",
)
async def health_v2():
    """Check V2 dimension-based ranking engine health."""
    try:
        from services.dimension_weights import get_active_dimensions
        dims = get_active_dimensions()  # sync function
        return {
            "status": "healthy",
            "engine": "v2-dimension-based",
            "dimensions_loaded": len(dims),
            "version": settings.service_version,
        }
    except Exception as e:
        return {
            "status": "degraded",
            "engine": "v2-dimension-based",
            "dimensions_loaded": 0,
            "error": str(e),
        }


# ============================================================================
# Ranking Endpoints
# ============================================================================

@app.post(
    "/rank",
    response_model=RankingResponse,
    tags=["Ranking"],
    summary="Rank products",
    description="Rank a list of products using weighted scoring algorithm",
)
async def rank_products(request: RankingRequest) -> JSONResponse:
    """
    Rank products using weighted scoring.
    
    Args:
        request: Ranking request with products and constraints
        
    Returns:
        Ranked products with explanations
        
    Raises:
        HTTPException: If ranking fails
    """
    try:
        logger.info(
            f"Received ranking request {request.request_id} "
            f"with {len(request.products)} products"
        )

        response = await ranking_service.rank_products(request)

        logger.info(
            f"Ranking complete for {request.request_id}: "
            f"Best product score: {response.best_product.score if response.best_product else 0:.2f}"
        )

        # Use model_dump(mode='json') to handle datetime serialization
        return JSONResponse(content=response.model_dump(mode='json'))

    except ValueError as e:
        logger.warning(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    except Exception as e:
        logger.error(f"Error ranking products: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during ranking"
        )


@app.post(
    "/rank/v2",
    response_model=RankingResponse,
    tags=["Ranking"],
    summary="Rank products (V2 — 22-dimension engine)",
    description="Rank products using the 22-dimension scoring engine with DB-configurable weights",
)
async def rank_products_v2(request: RankingRequest) -> RankingResponse:
    """Rank products using V2 dimension-based scoring."""
    try:
        logger.info(
            f"V2 ranking request {request.request_id}: "
            f"{len(request.products)} products"
        )
        response = await ranking_service_v2.rank_products(request)
        logger.info(
            f"V2 ranking complete: best={response.best_product.score if response.best_product else 0:.3f}"
        )
        return response
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"V2 ranking error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during V2 ranking"
        )


@app.post(
    "/rank/batch",
    tags=["Ranking"],
    summary="Rank multiple requests",
    description="Process multiple ranking requests (useful for testing)",
)
async def rank_batch(requests: list[RankingRequest]):
    """
    Process multiple ranking requests.
    
    Args:
        requests: List of ranking requests
        
    Returns:
        List of ranking responses
    """
    try:
        logger.info(f"Processing batch of {len(requests)} ranking requests")

        results = []
        for req in requests:
            response = await ranking_service.rank_products(req)
            results.append(response.model_dump())

        return {
            "total_requests": len(requests),
            "results": results
        }

    except Exception as e:
        logger.error(f"Error processing batch: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing batch requests"
        )


# ============================================================================
# Configuration Endpoints
# ============================================================================

@app.get(
    "/config/weights",
    tags=["Configuration"],
    summary="Get current scoring weights",
)
async def get_weights():
    """Get current scoring weights (legacy 5-weight + V2 22-dimension)."""
    from services.dimension_weights import get_active_dimensions
    dimensions = get_active_dimensions()
    return {
        "legacy_weights": {
            "budget_fit": settings.weight_budget_fit,
            "quality_score": settings.weight_quality_score,
            "brand_preference": settings.weight_brand_preference,
            "delivery_speed": settings.weight_delivery_speed,
            "ratings": settings.weight_ratings,
        },
        "v2_dimensions": [
            {"key": d.key, "weight": d.weightage, "group": d.group, "scorer": d.scorer_key, "negative": d.is_negative}
            for d in dimensions
        ],
        "v2_total_weight": round(sum(d.weightage for d in dimensions), 4),
        "v2_dimension_count": len(dimensions),
    }


@app.get(
    "/config",
    tags=["Configuration"],
    summary="Get service configuration",
)
async def get_config():
    """
    Get service configuration (non-sensitive).
    
    Returns:
        Configuration summary
    """
    return {
        "service": settings.service_name,
        "version": settings.service_version,
        "environment": settings.environment,
        "log_level": settings.log_level,
        "kafka_topic_in": settings.kafka_topic_products_fetched,
        "kafka_topic_out": settings.kafka_topic_products_ranked,
        "min_confidence_threshold": settings.min_confidence_threshold,
        "score_precision": settings.score_precision,
    }


# ============================================================================
# Error Handlers
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions."""
    logger.error(f"HTTP {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.detail,
            code=str(exc.status_code),
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error="Internal server error",
            code="500",
        ).model_dump(),
    )


# ============================================================================
# Root Endpoints
# ============================================================================

@app.get("/", tags=["General"])
async def root():
    """Root endpoint with service info."""
    return {
        "service": settings.service_name,
        "version": settings.service_version,
        "description": "Product ranking engine with weighted scoring",
        "docs": "/docs",
        "openapi": "/openapi.json",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        log_level=settings.log_level.lower(),
    )
