"""Redis caching service for product search results."""

import json
import logging
from typing import Optional
from datetime import datetime, timedelta
import redis
from redis.asyncio import Redis as AsyncRedis
from models import SearchResponse
from config import get_settings

logger = logging.getLogger(__name__)


class CacheService:
    """Service for managing Redis cache."""

    def __init__(self, redis_url: Optional[str] = None, ttl: Optional[int] = None, enabled: bool = True):
        """
        Initialize cache service.
        
        Args:
            redis_url: Redis connection URL
            ttl: Time-to-live in seconds for cache entries
            enabled: Whether caching is enabled
        """
        self.settings = get_settings()
        self.redis_url = redis_url or self.settings.redis_url
        self.ttl = ttl or self.settings.redis_ttl
        self.enabled = enabled and self.settings.cache_enabled
        self.redis_client: Optional[AsyncRedis] = None

    async def connect(self):
        """Connect to Redis."""
        if not self.enabled:
            logger.info("Redis caching disabled")
            return
        
        try:
            self.redis_client = await AsyncRedis.from_url(self.redis_url)
            # Test connection
            await self.redis_client.ping()
            logger.info("Connected to Redis cache")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {str(e)}")
            self.redis_client = None
            self.enabled = False

    async def disconnect(self):
        """Disconnect from Redis."""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Disconnected from Redis")

    async def is_connected(self) -> bool:
        """Check if Redis is connected."""
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            await self.redis_client.ping()
            return True
        except Exception as e:
            logger.error(f"Redis connection check failed: {str(e)}")
            return False

    def _generate_cache_key(self, user_id: int, intent_id: int, sort_by: str = "relevance") -> str:
        """Generate cache key from request parameters."""
        return f"products:{user_id}:{intent_id}:{sort_by}"

    async def get(self, user_id: int, intent_id: int, sort_by: str = "relevance") -> Optional[SearchResponse]:
        """
        Get cached search results.
        
        Args:
            user_id: User ID
            intent_id: Intent request ID
            sort_by: Sort criteria
            
        Returns:
            Cached SearchResponse or None if not found/expired
        """
        if not self.enabled or not self.redis_client:
            return None
        
        try:
            cache_key = self._generate_cache_key(user_id, intent_id, sort_by)
            cached_data = await self.redis_client.get(cache_key)
            
            if cached_data:
                logger.debug(f"Cache hit for key: {cache_key}")
                response_dict = json.loads(cached_data)
                
                # Add cache_hit flag to response
                response_dict['cache_hit'] = True
                
                # Convert timestamp strings back to datetime
                response_dict['search_timestamp'] = datetime.fromisoformat(
                    response_dict['search_timestamp']
                )
                
                return SearchResponse(**response_dict)
            
            logger.debug(f"Cache miss for key: {cache_key}")
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving from cache: {str(e)}")
            return None

    async def set(self, user_id: int, intent_id: int, response: SearchResponse, 
                  sort_by: str = "relevance", ttl: Optional[int] = None):
        """
        Cache search results.
        
        Args:
            user_id: User ID
            intent_id: Intent request ID
            response: SearchResponse to cache
            sort_by: Sort criteria
            ttl: Time-to-live override (seconds)
        """
        if not self.enabled or not self.redis_client:
            return
        
        try:
            cache_key = self._generate_cache_key(user_id, intent_id, sort_by)
            ttl_seconds = ttl or self.ttl
            
            # Create a dict version of response for JSON serialization
            response_dict = response.model_dump()
            response_dict['search_timestamp'] = response_dict['search_timestamp'].isoformat()
            
            # Serialize to JSON
            cache_data = json.dumps(response_dict)
            
            # Store in Redis with TTL
            await self.redis_client.setex(
                cache_key,
                ttl_seconds,
                cache_data
            )
            
            logger.debug(f"Cached results for key: {cache_key} (TTL: {ttl_seconds}s)")
            
        except Exception as e:
            logger.error(f"Error storing in cache: {str(e)}")

    async def invalidate(self, user_id: int, intent_id: Optional[int] = None):
        """
        Invalidate cache for a user or specific intent.
        
        Args:
            user_id: User ID
            intent_id: Optional specific intent ID to invalidate
        """
        if not self.enabled or not self.redis_client:
            return
        
        try:
            if intent_id:
                # Invalidate specific intent cache
                pattern = f"products:{user_id}:{intent_id}:*"
            else:
                # Invalidate all cache for user
                pattern = f"products:{user_id}:*"
            
            cursor = 0
            while True:
                cursor, keys = await self.redis_client.scan(
                    cursor,
                    match=pattern,
                    count=100
                )
                
                if keys:
                    await self.redis_client.delete(*keys)
                    logger.info(f"Invalidated {len(keys)} cache keys matching {pattern}")
                
                if cursor == 0:
                    break
                    
        except Exception as e:
            logger.error(f"Error invalidating cache: {str(e)}")

    async def clear_all(self):
        """Clear all cache entries."""
        if not self.enabled or not self.redis_client:
            return
        
        try:
            cursor = 0
            total_cleared = 0
            
            while True:
                cursor, keys = await self.redis_client.scan(
                    cursor,
                    match="products:*",
                    count=100
                )
                
                if keys:
                    await self.redis_client.delete(*keys)
                    total_cleared += len(keys)
                
                if cursor == 0:
                    break
            
            logger.info(f"Cleared {total_cleared} cache entries")
            
        except Exception as e:
            logger.error(f"Error clearing cache: {str(e)}")

    async def get_stats(self) -> dict:
        """Get cache statistics."""
        if not self.enabled or not self.redis_client:
            return {"status": "disabled"}
        
        try:
            info = await self.redis_client.info()
            keys_result = await self.redis_client.dbsize()
            
            return {
                "status": "connected",
                "total_keys": keys_result,
                "used_memory": info.get("used_memory_human", "N/A"),
                "connected_clients": info.get("connected_clients", 0),
                "expired_keys": info.get("expired_keys", 0)
            }
            
        except Exception as e:
            logger.error(f"Error getting cache stats: {str(e)}")
            return {"status": "error", "error": str(e)}
