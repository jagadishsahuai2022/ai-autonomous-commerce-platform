"""
Production-Grade Python Resilience Patterns
Retry, Circuit Breaker, Timeout utilities for FastAPI services
"""

import asyncio
import time
import logging
from typing import Callable, TypeVar, Optional, Any, Union
from functools import wraps
from enum import Enum
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CircuitBreakerState(Enum):
    """Circuit Breaker States"""
    CLOSED = "CLOSED"  # Normal operation
    OPEN = "OPEN"  # Failing, reject requests
    HALF_OPEN = "HALF_OPEN"  # Testing recovery


class CircuitBreakerException(Exception):
    """Raised when circuit breaker is open"""
    pass


class TimeoutException(Exception):
    """Raised when operation times out"""
    pass


class RetryConfig:
    """Configuration for retry logic"""

    def __init__(
        self,
        max_attempts: int = 3,
        initial_delay_ms: int = 100,
        max_delay_ms: int = 30000,
        backoff_multiplier: float = 2.0,
        jitter_factor: float = 0.1,
        timeout_ms: int = 30000,
    ):
        self.max_attempts = max_attempts
        self.initial_delay_ms = initial_delay_ms
        self.max_delay_ms = max_delay_ms
        self.backoff_multiplier = backoff_multiplier
        self.jitter_factor = jitter_factor
        self.timeout_ms = timeout_ms

    # Presets
    AGGRESSIVE = None  # Defined below
    MODERATE = None
    CONSERVATIVE = None
    QUICK = None


# Retry presets
RetryConfig.AGGRESSIVE = RetryConfig(
    max_attempts=5,
    initial_delay_ms=50,
    max_delay_ms=10000,
    backoff_multiplier=1.5,
    jitter_factor=0.1,
    timeout_ms=10000,
)

RetryConfig.MODERATE = RetryConfig(
    max_attempts=3,
    initial_delay_ms=100,
    max_delay_ms=30000,
    backoff_multiplier=2.0,
    jitter_factor=0.1,
    timeout_ms=30000,
)

RetryConfig.CONSERVATIVE = RetryConfig(
    max_attempts=2,
    initial_delay_ms=500,
    max_delay_ms=60000,
    backoff_multiplier=3.0,
    jitter_factor=0.2,
    timeout_ms=60000,
)

RetryConfig.QUICK = RetryConfig(
    max_attempts=1,
    initial_delay_ms=50,
    max_delay_ms=5000,
    backoff_multiplier=2.0,
    jitter_factor=0.1,
    timeout_ms=5000,
)


async def retry_async(
    fn: Callable[..., Any],
    config: Optional[RetryConfig] = None,
    operation_name: str = "Operation",
    *args,
    **kwargs,
) -> Any:
    """
    Execute async function with retry logic
    """
    if config is None:
        config = RetryConfig.MODERATE
        
    last_error = None
    attempt = 0

    while attempt < config.max_attempts:
        attempt += 1
        try:
            logger.debug(
                f"[{operation_name}] Attempt {attempt}/{config.max_attempts}"
            )

            # Set timeout
            return await asyncio.wait_for(
                fn(*args, **kwargs),
                timeout=config.timeout_ms / 1000,
            )

        except asyncio.TimeoutError:
            last_error = TimeoutException(
                f"Timeout after {config.timeout_ms}ms"
            )
            logger.warning(
                f"[{operation_name}] Attempt {attempt} timeout: {last_error}"
            )

        except Exception as e:
            last_error = e
            logger.warning(
                f"[{operation_name}] Attempt {attempt} failed: {str(e)}"
            )

        # Don't retry on last attempt
        if attempt >= config.max_attempts:
            break

        # Calculate delay with exponential backoff and jitter
        delay_seconds = _calculate_backoff_delay(
            attempt,
            config.initial_delay_ms,
            config.max_delay_ms,
            config.backoff_multiplier,
            config.jitter_factor,
        )

        logger.debug(
            f"[{operation_name}] Waiting {delay_seconds:.2f}s before retry"
        )
        await asyncio.sleep(delay_seconds)

    logger.error(
        f"[{operation_name}] Failed after {attempt} attempts: {last_error}"
    )
    raise last_error or Exception("Unknown error")


def retry_sync(
    fn: Callable[..., T],
    config: Optional[RetryConfig] = None,
    operation_name: str = "Operation",
    *args,
    **kwargs,
) -> T:
    """
    Execute sync function with retry logic
    """
    if config is None:
        config = RetryConfig.MODERATE
        
    last_error = None
    attempt = 0

    while attempt < config.max_attempts:
        attempt += 1
        try:
            logger.debug(
                f"[{operation_name}] Attempt {attempt}/{config.max_attempts}"
            )
            return fn(*args, **kwargs)

        except Exception as e:
            last_error = e
            logger.warning(
                f"[{operation_name}] Attempt {attempt} failed: {str(e)}"
            )

        if attempt >= config.max_attempts:
            break

        delay_seconds = _calculate_backoff_delay(
            attempt,
            config.initial_delay_ms,
            config.max_delay_ms,
            config.backoff_multiplier,
            config.jitter_factor,
        )

        logger.debug(
            f"[{operation_name}] Waiting {delay_seconds:.2f}s before retry"
        )
        time.sleep(delay_seconds)

    logger.error(
        f"[{operation_name}] Failed after {attempt} attempts: {last_error}"
    )
    raise last_error or Exception("Unknown error")


