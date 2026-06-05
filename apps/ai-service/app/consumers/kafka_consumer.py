"""
Kafka Consumer - Listens to events from NestJS backend
"""
import json
import logging
from typing import Callable, Dict, Any, Optional
try:
    from kafka import KafkaConsumer
    from kafka.errors import KafkaError, CommitFailedError
except ImportError as e:
    import sys
    print(f"Warning: kafka module not found. Install with: pip install kafka-python", file=sys.stderr)
    KafkaConsumer = None  # type: ignore
    KafkaError = Exception
    CommitFailedError = Exception
import threading
import time

from app.models.event import DomainEvent, EventType


logger = logging.getLogger(__name__)


class KafkaEventConsumer:
    """
    Kafka consumer for domain events
    Handles connection, message consumption, and error recovery
    """

    def __init__(
        self,
        brokers: str = "kafka:29092",
        group_id: str = "ai-service-consumer",
        topics: Optional[list] = None,
    ):
        """
        Initialize Kafka consumer

        Args:
            brokers: Kafka broker addresses (comma-separated)
            group_id: Consumer group ID
            topics: List of topics to subscribe to
        """
        self.brokers = brokers.split(",")
        self.group_id = group_id
        self.topics = topics or [
            "product-events",
            "commerce-events",
            "user-behavior",
        ]
        
        self.consumer: Optional[Any] = None
        self.running = False
        self.handlers: Dict[str, Callable] = {}
        self.consumer_thread: Optional[threading.Thread] = None

        logger.info(
            f"KafkaEventConsumer initialized: group={group_id}, topics={self.topics}"
        )

    def register_handler(self, event_type: EventType, handler: Callable):
        """
        Register event handler

        Args:
            event_type: EventType to handle
            handler: Async function to process the event
        """
        self.handlers[event_type.value] = handler
        logger.info(f"Handler registered for {event_type.value}")

    def connect(self):
        """Connect to Kafka"""
        try:
            if KafkaConsumer is None:
                logger.error("Kafka module not available. Skipping connection.")
                return False
                
            self.consumer = KafkaConsumer(
                *self.topics,
                bootstrap_servers=self.brokers,
                group_id=self.group_id,
                auto_offset_reset="earliest",
                enable_auto_commit=True,
                max_poll_records=10,
                session_timeout_ms=30000,
                heartbeat_interval_ms=10000,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            )
            logger.info(
                f"✅ Connected to Kafka: brokers={self.brokers}, group={self.group_id}"
            )
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Kafka: {str(e)}")
            return False

    def start(self):
        """Start consuming events in background thread"""
        if self.running:
            logger.warning("Consumer already running")
            return

        if not self.consumer:
            if not self.connect():
                raise RuntimeError("Failed to connect to Kafka")

        self.running = True
        self.consumer_thread = threading.Thread(
            target=self._consume_loop, daemon=True
        )
        self.consumer_thread.start()
        logger.info("Kafka consumer started")

    def stop(self):
        """Stop consuming events"""
        self.running = False
        if self.consumer:
            try:
                self.consumer.close()
            except Exception as e:
                logger.error(f"Error closing consumer: {str(e)}")
        logger.info("Kafka consumer stopped")

    def _consume_loop(self):
        """Main consumption loop"""
        retry_count = 0
        max_retries = 3

        while self.running:
            try:
                if not self.consumer:
                    logger.warning("Consumer not initialized")
                    break
                    
                for message in self.consumer:
                    if not self.running:
                        break

                    try:
                        self._process_message(message)
                        retry_count = 0  # Reset retry count on success
                    except Exception as e:
                        logger.error(
                            f"Error processing message: {str(e)}\n"
                            f"Topic: {message.topic}, "
                            f"Partition: {message.partition}, "
                            f"Offset: {message.offset}"
                        )

            except CommitFailedError as e:
                logger.error(f"Commit failed: {str(e)}")
            except KafkaError as e:
                logger.error(f"Kafka error: {str(e)}")
                retry_count += 1

                if retry_count >= max_retries:
                    logger.error(
                        f"Max retries ({max_retries}) reached. Stopping consumer."
                    )
                    self.running = False
                    break

                # Exponential backoff: 2s, 4s, 8s
                wait_time = 2 ** retry_count
                logger.info(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)

                # Attempt to reconnect
                if not self.connect():
                    logger.error("Reconnection failed")
            except Exception as e:
                logger.error(f"Unexpected error in consumer loop: {str(e)}")
                self.running = False
                break

    def _process_message(self, message):
        """Process a single Kafka message"""
        try:
            # Deserialize event
            event_dict = message.value
            event = DomainEvent.from_dict(event_dict)

            logger.debug(
                f"Received event: {event.event_type.value} "
                f"(ID: {event.event_id})"
            )

            # Find and call handler
            handler = self.handlers.get(event.event_type.value)
            if handler:
                # Call handler (blocking for now, can be async if needed)
                handler(event)
                logger.info(
                    f"✅ Processed: {event.event_type.value} "
                    f"(ID: {event.event_id})"
                )
            else:
                logger.debug(
                    f"No handler for event type: {event.event_type.value}"
                )

        except ValueError as e:
            logger.error(f"Failed to deserialize event: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error processing message: {str(e)}")

    def get_status(self) -> Dict[str, Any]:
        """Get consumer status"""
        return {
            "running": self.running,
            "connected": self.consumer is not None,
            "group_id": self.group_id,
            "topics": self.topics,
            "handlers_count": len(self.handlers),
            "brokers": self.brokers,
        }
