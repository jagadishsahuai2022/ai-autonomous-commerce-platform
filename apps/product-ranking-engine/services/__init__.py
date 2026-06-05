"""Services module for product ranking engine."""

from .ranking_service import ProductRankingService

# Lazy import for kafka (requires confluent_kafka which may not be installed locally)
def get_kafka_service():
    from .kafka_service import get_kafka_service as _get
    return _get()

def _lazy_kafka():
    from .kafka_service import KafkaService as _KafkaService
    return _KafkaService

# V2 imports
from .ranking_service_v2 import ProductRankingService as ProductRankingServiceV2
from .scorer_registry import SCORERS, execute_scorer, ScorerContext
from .dimension_weights import DimensionWeightsCache, get_active_dimensions

__all__ = [
    "ProductRankingService",
    "ProductRankingServiceV2",
    "SCORERS",
    "execute_scorer",
    "ScorerContext",
    "DimensionWeightsCache",
    "get_active_dimensions",
    "get_kafka_service",
]