def _calculate_backoff_delay(
    attempt: int,
    initial_delay_ms: int,
    max_delay_ms: int,
    multiplier: float,
    jitter_factor: float,
) -> float:
    """Calculate exponential backoff delay with jitter"""
    import random

    delay_ms = initial_delay_ms * (multiplier ** (attempt - 1))
    delay_ms = min(delay_ms, max_delay_ms)

    # Add jitter
    jitter_range = delay_ms * jitter_factor
    jitter = random.uniform(-jitter_range, jitter_range)
    delay_ms = max(1, delay_ms + jitter)

    return delay_ms / 1000  # Convert to seconds


class CircuitBreaker:
    """Production-Grade Circuit Breaker"""

    def __init__(
        self,
        service_id: str,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout_seconds: int = 60,
        monitoring_window_seconds: int = 60,
    ):
        self.service_id = service_id
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.timeout_seconds = timeout_seconds
        self.monitoring_window_seconds = monitoring_window_seconds

        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.last_state_change = datetime.now()
        self.failure_timestamps: list[float] = []

    async def call_async(self, fn: Callable, *args, **kwargs):
        """Execute function through circuit breaker"""
        if self.state == CircuitBreakerState.OPEN:
            if (
                datetime.now() - self.last_state_change
            ).seconds >= self.timeout_seconds:
                logger.info(
                    f"[{self.service_id}] Attempting recovery (HALF_OPEN)"
                )
                self._set_state(CircuitBreakerState.HALF_OPEN)
                self.success_count = 0
            else:
                raise CircuitBreakerException(
                    f"Circuit breaker OPEN for {self.service_id}"
                )

        try:
            result = await fn(*args, **kwargs)
            self._on_success()
            return result

        except Exception as e:
            self._on_failure()
            raise

    def call_sync(self, fn: Callable, *args, **kwargs):
        """Sync version of call_async"""
        if self.state == CircuitBreakerState.OPEN:
            if (
                datetime.now() - self.last_state_change
            ).seconds >= self.timeout_seconds:
                logger.info(
                    f"[{self.service_id}] Attempting recovery (HALF_OPEN)"
                )
                self._set_state(CircuitBreakerState.HALF_OPEN)
                self.success_count = 0
            else:
                raise CircuitBreakerException(
                    f"Circuit breaker OPEN for {self.service_id}"
                )

        try:
            result = fn(*args, **kwargs)
            self._on_success()
            return result

        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        """Handle successful call"""
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                logger.info(
                    f"[{self.service_id}] Recovery successful, circuit CLOSED"
                )
                self._set_state(CircuitBreakerState.CLOSED)
                self.failure_count = 0

        elif self.state == CircuitBreakerState.CLOSED:
            self.failure_count = 0

    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        now = time.time()
        self.failure_timestamps.append(now)

        # Clean old timestamps
        window = self.monitoring_window_seconds
        self.failure_timestamps = [
            ts for ts in self.failure_timestamps if now - ts < window
        ]

        if (
            self.failure_count >= self.failure_threshold
            and self.state == CircuitBreakerState.CLOSED
        ):
            logger.error(
                f"[{self.service_id}] Opening circuit after {self.failure_count} failures"
            )
            self._set_state(CircuitBreakerState.OPEN)

    def _set_state(self, new_state: CircuitBreakerState):
        """Transition to new state"""
        old_state = self.state
        self.state = new_state
        self.last_state_change = datetime.now()

        logger.warning(
            f"[{self.service_id}] Circuit breaker: {old_state.value} → {new_state.value}"
        )

    def reset(self):
        """Reset circuit breaker"""
        self._set_state(CircuitBreakerState.CLOSED)
        self.failure_count = 0
        self.success_count = 0
        self.failure_timestamps = []

    def get_metrics(self) -> dict:
        """Get circuit breaker metrics"""
        return {
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "last_failure_time": self.last_failure_time.isoformat()
            if self.last_failure_time
            else None,
            "uptime": self._calculate_uptime(),
        }

    def _calculate_uptime(self) -> float:
        """Calculate uptime percentage"""
        if not self.failure_timestamps:
            return 100.0
        return max(0, 100 - (len(self.failure_timestamps) * 10))


class TimeoutManager:
    """Centralized timeout management"""

    # Preset timeouts
    QUICK = 5  # 5 seconds
    MODERATE = 30  # 30 seconds
    EXTENDED = 60  # 60 seconds
    LONG = 120  # 2 minutes

    @staticmethod
    async def with_timeout(
        coro,
        timeout_seconds: int = MODERATE,
        operation_name: str = "Operation",
    ):
        """Execute with timeout"""
        try:
            return await asyncio.wait_for(coro, timeout=timeout_seconds)
        except asyncio.TimeoutError:
            logger.error(f"[{operation_name}] Timeout after {timeout_seconds}s")
            raise TimeoutException(
                f"Operation {operation_name} timed out after {timeout_seconds}s"
            )
