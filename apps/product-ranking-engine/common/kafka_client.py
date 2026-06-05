"""
Reusable async Kafka client wrapper with retry logic and safe fallback.

Usage:
    from common.kafka_client import KafkaClient

    client = KafkaClient()
    await client.start()                         # connects with retry
    await client.produce("topic", {"key": "v"})  # produce JSON message
    await client.start_consumer("topic", handler) # consume with callback
    await client.stop()                          # graceful shutdown

Environment variables:
    KAFKA_BOOTSTRAP_SERVERS  — broker address (default: kafka:29092 in Docker, localhost:9092 locally)
    KAFKA_CLIENT_ID          — client identifier (default: python-service)

The client uses confluent-kafka (same library already in use across services)
and wraps it with:
  - Async-friendly interface (runs blocking calls in executor)
  - Retry logic (configurable, default 10 retries with exponential backoff)
  - Safe fallback: if Kafka is unreachable, logs warning and continues
  - Health check method for /health endpoints
  - Debug logging for connection events
"""

import asyncio
import json
import logging
import os
from threading import Thread
from typing import Any, Callable, Dict, Optional

from confluent_kafka import Consumer, Producer, KafkaError

logger = logging.getLogger(__name__)


def _detect_default_bootstrap() -> str:
    """Return sensible default: kafka:29092 inside Docker, localhost:9092 outside."""
    # /.dockerenv exists inside Docker containers
    if os.path.exists("/.dockerenv"):
        return "kafka:29092"
    return "localhost:9092"


