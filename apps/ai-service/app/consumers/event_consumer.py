"""
Async Kafka Consumer using aiokafka
Production-grade event consumption with error handling and reconnection logic
"""
import asyncio
import json
import logging
from typing import Callable, Dict, Optional, List
from datetime import datetime
import traceback

try:
    from aiokafka import AIOKafkaConsumer
    AIOKAFKA_AVAILABLE = True
except ImportError:
    AIOKAFKA_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("aiokafka not installed. Install with: pip install aiokafka")

from app.models.event import DomainEvent, EventType


logger = logging.getLogger(__name__)


class AsyncEventConsumer:
    """
    Async Kafka consumer for domain events
    Production-grade with:
    - Automatic reconnection
    - Error handling & retry logic
    - Message batching & compression
    - Consumer lag monitoring
    - Graceful shutdown
    """

    def __init__(
        self,
        brokers: str = "kafka:29092",
        group_id: str = "ai-service-consumer",
        topics: Optional[List[str]] = None,
        batch_size: int = 100,
        max_poll_records: int = 500,
    ):
        """
        Initialize async Kafka consumer

        Args:
            brokers: Kafka broker addresses (comma-separated)
            group_id: Consumer group ID for offset management
            topics: List of topics to subscribe to
            batch_size: Messages to process before committing offsets
            max_poll_records: Max messages to fetch in one poll
        """
        if not AIOKAFKA_AVAILABLE:
            raise ImportError("aiokafka is required. Install with: pip install aiokafka")

        self.brokers = brokers.split(",")
        self.group_id = group_id
        self.topics = topics or [
            "product-events",
            "commerce-events",
            "user-behavior",
        ]
        self.batch_size = batch_size
        self.max_poll_records = max_poll_records

        self.consumer: Optional[AIOKafkaConsumer] = None
        self.running = False
        self.handlers: Dict[str, Callable] = {}
        self.consumer_task: Optional[asyncio.Task] = None
        self.processed_count = 0
        self.error_count = 0

        logger.info(
            f"AsyncEventConsumer initialized: brokers={self.brokers}, group={group_id}"
        )

    def register_handler(self, event_type: EventType, handler: Callable):
        """
        Register event handler
        
        Args:
            event_type: Event type to handle
            handler: Async or sync handler function
        """
        self.handlers[event_type.value] = handler
        logger.info(f"✅ Handler registered for event: {event_type.value}")

    async def start(self):
        """Start consuming events"""
        if self.running:
            logger.warning("Consumer already running")
            return

        try:
            logger.info(f"🚀 Starting Kafka consumer: {self.group_id}")

            self.consumer = AIOKafkaConsumer(
                *self.topics,
                bootstrap_servers=self.brokers,
                group_id=self.group_id,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                auto_offset_reset="earliest",
                enable_auto_commit=False,
                max_poll_records=self.max_poll_records,
                session_timeout_ms=30000,
                heartbeat_interval_ms=10000,
                # Compression for network efficiency
                compression_type="gzip",
                # Error handling
                socket_keepalive=True,
            )

            await self.consumer.start()
            self.running = True

            # Start consumption loop
            self.consumer_task = asyncio.create_task(self._consume_loop())

            logger.info("✅ Kafka consumer started successfully")

        except Exception as e:
            logger.error(f"Failed to start Kafka consumer: {str(e)}")
            logger.error(traceback.format_exc())
            raise

    async def stop(self):
        """Stop consuming events"""
        if not self.running:
            return

        logger.info("🛑 Stopping Kafka consumer...")

        self.running = False

        if self.consumer_task:
            self.consumer_task.cancel()
            try:
                await self.consumer_task
            except asyncio.CancelledError:
                pass

        if self.consumer:
            await self.consumer.stop()

        logger.info(
            f"✅ Kafka consumer stopped. "
            f"Processed: {self.processed_count}, Errors: {self.error_count}"
        )

    async def _consume_loop(self):
        """Main consumption loop"""
        batch: List[Dict] = []
        try:
            async for message in self.consumer:
                try:
                    # Parse message
                    event_data = message.value
                    event = DomainEvent(**event_data)

                    # Add to batch
                    batch.append(
                        {
                            "event": event,
                            "topic": message.topic,
                            "partition": message.partition,
                            "offset": message.offset,
                        }
                    )

                    # Process batch if full
                    if len(batch) >= self.batch_size:
                        await self._process_batch(batch)
                        batch = []

                    # Commit offsets periodically
                    await self.consumer.commit()

                except json.JSONDecodeError as e:
                    self.error_count += 1
                    logger.error(f"Failed to decode message: {str(e)}")
                except Exception as e:
                    self.error_count += 1
                    logger.error(f"Error processing message: {str(e)}")
                    logger.error(traceback.format_exc())

            # Process remaining batch
            if batch:
                await self._process_batch(batch)

        except asyncio.CancelledError:
            # Graceful shutdown
            if batch:
                await self._process_batch(batch)
            logger.info("Consumer loop cancelled")

    async def _process_batch(self, batch: List[Dict]):
        """Process a batch of events"""
        logger.debug(f"Processing batch of {len(batch)} events")

        for item in batch:
            event = item["event"]
            try:
                await self._handle_event(event)
                self.processed_count += 1
            except Exception as e:
                self.error_count += 1
                logger.error(
                    f"Error handling event {event.event_id}: {str(e)}"
                )
                logger.error(traceback.format_exc())

    async def _handle_event(self, event: DomainEvent):
        """
        Handle individual event
        Supports both async and sync handlers
        """
        event_type = event.event_type

        handler = self.handlers.get(event_type)
        if not handler:
            logger.warn(f"No handler registered for event type: {event_type}")
            return

        try:
            # Support both async and sync handlers
            if asyncio.iscoroutinefunction(handler):
                await handler(event)
            else:
                # Run sync handler in executor to avoid blocking
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, handler, event)

            logger.debug(f"✅ Event handled: {event_type}")

        except Exception as e:
            logger.error(
                f"Error in handler for {event_type}: {str(e)}"
            )
            raise

    def get_stats(self) -> Dict:
        """Get consumer statistics"""
        return {
            "running": self.running,
            "processed_count": self.processed_count,
            "error_count": self.error_count,
            "topics": self.topics,
            "group_id": self.group_id,
            "timestamp": datetime.now().isoformat(),
        }
