"""
Error Handling Module for Python Services
- Centralized error handling and normalization
- Error code mapping
- Structured error responses
- Recovery strategies
"""

from enum import Enum
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import logging
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ErrorCode(str, Enum):
    """Standard error codes used across the application"""

    # Validation errors (400)
    INVALID_INPUT = "INVALID_INPUT"
    MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD"
    INVALID_FORMAT = "INVALID_FORMAT"
    VALIDATION_FAILED = "VALIDATION_FAILED"

    # Authentication errors (401)
    UNAUTHORIZED = "UNAUTHORIZED"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    TOKEN_INVALID = "TOKEN_INVALID"
    SESSION_EXPIRED = "SESSION_EXPIRED"

    # Authorization errors (403)
    FORBIDDEN = "FORBIDDEN"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS"

    # Not found errors (404)
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    ENTITY_NOT_FOUND = "ENTITY_NOT_FOUND"

    # Conflict errors (409)
    RESOURCE_EXISTS = "RESOURCE_EXISTS"
    STATE_CONFLICT = "STATE_CONFLICT"
    DUPLICATE_ENTRY = "DUPLICATE_ENTRY"

    # Rate limiting (429)
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS"

    # Server errors (500)
    INTERNAL_ERROR = "INTERNAL_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    SERVICE_ERROR = "SERVICE_ERROR"
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"

    # Business logic errors
    BUSINESS_LOGIC_ERROR = "BUSINESS_LOGIC_ERROR"
    INVALID_STATE = "INVALID_STATE"
    OPERATION_NOT_ALLOWED = "OPERATION_NOT_ALLOWED"

    # LLM/AI errors
    LLM_ERROR = "LLM_ERROR"
    LLM_TIMEOUT = "LLM_TIMEOUT"
    INVALID_PROMPT = "INVALID_PROMPT"
    MODEL_NOT_AVAILABLE = "MODEL_NOT_AVAILABLE"

    # kafka/Queue errors
    KAFKA_ERROR = "KAFKA_ERROR"
    MESSAGE_PUBLISH_ERROR = "MESSAGE_PUBLISH_ERROR"
    MESSAGE_CONSUME_ERROR = "MESSAGE_CONSUME_ERROR"

    # Generic errors
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


class ErrorResponse(BaseModel):
    """Structured error response model"""

    status_code: int
    code: ErrorCode
    message: str
    timestamp: datetime
    request_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    suggestion: Optional[str] = None


class AppException(Exception):
    """Base application exception"""

    def __init__(
        self,
        status_code: int,
        message: str,
        code: ErrorCode,
        context: Optional[Dict[str, Any]] = None,
    ):
        self.status_code = status_code
        self.message = message
        self.code = code
        self.context = context or {}
        super().__init__(self.message)


class ValidationError(AppException):
    """Validation error exception"""

    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(400, message, ErrorCode.VALIDATION_FAILED, context)