class KafkaClient:
    """Async-friendly Kafka producer/consumer with retry and graceful fallback."""

    def __init__(
        self,
        bootstrap_servers: Optional[str] = None,
        client_id: Optional[str] = None,
        max_retries: int = 10,
        retry_backoff_base: float = 2.0,
        retry_backoff_max: float = 60.0,
    ):
        self.bootstrap_servers = (
            bootstrap_servers
            or os.getenv("KAFKA_BOOTSTRAP_SERVERS")
            or _detect_default_bootstrap()
        )
        self.client_id = client_id or os.getenv("KAFKA_CLIENT_ID", "python-service")
        self.max_retries = max_retries
        self.retry_backoff_base = retry_backoff_base
        self.retry_backoff_max = retry_backoff_max

        self._producer: Optional[Producer] = None
        self._consumer: Optional[Consumer] = None
        self._consuming = False
        self._consumer_thread: Optional[Thread] = None
        self._connected = False

    # ── Connection with retry ──────────────────────────────────────────────

    async def start(self) -> bool:
        """Initialize producer with retry. Returns True on success, False on exhaustion."""
        for attempt in range(1, self.max_retries + 1):
            try:
                self._producer = Producer({
                    "bootstrap.servers": self.bootstrap_servers,
                    "client.id": self.client_id,
                    "acks": "all",
                })
                # Probe connectivity by requesting metadata
                await asyncio.get_event_loop().run_in_executor(
                    None, lambda: self._producer.list_topics(timeout=5)
                )
                self._connected = True
                logger.info(
                    f"Kafka producer connected to {self.bootstrap_servers} "
                    f"(attempt {attempt}/{self.max_retries})"
                )
                return True
            except Exception as e:
                backoff = min(
                    self.retry_backoff_base ** attempt, self.retry_backoff_max
                )
                logger.warning(
                    f"Kafka connect attempt {attempt}/{self.max_retries} failed: {e} "
                    f"— retrying in {backoff:.0f}s"
                )
                if attempt < self.max_retries:
                    await asyncio.sleep(backoff)

        logger.error(
            f"Kafka: all {self.max_retries} connection attempts exhausted "
            f"— running without Kafka"
        )
        self._connected = False
        return False

    # ── Producer ───────────────────────────────────────────────────────────

    async def produce(
        self,
        topic: str,
        value: Dict[str, Any],
        key: Optional[str] = None,
    ) -> bool:
        """Produce a JSON message. Returns False (no crash) if Kafka is unavailable."""
        if not self._producer or not self._connected:
            logger.warning(f"Kafka not connected — dropping message to {topic}")
            return False

        try:
            payload = json.dumps(value).encode("utf-8")
            key_bytes = key.encode("utf-8") if key else None

            self._producer.produce(
                topic=topic,
                key=key_bytes,
                value=payload,
                callback=self._delivery_report,
            )
            await asyncio.get_event_loop().run_in_executor(
                None, lambda: self._producer.flush(timeout=5)
            )
            return True
        except Exception as e:
            logger.error(f"Kafka produce error on {topic}: {e}")
            return False

    # ── Consumer ───────────────────────────────────────────────────────────

    async def start_consumer(
        self,
        topics: list[str],
        callback: Callable,
        group_id: str = "default-group",
        auto_offset_reset: str = "earliest",
    ) -> bool:
        """Start consuming in a background thread. Safe fallback if Kafka is down."""
        if not self._connected:
            logger.warning("Kafka not connected — consumer not started")
            return False

        try:
            self._consumer = Consumer({
                "bootstrap.servers": self.bootstrap_servers,
                "group.id": group_id,
                "auto.offset.reset": auto_offset_reset,
                "enable.auto.commit": True,
                "session.timeout.ms": 30000,
                "heartbeat.interval.ms": 10000,
            })
            self._consumer.subscribe(topics)
            self._consuming = True

            self._consumer_thread = Thread(
                target=self._consume_loop,
                args=(callback,),
                daemon=True,
                name=f"kafka-consumer-{self.client_id}",
            )
            self._consumer_thread.start()
            logger.info(f"Kafka consumer started for topics: {topics}")
            return True
        except Exception as e:
            logger.error(f"Failed to start Kafka consumer: {e}")
            self._consuming = False
            return False

    def _consume_loop(self, callback: Callable):
        """Blocking consumer loop (runs in daemon thread)."""
        try:
            while self._consuming:
                msg = self._consumer.poll(timeout=1.0)
                if msg is None:
                    continue
                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        continue
                    logger.error(f"Kafka consumer error: {msg.error()}")
                    continue
                try:
                    payload = json.loads(msg.value().decode("utf-8"))
                    callback(payload)
                except Exception as e:
                    logger.error(f"Error processing Kafka message: {e}")
        except Exception as e:
            logger.error(f"Fatal error in consumer loop: {e}")
        finally:
            logger.info("Consumer loop ended")

    # ── Health / Debug ─────────────────────────────────────────────────────

    async def health_check(self) -> Dict[str, Any]:
        """Return Kafka connectivity status for /health endpoints."""
        status = {
            "kafka_connected": self._connected,
            "bootstrap_servers": self.bootstrap_servers,
            "producer_ready": self._producer is not None,
            "consumer_running": self._consuming,
        }
        if self._connected and self._producer:
            try:
                await asyncio.get_event_loop().run_in_executor(
                    None, lambda: self._producer.list_topics(timeout=3)
                )
                status["broker_reachable"] = True
            except Exception:
                status["broker_reachable"] = False
                self._connected = False
        return status

    @property
    def is_connected(self) -> bool:
        return self._connected

    # ── Shutdown ───────────────────────────────────────────────────────────

    async def stop(self):
        """Gracefully shut down producer and consumer."""
        self._consuming = False
        if self._consumer_thread:
            self._consumer_thread.join(timeout=5)
        if self._consumer:
            self._consumer.close()
            logger.info("Kafka consumer closed")
        if self._producer:
            self._producer.flush(timeout=5)
            logger.info("Kafka producer flushed")
        self._connected = False

    # ── Internal ───────────────────────────────────────────────────────────

    @staticmethod
    def _delivery_report(err, msg):
        if err:
            logger.error(f"Kafka delivery failed: {err}")
        else:
            logger.debug(
                f"Delivered to {msg.topic()}[{msg.partition()}] @ {msg.offset()}"
            )
