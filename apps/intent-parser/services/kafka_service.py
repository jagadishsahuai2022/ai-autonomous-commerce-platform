"""Kafka Service for consuming and producing messages."""

import json
import logging
import signal
import time
import asyncio
from typing import Callable, Optional, Dict, Any
from threading import Thread
from confluent_kafka import Consumer, Producer, KafkaError

logger = logging.getLogger(__name__)

_MAX_RETRY_ATTEMPTS = 5


def _backoff_delay(attempt: int) -> float:
    """Exponential backoff: 2^attempt seconds (1s, 2s, 4s, 8s, 16s)."""
    return min(2 ** attempt, 30)


class KafkaService:
    """Service for Kafka operations."""

    def __init__(
        self,
        bootstrap_servers: str,
        consumer_group: str,
        security_protocol: str = "PLAINTEXT"
    ):
        """Initialize Kafka service."""
        self.bootstrap_servers = bootstrap_servers
        self.consumer_group = consumer_group
        self.security_protocol = security_protocol
        self.consumer = None
        self.producer = None
        self._consumer_thread = None
        self._running = False

        # Register SIGTERM handler for graceful shutdown
        signal.signal(signal.SIGTERM, self._handle_sigterm)

    def _handle_sigterm(self, signum, frame):
        """Graceful shutdown on SIGTERM: stop consume loop and commit offsets."""
        logger.info("Received SIGTERM — stopping Kafka consumer gracefully")
        self._running = False
        if self.consumer:
            try:
                self.consumer.commit(asynchronous=False)
                logger.info("Final offset commit completed")
            except Exception as e:
                logger.warning(f"Offset commit on shutdown failed: {e}")
            try:
                self.consumer.close()
                logger.info("Consumer closed on SIGTERM")
            except Exception as e:
                logger.warning(f"Consumer close on shutdown failed: {e}")

    def _get_config(self) -> Dict[str, Any]:
        """Get base Kafka configuration."""
        return {
            "bootstrap.servers": self.bootstrap_servers,
            "security.protocol": self.security_protocol,
        }

    def initialize_producer(self):
        """Initialize Kafka producer with retry/backoff."""
        for attempt in range(_MAX_RETRY_ATTEMPTS):
            try:
                config = self._get_config()
                self.producer = Producer(config)
                logger.info(
                    "Kafka producer initialised",
                    extra={"bootstrap_servers": self.bootstrap_servers, "attempt": attempt},
                )
                return
            except Exception as e:
                delay = _backoff_delay(attempt)
                logger.error(
                    "Kafka producer init failed",
                    extra={"attempt": attempt, "error": str(e), "retry_in_seconds": delay},
                )
                if attempt < _MAX_RETRY_ATTEMPTS - 1:
                    time.sleep(delay)
        raise RuntimeError(
            f"Kafka producer could not be initialised after {_MAX_RETRY_ATTEMPTS} attempts"
        )

    def initialize_consumer(self, topic: str):
        """Initialize Kafka consumer with retry/backoff."""
        for attempt in range(_MAX_RETRY_ATTEMPTS):
            try:
                config = self._get_config()
                config.update({
                    "group.id": self.consumer_group,
                    "auto.offset.reset": "earliest",
                    "enable.auto.commit": True,
                    "auto.commit.interval.ms": 1000,
                    # Prevents coordinator eviction when processing a heavy message
                    "max.poll.interval.ms": 300000,
                    "session.timeout.ms": 30000,
                    "heartbeat.interval.ms": 10000,
                })
                self.consumer = Consumer(config)
                self.consumer.subscribe([topic])
                logger.info(
                    "Kafka consumer initialised",
                    extra={"topic": topic, "group": self.consumer_group, "attempt": attempt},
                )
                return
            except Exception as e:
                delay = _backoff_delay(attempt)
                logger.error(
                    "Kafka consumer init failed",
                    extra={"attempt": attempt, "error": str(e), "retry_in_seconds": delay},
                )
                if attempt < _MAX_RETRY_ATTEMPTS - 1:
                    time.sleep(delay)
        raise RuntimeError(
            f"Kafka consumer could not be initialised after {_MAX_RETRY_ATTEMPTS} attempts"
        )

    async def produce_message(
        self,
        topic: str,
        message: Dict[str, Any],
        key: Optional[str] = None
    ) -> bool:
        """Produce a message to Kafka topic."""
        if not self.producer:
            self.initialize_producer()

        try:
            message_bytes = json.dumps(message).encode('utf-8')
            key_bytes = key.encode('utf-8') if key else None

            self.producer.produce(
                topic=topic,
                value=message_bytes,
                key=key_bytes,
                callback=self._on_delivery
            )

            self.producer.flush()
            logger.info("Message produced", extra={"topic": topic, "key": key})
            return True

        except Exception as e:
            logger.error("Failed to produce message", extra={"topic": topic, "error": str(e)})
            return False

    def _on_delivery(self, err, msg):
        """Delivery callback."""
        if err:
            logger.error("Message delivery failed", extra={"error": str(err)})
        else:
            logger.debug(
                "Message delivered",
                extra={
                    "topic": msg.topic(),
                    "partition": msg.partition(),
                    "offset": msg.offset(),
                },
            )

    async def consume_messages(
        self,
        topic: str,
        callback: Callable,
        timeout_ms: int = 1000
    ):
        """Consume messages from Kafka topic (blocking loop with resilience)."""
        if not self.consumer:
            self.initialize_consumer(topic)

        self._running = True
        logger.info("Starting consume loop", extra={"topic": topic})
        consecutive_errors = 0

        try:
            while self._running:
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
                        logger.debug("Reached end of partition")
                    else:
                        logger.error(
                            "Kafka consumer error",
                            extra={"error": str(msg.error())},
                        )
                    continue

                # Reset error counter on successful poll
                consecutive_errors = 0

                try:
                    message_value = json.loads(msg.value().decode('utf-8'))
                    logger.info(
                        "Processing Kafka message",
                        extra={
                            "topic": msg.topic(),
                            "partition": msg.partition(),
                            "offset": msg.offset(),
                        },
                    )
                    await callback(message_value)
                    logger.info(
                        "Kafka message processed",
                        extra={"topic": msg.topic(), "offset": msg.offset()},
                    )
                except json.JSONDecodeError as e:
                    logger.error(
                        "Failed to parse message JSON",
                        extra={"error": str(e), "raw_value": msg.value()[:200]},
                    )
                except Exception as e:
                    logger.error(
                        "Error processing message",
                        extra={
                            "error": str(e),
                            "topic": msg.topic(),
                            "offset": msg.offset(),
                        },
                    )
        except KeyboardInterrupt:
            logger.info("Consumer interrupted by KeyboardInterrupt")
        finally:
            if self.consumer:
                try:
                    self.consumer.close()
                    logger.info("Consumer closed cleanly")
                except Exception as e:
                    logger.warning(f"Consumer close error: {e}")

    def start_consuming_thread(
        self,
        topic: str,
        callback: Callable
    ):
        """Start consuming messages in a background thread."""
        self._consumer_thread = Thread(
            target=lambda: asyncio.run(self.consume_messages(topic, callback)),
            daemon=True,
            name=f"kafka-consumer-{topic}",
        )
        self._consumer_thread.start()
        logger.info("Consumer thread started", extra={"topic": topic})

    def stop_consuming(self):
        """Stop the consume loop and wait for the thread to exit."""
        logger.info("Stopping Kafka consumer...")
        self._running = False
        if self._consumer_thread and self._consumer_thread.is_alive():
            self._consumer_thread.join(timeout=10)
            if self._consumer_thread.is_alive():
                logger.warning("Consumer thread did not exit within timeout")
        logger.info("Consumer stopped")

    def close(self):
        """Close Kafka connections."""
        self.stop_consuming()
        if self.consumer:
            try:
                self.consumer.close()
            except Exception:
                pass
        if self.producer:
            try:
                self.producer.flush(timeout=5)
            except Exception:
                pass
        logger.info("Kafka connections closed")

    async def check_connectivity(self) -> bool:
        """Check if Kafka is accessible."""
        try:
            if not self.producer:
                self.initialize_producer()
            self.producer.list_topics(timeout=5)
            logger.info("Kafka connectivity check passed")
            return True
        except Exception as e:
            logger.error("Kafka connectivity check failed", extra={"error": str(e)})
            return False


class KafkaEventType:
    """Kafka event types."""
    
    BUY_REQUEST_CREATED = "buy_request.created"
    INTENT_PROCESSED = "intent.processed"


class BuyRequestCreatedEvent:
    """Buy Request Created event."""

    @staticmethod
    def create(buy_request: Dict[str, Any]) -> Dict[str, Any]:
        """Create a buy_request.created event."""
        return {
            "event_type": KafkaEventType.BUY_REQUEST_CREATED,
            "buyRequest": buy_request,
            "metadata": {
                "timestamp": None,  # Will be set by Kafka
                "source": "api"
            }
        }


class IntentProcessedEvent:
    """Intent Processed event."""

    @staticmethod
    def create(
        buy_request_id: int,
        user_id: int,
        processed_intent: Dict[str, Any],
        llm_model: str
    ) -> Dict[str, Any]:
        """Create an intent.processed event."""
        return {
            "event_type": KafkaEventType.INTENT_PROCESSED,
            "requestId": buy_request_id,
            "userId": user_id,
            "processedIntent": processed_intent,
            "metadata": {
                "llmModel": llm_model,
                "source": "intent-parser-service"
            }
        }
