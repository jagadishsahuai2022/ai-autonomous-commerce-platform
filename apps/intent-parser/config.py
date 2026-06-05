"""Configuration management for Intent Parser Service."""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # LLM Configuration
    llm_provider: str = "openai"  # openai or anthropic
    openai_api_key: str = ""
    openai_model: str = "gpt-4-turbo-preview"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-opus-20240229"

    # Kafka Configuration
    kafka_bootstrap_servers: str = "kafka:29092"
    kafka_consumer_group: str = "intent-parser-service"
    kafka_topic_buy_request: str = "buy_request.created"
    kafka_topic_intent_processed: str = "intent.processed"
    kafka_security_protocol: str = "PLAINTEXT"

    # API Configuration
    host: str = "0.0.0.0"
    port: int = 3002
    log_level: str = "INFO"
    environment: str = "development"

    # Service Configuration
    intent_confidence_threshold: float = 0.7
    llm_temperature: float = 0.3
    llm_max_tokens: int = 500

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
