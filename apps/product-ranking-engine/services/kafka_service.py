"""Kafka integration for product ranking engine."""

import json
import logging
import signal
import time
from threading import Thread
from typing import Any, Callable, Optional
from datetime import datetime, timezone

from confluent_kafka import Consumer, Producer, KafkaError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from models import (
    RankingRequest,
    RankingResponse,
    ProductDTO,
    ProductsRankedEvent,
)
from config import get_settings

logger = logging.getLogger(__name__)


class KafkaService:
    """Kafka integration for consuming and producing events."""

    def __init__(self):
        """Initialize Kafka service."""
        self.settings = get_settings()
        self.consumer = None
        self.producer = None
        self.running = False
        self.consumer_thread: Optional[Thread] = None
        self.ranking_service: Optional[Any] = None  # Will be set by FastAPI app

        signal.signal(signal.SIGTERM, self._handle_sigterm)

    def _handle_sigterm(self, signum, frame):
        """Graceful shutdown on SIGTERM."""
        logger.info("Received SIGTERM — stopping Kafka consumer gracefully")
        self.running = False
        if self.consumer:
            try:
                self.consumer.commit(asynchronous=False)
                logger.info("Final offset commit completed")
            except Exception as e:
                logger.warning(f"Offset commit on shutdown failed: {e}")
            try:
                self.consumer.close()
            except Exception as e:
                logger.warning(f"Consumer close on shutdown failed: {e}")

    def initialize(self):
        """Initialize Kafka consumer and producer (single attempt — caller handles retry)."""
        try:
            logger.info("Initializing Kafka service...")

            # Build using local vars first — only committed to self after probe succeeds
            consumer = Consumer({
                "bootstrap.servers": self.settings.kafka_bootstrap_servers,
                "group.id": self.settings.kafka_consumer_group,
                "auto.offset.reset": "earliest",
                "enable.auto.commit": True,
                "max.poll.interval.ms": 300000,
                "session.timeout.ms": 30000,
                "heartbeat.interval.ms": 10000,
            })

            producer = Producer({
                "bootstrap.servers": self.settings.kafka_bootstrap_servers,
                "acks": "all",
                "retries": 0,          # Saga safety: no retries to prevent double-publish
                "retry.backoff.ms": 100,
            })

            # Probe broker connectivity; raises if unreachable (5 s timeout)
            producer.list_topics(timeout=5)

            # Probe succeeded — commit to instance state
            self.consumer = consumer
            self.producer = producer
            logger.info("Kafka service initialized successfully")
            return True

        except Exception as e:
            logger.warning(f"Kafka init failed: {e}")
            raise

    def start_consuming(self):
        """Start consuming from Kafka topic in background thread."""
        if self.running:
            logger.warning("Kafka consumer already running")
            return

        self.running = True

        # Subscribe to topic
        self.consumer.subscribe([self.settings.kafka_topic_products_fetched])
        logger.info(
            f"Subscribed to Kafka topic: {self.settings.kafka_topic_products_fetched}"
        )

        # Start consumer thread
        self.consumer_thread = Thread(
            target=self._consume_loop,
            daemon=True,
            name="kafka-consumer"
        )
        self.consumer_thread.start()
        logger.info("Kafka consumer thread started")

    def stop_consuming(self):
        """Stop Kafka consumer."""
        self.running = False

        if self.consumer_thread and self.consumer_thread.is_alive():
            self.consumer_thread.join(timeout=10)
            if self.consumer_thread.is_alive():
                logger.warning("Consumer thread did not exit within timeout")

        if self.consumer:
            try:
                self.consumer.close()
            except Exception:
                pass

        logger.info("Kafka consumer stopped")

    def _consume_loop(self):
        """Main consumer loop with backoff on repeated poll errors."""
        consecutive_errors = 0
        try:
            while self.running:
                try:
                    msg = self.consumer.poll(timeout=1.0)
                except Exception as e:
                    consecutive_errors += 1
                    delay = min(2 ** consecutive_errors, 30)
                    logger.error(
                        f"Consumer poll error (attempt {consecutive_errors}): {e} "
                        f"— retrying in {delay}s"
                    )
                    if consecutive_errors >= 5:
                        logger.critical("Consumer poll failed too many times — stopping loop")
                        break
                    time.sleep(delay)
                    continue

                if msg is None:
                    consecutive_errors = 0
                    continue

                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        continue
                    else:
                        logger.error(f"Kafka consumer error: {msg.error()}")
                        continue

                consecutive_errors = 0

                try:
                    self._process_message(msg)
                except Exception as e:
                    logger.error(f"Error processing Kafka message: {str(e)}")

        except Exception as e:
            logger.error(f"Fatal error in consumer loop: {str(e)}")
        finally:
            logger.info("Consumer loop ended")

    def _process_message(self, msg):
        """Process incoming Kafka message."""
        try:
            # Decode message
            payload = json.loads(msg.value().decode("utf-8"))
            logger.debug(f"Received message: {payload.get('event_type')}")

            # Parse as RankingRequest (products.fetched event)
            event = payload
            request_id = event.get("request_id")
            user_id = event.get("user_id")
            products_data = event.get("products", [])

            # Convert to ProductDTO objects
            products = [
                ProductDTO(**product_data)
                for product_data in products_data
            ]

            # Create ranking request
            request = RankingRequest(
                request_id=request_id,
                user_id=user_id,
                products=products,
                budget_min=event.get("budget_min", 0),
                budget_max=event.get("budget_max", 999999),
                preferred_brands=event.get("preferred_brands", []),
                quality_threshold=event.get("quality_threshold", 0.5),
                preferred_delivery_days=event.get("preferred_delivery_days", 7),
            )

            # Rank products using ranking service
            if self.ranking_service is None:
                logger.error("Ranking service not initialized")
                return

            import asyncio
            response = asyncio.run(self.ranking_service.rank_products(request))

            # Produce ranked products event
            self.produce_ranked_event(response)

        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
    )
    def produce_ranked_event(self, response: RankingResponse):
        """Produce ranked products event to Kafka."""

        try:
            # Create event
            best_product_id = response.best_product.product.id if response.best_product else ""
            best_product_name = response.best_product.product.name if response.best_product else "N/A"
            best_product_score = response.best_product.score if response.best_product else 0.0

            event = ProductsRankedEvent(
                request_id=response.request_id,
                user_id=response.user_id,
                event_type="products.ranked",
                timestamp=datetime.now(timezone.utc),
                total_ranked=response.total_products,
                best_product_id=best_product_id,
                best_product_name=best_product_name,
                best_product_score=round(best_product_score, 3),
            )

            # Serialize to JSON
            value = json.dumps(event.model_dump()).encode("utf-8")

            # Send to Kafka
            self.producer.produce(
                topic=self.settings.kafka_topic_products_ranked,
                key=str(response.request_id).encode("utf-8"),
                value=value,
                callback=self._delivery_report
            )

            self.producer.flush()
            logger.info(
                f"Produced ranked event for request {response.request_id}: "
                f"{response.total_products} products ranked"
            )

        except Exception as e:
            logger.error(f"Error producing ranked event: {str(e)}")
            raise

    @staticmethod
    def _delivery_report(err, msg):
        """Report Kafka delivery status."""
        if err is not None:
            logger.error(f"Message delivery failed: {err}")
        else:
            logger.debug(
                f"Message delivered to {msg.topic()} "
                f"partition {msg.partition()} at offset {msg.offset()}"
            )

    def produce_manual(
        self,
        topic: str,
        key: str,
        value: dict,
        callback: Optional[Callable] = None
    ):
        """Produce message to Kafka manually."""

        try:
            value_json = json.dumps(value).encode("utf-8")

            self.producer.produce(
                topic=topic,
                key=key.encode("utf-8"),
                value=value_json,
                callback=callback or self._delivery_report
            )

            self.producer.flush()
            logger.info(f"Produced message to topic: {topic}")

        except Exception as e:
            logger.error(f"Error producing message: {str(e)}")
            raise

    def close(self):
        """Close Kafka connections."""
        self.stop_consuming()

        if self.producer:
            self.producer.flush()
            logger.info("Kafka producer flushed")


# Global instance
_kafka_service = None


def get_kafka_service() -> KafkaService:
    """Get Kafka service instance."""
    global _kafka_service
    if _kafka_service is None:
        _kafka_service = KafkaService()
    return _kafka_service