class NotFoundError(AppException):
    """Not found error exception"""

    def __init__(self, resource: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(404, f"{resource} not found", ErrorCode.RESOURCE_NOT_FOUND, context)


class ConflictError(AppException):
    """Conflict error exception"""

    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(409, message, ErrorCode.STATE_CONFLICT, context)


class UnauthorizedError(AppException):
    """Unauthorized error exception"""

    def __init__(self, message = "Unauthorized", context: Optional[Dict[str, Any]] = None):
        super().__init__(401, message, ErrorCode.UNAUTHORIZED, context)


class ForbiddenError(AppException):
    """Forbidden error exception"""

    def __init__(self, message = "Forbidden", context: Optional[Dict[str, Any]] = None):
        super().__init__(403, message, ErrorCode.FORBIDDEN, context)


class LLMError(AppException):
    """LLM/AI error exception"""

    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(500, message, ErrorCode.LLM_ERROR, context)


class KafkaError(AppException):
    """Kafka/Message queue error exception"""

    def __init__(self, message: str, context: Optional[Dict[str, Any]] = None):
        super().__init__(500, message, ErrorCode.KAFKA_ERROR, context)


class ErrorHandler:
    """Centralized error handling service"""

    # Status code to error code mapping
    STATUS_TO_CODE = {
        400: ErrorCode.INVALID_INPUT,
        401: ErrorCode.UNAUTHORIZED,
        403: ErrorCode.FORBIDDEN,
        404: ErrorCode.RESOURCE_NOT_FOUND,
        409: ErrorCode.STATE_CONFLICT,
        429: ErrorCode.RATE_LIMIT_EXCEEDED,
        500: ErrorCode.INTERNAL_ERROR,
        503: ErrorCode.SERVICE_ERROR,
    }

    # Error suggestions
    SUGGESTIONS = {
        ErrorCode.INVALID_INPUT: "Please check your input and try again.",
        ErrorCode.MISSING_REQUIRED_FIELD: "Please provide all required fields.",
        ErrorCode.INVALID_FORMAT: "The format of your input is invalid.",
        ErrorCode.VALIDATION_FAILED: "Your input did not pass validation.",
        ErrorCode.UNAUTHORIZED: "Please log in to continue.",
        ErrorCode.INVALID_CREDENTIALS: "Invalid email or password.",
        ErrorCode.TOKEN_EXPIRED: "Your session has expired. Please log in again.",
        ErrorCode.TOKEN_INVALID: "Your session token is invalid. Please log in again.",
        ErrorCode.FORBIDDEN: "You do not have permission to perform this action.",
        ErrorCode.RESOURCE_NOT_FOUND: "The requested resource was not found.",
        ErrorCode.RESOURCE_EXISTS: "This resource already exists.",
        ErrorCode.STATE_CONFLICT: "There is a conflict with the current state.",
        ErrorCode.DUPLICATE_ENTRY: "This entry already exists.",
        ErrorCode.RATE_LIMIT_EXCEEDED: "You are making too many requests. Please slow down.",
        ErrorCode.INTERNAL_ERROR: "An internal error occurred. Please try again later.",
        ErrorCode.DATABASE_ERROR: "A database error occurred. Please try again later.",
        ErrorCode.SERVICE_ERROR: "A service error occurred. Please try again later.",
        ErrorCode.EXTERNAL_SERVICE_ERROR: "An external service is currently unavailable. Please try again later.",
        ErrorCode.LLM_ERROR: "An LLM error occurred. Please try again later.",
        ErrorCode.LLM_TIMEOUT: "The LLM request timed out. Please try again.",
        ErrorCode.INVALID_PROMPT: "The prompt is invalid.",
        ErrorCode.MODEL_NOT_AVAILABLE: "The model is currently not available.",
        ErrorCode.KAFKA_ERROR: "A message queue error occurred. Please try again later.",
        ErrorCode.MESSAGE_PUBLISH_ERROR: "Failed to publish message. Please try again.",
        ErrorCode.MESSAGE_CONSUME_ERROR: "Failed to consume message. Please try again.",
        ErrorCode.UNKNOWN_ERROR: "An unexpected error occurred. Please try again later.",
    }

    @staticmethod
    def handle_error(
        error: Exception,
        context: Optional[Dict[str, Any]] = None
    ) -> AppException:
        """Normalize and handle errors consistently"""

        # If it's already an AppException, return as-is
        if isinstance(error, AppException):
            return error

        # If it's a standard exception
        if isinstance(error, Exception):
            message = str(error) if str(error) else "An error occurred"
            code = ErrorCode.INTERNAL_ERROR
            status_code = 500

            logger.error(f"Standard Error: {code}", exc_info=error)

            return AppException(status_code, message, code, context)

        # Unknown error type
        logger.error(f"Unknown Error: {error}")
        return AppException(
            500,
            "An unexpected error occurred",
            ErrorCode.UNKNOWN_ERROR,
            {"original": str(error)},
        )

    @staticmethod
    def create_validation_error(
        field: str, message: str, context: Optional[Dict[str, Any]] = None
    ) -> ValidationError:
        """Create validation error"""
        return ValidationError(message, {"field": field, **(context or {})})

    @staticmethod
    def create_not_found_error(
        resource: str, context: Optional[Dict[str, Any]] = None
    ) -> NotFoundError:
        """Create not found error"""
        return NotFoundError(resource, context)

    @staticmethod
    def create_conflict_error(
        message: str, context: Optional[Dict[str, Any]] = None
    ) -> ConflictError:
        """Create conflict error"""
        return ConflictError(message, context)

    @staticmethod
    def create_unauthorized_error(
        message = "Unauthorized", context: Optional[Dict[str, Any]] = None
    ) -> UnauthorizedError:
        """Create unauthorized error"""
        return UnauthorizedError(message, context)

    @staticmethod
    def create_forbidden_error(
        message = "Forbidden", context: Optional[Dict[str, Any]] = None
    ) -> ForbiddenError:
        """Create forbidden error"""
        return ForbiddenError(message, context)

    @staticmethod
    def create_llm_error(
        message: str, context: Optional[Dict[str, Any]] = None
    ) -> LLMError:
        """Create LLM error"""
        return LLMError(message, context)

    @staticmethod
    def create_kafka_error(
        message: str, context: Optional[Dict[str, Any]] = None
    ) -> KafkaError:
        """Create Kafka error"""
        return KafkaError(message, context)

    @staticmethod
    def create_business_logic_error(
        code: ErrorCode, message: str, context: Optional[Dict[str, Any]] = None
    ) -> AppException:
        """Create business logic error"""
        return AppException(400, message, code, context)

    @staticmethod
    def create_error_log(
        error: AppException,
        context: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
    ) -> ErrorResponse:
        """Create detailed error response for logging"""
        return ErrorResponse(
            status_code=error.status_code,
            code=error.code,
            message=error.message,
            timestamp=datetime.now(timezone.utc),
            request_id=request_id,
            context={**error.context, **(context or {})},
            suggestion=ErrorHandler.SUGGESTIONS.get(error.code),
        )

    @staticmethod
    def log_error(
        error: AppException,
        context: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
    ) -> None:
        """Log error with context"""
        error_log = ErrorHandler.create_error_log(error, context, request_id)

        if error.status_code >= 500:
            logger.error(f"[{request_id}] {error.code}", extra=error_log.model_dump())
        else:
            logger.warning(f"[{request_id}] {error.code}", extra=error_log.model_dump())

    @staticmethod
    def get_suggestion(code: ErrorCode) -> str:
        """Get user-friendly suggestion based on error code"""
        return ErrorHandler.SUGGESTIONS.get(
            code, "An error occurred. Please try again."
        )
