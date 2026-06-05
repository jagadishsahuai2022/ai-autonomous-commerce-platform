"""Kafka service for event-driven product aggregation."""

import json
import logging
import signal
import threading
import time
from typing import Callable, Optional
from datetime import datetime, timezone
from confluent_kafka import Producer, Consumer, KafkaError
from models import ProcessedIntent, ProductsFetchedEvent
from config import get_settings

logger = logging.getLogger(__name__)

_MAX_RETRY_ATTEMPTS = 5


def _backoff_delay(attempt: int) -> float:
    return min(2 ** attempt, 30)


class KafkaEventType:
    """Kafka event type constants."""
    INTENT_PROCESSED = "intent.processed"
    PRODUCTS_FETCHED = "products.fetched"


class KafkaService:
    """Service for managing Kafka producer and consumer."""

    def __init__(self):
        """Initialize Kafka service."""
        self.settings = get_settings()
        self.producer: Optional[Producer] = None
        self.consumer: Optional[Consumer] = None
        self._consumer_thread: Optional[threading.Thread] = None
        self._stop_consuming = False

        signal.signal(signal.SIGTERM, self._handle_sigterm)

    def _handle_sigterm(self, signum, frame):
        """Graceful shutdown on SIGTERM."""
        logger.info("Received SIGTERM — stopping Kafka consumer gracefully")
        self._stop_consuming = True
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

    def _get_config(self):
        """Get Kafka configuration."""
        return {
            "bootstrap.servers": self.settings.kafka_bootstrap_servers,
        }

    async def initialize_producer(self) -> bool:
        """Initialize Kafka producer with retry/backoff."""
        for attempt in range(_MAX_RETRY_ATTEMPTS):
            try:
                config = self._get_config()
                self.producer = Producer(config)
                logger.info(
                    "Kafka Producer initialized",
                    extra={"attempt": attempt},
                )
                return True
            except Exception as e:
                delay = _backoff_delay(attempt)
                logger.error(
                    "Kafka Producer init failed",
                    extra={"attempt": attempt, "error": str(e), "retry_in_seconds": delay},
                )
                if attempt < _MAX_RETRY_ATTEMPTS - 1:
                    time.sleep(delay)
        return False

    async def initialize_consumer(self) -> bool:
        """Initialize Kafka consumer with retry/backoff."""
        for attempt in range(_MAX_RETRY_ATTEMPTS):
            try:
                config = self._get_config()
                config.update({
                    "group.id": self.settings.kafka_consumer_group,
                    "auto.offset.reset": "earliest",
                    "enable.auto.commit": True,
                    "max.poll.interval.ms": 300000,
                    "session.timeout.ms": 30000,
                    "heartbeat.interval.ms": 10000,
                })
                self.consumer = Consumer(config)
                self.consumer.subscribe([self.settings.kafka_topic_intent_processed])
                logger.info(
                    "Kafka Consumer initialized",
                    extra={"topic": self.settings.kafka_topic_intent_processed, "attempt": attempt},
                )
                return True
            except Exception as e:
                delay = _backoff_delay(attempt)
                logger.error(
                    "Kafka Consumer init failed",
                    extra={"attempt": attempt, "error": str(e), "retry_in_seconds": delay},
                )
                if attempt < _MAX_RETRY_ATTEMPTS - 1:
                    time.sleep(delay)
        return False

    async def produce_message(self, topic: str, message: dict) -> bool:
        """
        Produce message to Kafka topic.
        
        Args:
            topic: Topic name
            message: Message dict to send
            
        Returns:
            True if successful, False otherwise
        """
        if not self.producer:
            logger.error("Producer not initialized")
            return False
        
        try:
            message_bytes = json.dumps(message).encode("utf-8")
            
            # Send message
            self.producer.produce(
                topic=topic,
                value=message_bytes,
                on_delivery=self._delivery_report
            )
            
            # Flush to ensure delivery
            self.producer.flush(timeout=5)
            
            logger.debug(f"Message produced to topic {topic}")
            return True
            
        except Exception as e:
            logger.error(f"Error producing message: {str(e)}")
            return False

    def _delivery_report(self, err, msg):
        """Kafka delivery report callback."""
        if err is not None:
            logger.error(f"Message delivery failed: {str(err)}")
        else:
            logger.debug(
                f"Message delivered to {msg.topic()} [{msg.partition()}] "
                f"at offset {msg.offset()}"
            )

    async def consume_messages(self, callback: Optional[Callable] = None):
        """Consume messages from topic until stopped, with backoff on errors."""
        if not self.consumer:
            logger.error("Consumer not initialized")
            return

        logger.info(
            "Starting message consumption",
            extra={"topic": self.settings.kafka_topic_intent_processed},
        )
        consecutive_errors = 0

        try:
            while not self._stop_consuming:
                try:
                    msg = self.consumer.poll(timeout=1.0)
                except Exception as e:
                    consecutive_errors += 1
                    delay = _backoff_delay(consecutive_errors)
                    logger.error(
                        "Consumer poll error",
                        extra={"error": str(e), "retry_in_seconds": delay},
                    )
                    if consecutive_errors >= _MAX_RETRY_ATTEMPTS:
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
                        logger.error("Consumer error", extra={"error": str(msg.error())})
                        continue

                consecutive_errors = 0

                try:
                    message_data = json.loads(msg.value().decode("utf-8"))
                    logger.info(
                        "Processing Kafka message",
                        extra={
                            "topic": msg.topic(),
                            "partition": msg.partition(),
                            "offset": msg.offset(),
                        },
                    )
                    if callback:
                        await callback(message_data)
                    logger.info(
                        "Kafka message processed",
                        extra={"topic": msg.topic(), "offset": msg.offset()},
                    )
                except json.JSONDecodeError as e:
                    logger.error("Error parsing message JSON", extra={"error": str(e)})

        except Exception as e:
            logger.error("Unexpected error in consume loop", extra={"error": str(e)})
        finally:
            if self.consumer:
                try:
                    self.consumer.close()
                    logger.info("Consumer closed cleanly")
                except Exception as e:
                    logger.warning(f"Consumer close error: {e}")

    def start_consuming_thread(self, callback: Optional[Callable] = None) -> threading.Thread:
        """Start message consumption in background thread."""
        self._consumer_thread = threading.Thread(
            target=self._consume_thread_wrapper,
            args=(callback,),
            daemon=True,
            name="kafka-consumer-product-aggregator",
        )
        self._consumer_thread.start()
        logger.info("Consumer thread started")
        return self._consumer_thread

    def _consume_thread_wrapper(self, callback: Callable):
        """Wrapper for consuming in thread."""
        import asyncio

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            loop.run_until_complete(self.consume_messages(callback))
        finally:
            loop.close()

    async def stop_consuming(self):
        """Stop message consumption."""
        self._stop_consuming = True

        if self._consumer_thread and self._consumer_thread.is_alive():
            self._consumer_thread.join(timeout=10)
            if self._consumer_thread.is_alive():
                logger.warning("Consumer thread did not exit within timeout")
        logger.info("Consumer stopped")

    async def check_connectivity(self) -> bool:
        """Check Kafka broker connectivity."""
        try:
            # Try to create a temporary admin connection
            config = self._get_config()
            config["client.id"] = "health-check"
            
            # Create a test consumer to check connectivity
            test_consumer = Consumer(config)
            test_consumer.list_topics(timeout=5)
            test_consumer.close()
            
            logger.info("Kafka broker connectivity verified")
            return True
            
        except Exception as e:
            logger.error(f"Kafka connectivity check failed: {str(e)}")
            return False

    async def close(self):
        """Close producer and consumer."""
        await self.stop_consuming()
        
        if self.producer:
            self.producer.flush(timeout=5)
            self.producer = None
            logger.info("Producer closed")

    # ===================== Event Factories =====================

    @staticmethod
    def intent_processed_event(intent: ProcessedIntent) -> dict:
        """Create intent.processed event."""
        return {
            "event_type": KafkaEventType.INTENT_PROCESSED,
            "requestId": intent.requestId,
            "userId": intent.userId,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": intent.model_dump()
        }

    @staticmethod
    def products_fetched_event(request_id: int, user_id: int, product_count: int,
                              sources: list, duration_ms: float) -> dict:
        """Create products.fetched event."""
        return {
            "event_type": KafkaEventType.PRODUCTS_FETCHED,
            "requestId": request_id,
            "userId": user_id,
            "productCount": product_count,
            "sources": sources,
            "durationMs": duration_ms,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
