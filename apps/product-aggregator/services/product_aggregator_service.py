"""Product aggregation service orchestrator - Production-Grade."""

import asyncio
import logging
import time
from typing import List, Optional
from datetime import datetime

from models import SearchResponse, ProductDTO, ProcessedIntent
from adapters import InternalDBAdapter, AmazonAdapter, FlipkartAdapter
from services.cache_service import CacheService
from config import get_settings
from resilience import ( 
    retry_async, 
    RetryConfig, 
    CircuitBreaker,
    TimeoutManager,
    TimeoutException
)
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class ProductAggregatorService:
    """Service for aggregating products from multiple sources with resilience."""

    def __init__(self, cache_service: Optional[CacheService] = None):
        """Initialize aggregator service with resilience patterns."""
        self.settings = get_settings()
        self.cache_service = cache_service
        
        # Initialize adapters
        self.internal_adapter = InternalDBAdapter()
        self.amazon_adapter = AmazonAdapter(
            api_url=self.settings.amazon_api_url,
            timeout=self.settings.amazon_api_timeout
        )
        self.flipkart_adapter = FlipkartAdapter(
            api_url=self.settings.flipkart_api_url,
            timeout=self.settings.flipkart_api_timeout
        )
        
        self.adapters = {
            "internal": self.internal_adapter,
            "amazon": self.amazon_adapter,
            "flipkart": self.flipkart_adapter,
        }
        
        # Initialize circuit breakers for external APIs
        self.circuit_breakers = {
            "amazon": CircuitBreaker(
                "amazon_api",
                failure_threshold=5,
                success_threshold=2,
                timeout_seconds=60
            ),
            "flipkart": CircuitBreaker(
                "flipkart_api",
                failure_threshold=5,
                success_threshold=2,
                timeout_seconds=60
            ),
        }

    async def search(
        self, 
        intent: ProcessedIntent, 
        include_sources: Optional[List[str]] = None,
        limit: int = 20, 
        sort_by: str = "relevance"
    ) -> SearchResponse:
        """
        Search for products across multiple sources with resilience.
        
        Features:
        - Parallel searches with retry
        - Circuit breaker on external APIs
        - Timeout management
        - Graceful degradation
        - Cache fallback
        """
        if include_sources is None:
            include_sources = ["internal", "amazon", "flipkart"]
        
        start_time = time.time()
        correlation_id = intent.requestId
        
        # Extract search parameters from intent
        query = intent.inferred_use_case.get("primary_use_case", "")
        keywords: List[str] = [str(kw.get("keyword", "")) for kw in intent.refined_keywords if kw.get("keyword")]
        brands = intent.brand_priority_score.get("specified_brands", [])
        max_price = intent.budget_clarity_score.get("max_budget", float("inf"))
        
        logger.info(
            f"[{correlation_id}] Starting product search: query={query}, sources={include_sources}"
        )
        
        # Check cache first (with fallback on network issues)
        if self.cache_service:
            try:
                cached_result = await TimeoutManager.with_timeout(
                    self.cache_service.get(intent.userId, correlation_id, sort_by),
                    timeout_seconds=5,
                    operation_name="cache_get"
                )
                if cached_result:
                    logger.info(f"[{correlation_id}] Returning cached results")
                    return cached_result
            except TimeoutException:
                logger.warning(f"[{correlation_id}] Cache timeout, proceeding with search")
            except Exception as e:
                logger.warning(f"[{correlation_id}] Cache error: {e}")
        
        # Build search tasks with resilience
        tasks = []
        source_configs = []
        
        for source_name in include_sources:
            if source_name not in self.adapters:
                continue
                
            adapter = self.adapters[source_name]
            
            # Determine retry config based on source
            if source_name == "internal":
                retry_config = RetryConfig.QUICK  # Internal DB should be fast
            else:
                retry_config = RetryConfig.MODERATE  # External APIs: retry more
            
            # Create resilient search task
            task = self._resilient_search(
                source_name=source_name,
                adapter=adapter,
                query=query,
                keywords=keywords,
                brands=brands,
                max_price=max_price,
                retry_config=retry_config,
                correlation_id=correlation_id
            )
            tasks.append(task)
            source_configs.append(source_name)
        
        # Execute all searches in parallel with timeout
        try:
            search_results = await TimeoutManager.with_timeout(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout_seconds=self.settings.aggregator_timeout,
                operation_name="parallel_search"
            )
        except TimeoutException:
            logger.error(f"[{correlation_id}] Search timeout, using partial results")
            search_results = []
        
        # Aggregate results with graceful degradation
        all_products = []
        failed_sources = []
        
        for source_name, result in zip(source_configs, search_results):
            if isinstance(result, Exception):
                logger.error(f"[{correlation_id}] {source_name} search failed: {result}")
                failed_sources.append(source_name)
            elif result:
                try:
                    all_products.extend(result.get("products", []))
                    logger.debug(f"[{correlation_id}] {source_name}: {len(result.get('products', []))} products")
                except Exception as e:
                    logger.error(f"[{correlation_id}] Error processing {source_name} results: {e}")
                    failed_sources.append(source_name)
        
        # Deduplicate and sort products
        unique_products = self._deduplicate_products(all_products)
        sorted_products = self._sort_products(unique_products, sort_by)[:limit]
        
        # Build response
        response = SearchResponse(
            request_id=correlation_id,
            user_id=intent.userId,
            query=query,
            products=[ProductDTO(**p) if isinstance(p, dict) else p for p in sorted_products],
            total_products=len(sorted_products),
            sources_searched=source_configs,
            search_duration_ms=int((time.time() - start_time) * 1000),
            cache_hit=False
        )
        
        # Cache the result
        if self.cache_service and sorted_products:
            try:
                await self.cache_service.set(
                    user_id=intent.userId, 
                    intent_id=correlation_id, 
                    response=response,
                    sort_by=sort_by
                )
            except Exception as e:
                logger.warning(f"[{correlation_id}] Failed to cache results: {e}")
        
        logger.info(
            f"[{correlation_id}] Search completed: {len(sorted_products)} products, "
            f"failed sources: {failed_sources}, time: {response.search_duration_ms}ms"
        )
        
        return response

    async def _resilient_search(
        self,
        source_name: str,
        adapter,
        query: str,
        keywords: List[str],
        brands: List[str],
        max_price: float,
        retry_config: Optional[RetryConfig] = None,
        correlation_id: int = 0
    ) -> Optional[dict]:
        """Execute search with retry and circuit breaker logic."""
        
        if retry_config is None:
            retry_config = RetryConfig.MODERATE
        
        # Use circuit breaker for external APIs
        if source_name in self.circuit_breakers:
            breaker = self.circuit_breakers[source_name]
            try:
                return await breaker.call_async(
                    self._search_with_timeout,
                    adapter,
                    query,
                    keywords,
                    brands,
                    max_price,
                    correlation_id
                )
            except Exception as e:
                logger.error(f"[{correlation_id}] {source_name} circuit breaker: {e}")
                # Return empty result but don't fail completely
                return {"products": []}
        
        # For internal source, use retry with timeout
        async def search_fn():
            return await self._search_with_timeout(
                adapter,
                query,
                keywords,
                brands,
                max_price,
                correlation_id
            )
        
        try:
            result = await retry_async(
                search_fn,
                config=retry_config,
                operation_name=f"{source_name}_search"
            )
            return result
        except Exception as e:
            logger.error(f"[{correlation_id}] {source_name} search failed after retries: {e}")
            return None

    async def _search_with_timeout(
        self,
        adapter,
        query: str,
        keywords: List[str],
        brands: List[str],
        max_price: float,
        correlation_id: int
    ) -> dict:
        """Execute search with timeout."""
        timeout_seconds = self.settings.aggregator_timeout
        
        try:
            result = await TimeoutManager.with_timeout(
                adapter.search(
                    query=query,
                    keywords=keywords,
                    brands=brands,
                    max_price=max_price,
                    limit=self.settings.max_results_per_source
                ),
                timeout_seconds=timeout_seconds,
                operation_name=f"adapter_search_{adapter.__class__.__name__}"
            )
            return result
        except TimeoutException as e:
            logger.error(f"[{correlation_id}] Adapter timeout: {e}")
            raise
        except Exception as e:
            logger.error(f"[{correlation_id}] Adapter error: {e}")
            raise

    def _deduplicate_products(self, products: List[dict]) -> List[dict]:
        """Remove duplicate products by ID."""
        seen_ids = set()
        unique = []
        for product in products:
            product_id = product.get("id") or product.get("productId")
            if product_id not in seen_ids:
                seen_ids.add(product_id)
                unique.append(product)
        return unique

    def _sort_products(self, products: List[dict], sort_by: str) -> List[dict]:
        """Sort products by criteria."""
        if sort_by == "price_asc":
            return sorted(products, key=lambda p: p.get("price", float("inf")))
        elif sort_by == "price_desc":
            return sorted(products, key=lambda p: p.get("price", 0), reverse=True)
        elif sort_by == "rating":
            return sorted(products, key=lambda p: p.get("rating", 0), reverse=True)
        else:  # relevance (default)
            return sorted(products, key=lambda p: p.get("relevanceScore", 0), reverse=True)

    async def get_product_by_id(self, source: str, product_id: str) -> Optional[ProductDTO]:
        """Get a specific product by ID from a source."""
        adapter = self.adapters.get(source)
        
        if not adapter:
            logger.error(f"Unknown source: {source}")
            return None
        
        try:
            product = await adapter.get_product_by_id(product_id)
            return product
        except Exception as e:
            logger.error(f"Error retrieving product {product_id} from {source}: {str(e)}")
            return None

    async def close(self):
        """Close all adapter connections."""
        try:
            if hasattr(self.amazon_adapter, 'close'):
                await self.amazon_adapter.close()
            if hasattr(self.flipkart_adapter, 'close'):
                await self.flipkart_adapter.close()
            logger.info("All adapters closed")
        except Exception as e:
            logger.error(f"Error closing adapters: {str(e)}")
