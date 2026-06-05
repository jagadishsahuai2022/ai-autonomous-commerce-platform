"""Configuration management for Product Ranking Engine."""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Application settings from environment variables."""

    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    log_level: str = "INFO"

    # Kafka Configuration
    kafka_bootstrap_servers: str = "kafka:29092"
    kafka_consumer_group: str = "product-ranking-engine-service"
    kafka_topic_products_fetched: str = "products.fetched"
    kafka_topic_products_ranked: str = "products.ranked"
    kafka_fetch_timeout_ms: int = 5000

    # Database Configuration (for dimension weights)
    db_host: str = "postgres"
    db_port: int = 5432
    db_name: str = "delegatecart"
    db_user: str = "admin"
    db_password: str = "password"

    # Ranking Weights (must sum to 1.0)
    weight_budget_fit: float = 0.25
    weight_quality_score: float = 0.25
    weight_brand_preference: float = 0.20
    weight_delivery_speed: float = 0.15
    weight_ratings: float = 0.15

    # Ranking Algorithm
    min_confidence_threshold: float = 0.0
    score_precision: int = 2
    use_ai_explanation: bool = True

    # Service Configuration
    service_name: str = "product-ranking-engine"
    service_version: str = "1.0.0"
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    def validate_weights(self):
        """Validate that weights sum to 1.0."""
        total = (
            self.weight_budget_fit +
            self.weight_quality_score +
            self.weight_brand_preference +
            self.weight_delivery_speed +
            self.weight_ratings
        )
        
        if abs(total - 1.0) > 0.001:
            raise ValueError(
                f"Weights must sum to 1.0, got {total}: "
                f"budget_fit={self.weight_budget_fit}, "
                f"quality={self.weight_quality_score}, "
                f"brand={self.weight_brand_preference}, "
                f"delivery={self.weight_delivery_speed}, "
                f"ratings={self.weight_ratings}"
            )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Get cached settings instance."""
    settings = Settings()
    settings.validate_weights()
    return settings
