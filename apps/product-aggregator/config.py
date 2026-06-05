"""Configuration management for Product Aggregator Service."""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Application settings from environment variables."""

    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 3003
    log_level: str = "INFO"

    # Redis Configuration
    redis_url: str = "redis://redis:6379/0"
    redis_ttl: int = 3600  # seconds
    cache_enabled: bool = True

    # Kafka Configuration
    kafka_bootstrap_servers: str = "kafka:29092"
    kafka_consumer_group: str = "product-aggregator-service"
    kafka_topic_intent_processed: str = "intent.processed"
    kafka_topic_products_fetched: str = "products.fetched"
    kafka_fetch_timeout_ms: int = 5000

    # Database Configuration
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "postgres"
    db_password: str = "postgres"
    db_name: str = "delegatecart"
    db_pool_size: int = 10

    # External API Configuration
    amazon_api_url: str = "http://localhost:3004/api/products"
    flipkart_api_url: str = "http://localhost:3005/api/products"
    amazon_api_timeout: int = 5
    flipkart_api_timeout: int = 5

    # Search Configuration
    max_results_per_source: int = 10
    aggregator_timeout: int = 10
    min_confidence_threshold: float = 0.0
    sort_by_relevance: bool = True

    # Service Configuration
    service_name: str = "product-aggregator"
    service_version: str = "1.0.0"
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()
