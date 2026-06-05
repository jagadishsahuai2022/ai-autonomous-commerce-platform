"""
Python Error Handler Tests
- Test error handling service
- Test custom exceptions
- Test error mapping and logging
"""

import pytest
from datetime import datetime
from error_handler import (
    ErrorCode,
    ErrorHandler,
    AppException,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
)


class TestErrorCodes:
    """Test error code enumeration"""

    def test_validation_error_codes(self):
        """Test validation error codes exist"""
        assert hasattr(ErrorCode, 'INVALID_INPUT')
        assert hasattr(ErrorCode, 'MISSING_REQUIRED_FIELD')
        assert hasattr(ErrorCode, 'VALIDATION_FAILED')

    def test_auth_error_codes(self):
        """Test authentication error codes"""
        assert hasattr(ErrorCode, 'UNAUTHORIZED')
        assert hasattr(ErrorCode, 'INVALID_CREDENTIALS')
        assert hasattr(ErrorCode, 'TOKEN_EXPIRED')

    def test_server_error_codes(self):
        """Test server error codes"""
        assert hasattr(ErrorCode, 'INTERNAL_ERROR')
        assert hasattr(ErrorCode, 'DATABASE_ERROR')
        assert hasattr(ErrorCode, 'SERVICE_ERROR')

    def test_business_error_codes(self):
        """Test business logic error codes"""
        assert hasattr(ErrorCode, 'OUT_OF_STOCK')
        assert hasattr(ErrorCode, 'INVALID_STATE')
        assert hasattr(ErrorCode, 'PAYMENT_FAILED')


class TestErrorHandlerHandleError:
    """Test ErrorHandler.handle_error method"""

    def test_handle_app_exception(self):
        """Should return AppException directly"""
        exc = AppException(400, 'Test error', ErrorCode.INVALID_INPUT)
        result = ErrorHandler.handle_error(exc)

        assert result is exc

    def test_handle_standard_error(self):
        """Should convert standard Error to AppException"""
        error = Exception('Test error')
        result = ErrorHandler.handle_error(error)

        assert isinstance(result, AppException)
        assert result.status_code == 500
        assert result.code == ErrorCode.INTERNAL_ERROR

    def test_handle_error_with_context(self):
        """Should include context in error"""
        context = {'user_id': '123', 'action': 'create'}
        error = Exception('Test error')
        result = ErrorHandler.handle_error(error, context)

        assert result.context == context


class TestErrorFactories:
    """Test error creation factory methods"""

    def test_create_validation_error(self):
        """Should create validation error"""
        error = ErrorHandler.create_validation_error('email', 'Invalid email')

        assert isinstance(error, ValidationError)
        assert error.status_code == 400
        assert error.code == ErrorCode.VALIDATION_FAILED
        assert error.context['field'] == 'email'

    def test_create_not_found_error(self):
        """Should create not found error"""
        error = ErrorHandler.create_not_found_error('User')

        assert isinstance(error, NotFoundError)
        assert error.status_code == 404
        assert error.code == ErrorCode.RESOURCE_NOT_FOUND
        assert 'not found' in error.message.lower()

    def test_create_unauthorized_error(self):
        """Should create unauthorized error"""
        error = ErrorHandler.create_unauthorized_error('Invalid token')

        assert isinstance(error, UnauthorizedError)
        assert error.status_code == 401
        assert error.code == ErrorCode.UNAUTHORIZED

    def test_create_forbidden_error(self):
        """Should create forbidden error"""
        error = ErrorHandler.create_forbidden_error('Access denied')

        assert isinstance(error, ForbiddenError)
        assert error.status_code == 403
        assert error.code == ErrorCode.FORBIDDEN

    def test_create_business_logic_error(self):
        """Should create business logic error"""
        error = ErrorHandler.create_business_logic_error(
            ErrorCode.OUT_OF_STOCK,
            'Product out of stock'
        )

        assert error.status_code == 400
        assert error.code == ErrorCode.OUT_OF_STOCK


class TestErrorLog:
    """Test error logging"""

    def test_create_error_log(self):
        """Should create structured error log"""
        error = AppException(400, 'Test error', ErrorCode.VALIDATION_FAILED)
        error_log = ErrorHandler.create_error_log(error, request_id='req-123')

        assert error_log.status_code == 400
        assert error_log.code == ErrorCode.VALIDATION_FAILED
        assert error_log.message == 'Test error'
        assert error_log.request_id == 'req-123'
        assert isinstance(error_log.timestamp, datetime)

    def test_error_log_includes_suggestion(self):
        """Should include suggestion in error log"""
        error = AppException(401, 'Unauthorized', ErrorCode.UNAUTHORIZED)
        error_log = ErrorHandler.create_error_log(error)

        assert error_log.suggestion is not None
        assert len(error_log.suggestion) > 0

    def test_error_log_with_context(self):
        """Should include context in error log"""
        context = {'user_id': '123', 'action': 'delete'}
        error = AppException(
            403,
            'Forbidden',
            ErrorCode.FORBIDDEN,
            context=context
        )
        error_log = ErrorHandler.create_error_log(error)

        assert error_log.context is not None
        assert 'user_id' in error_log.context
        assert error_log.context['user_id'] == '123'


class TestErrorSuggestions:
    """Test error suggestions"""

    def test_get_suggestion_for_each_error_code(self):
        """Should provide suggestion for each error code"""
        error_codes = [
            ErrorCode.INVALID_INPUT,
            ErrorCode.UNAUTHORIZED,
            ErrorCode.FORBIDDEN,
            ErrorCode.RESOURCE_NOT_FOUND,
            ErrorCode.INTERNAL_ERROR,
        ]

        for code in error_codes:
            suggestion = ErrorHandler.get_suggestion(code)
            assert suggestion is not None
            assert len(suggestion) > 0

    def test_suggestion_is_user_friendly(self):
        """Suggestions should be user-friendly"""
        suggestion = ErrorHandler.get_suggestion(ErrorCode.UNAUTHORIZED)

        assert 'log in' in suggestion.lower() or 'session' in suggestion.lower()

    def test_suggestion_for_unknown_code(self):
        """Should provide default suggestion for unknown code"""
        suggestion = ErrorHandler.get_suggestion(ErrorCode.UNKNOWN_ERROR)

        assert suggestion is not None
        assert 'unexpected' in suggestion.lower() or 'error' in suggestion.lower()


class TestCustomExceptions:
    """Test custom exception classes"""

    def test_validation_error_properties(self):
        """ValidationError should have correct properties"""
        error = ValidationError('Email required', {'field': 'email'})

        assert error.status_code == 400
        assert error.code == ErrorCode.VALIDATION_FAILED
        assert error.message == 'Email required'

    def test_not_found_error_properties(self):
        """NotFoundError should have correct properties"""
        error = NotFoundError('User')

        assert error.status_code == 404
        assert error.code == ErrorCode.RESOURCE_NOT_FOUND
        assert 'user' in error.message.lower()

    def test_exception_message_property(self):
        """Exception should have accessible message"""
        msg = 'Test message'
        error = ValidationError(msg)

        assert error.message == msg
        assert str(error) == msg

    def test_exception_context_property(self):
        """Exception should store context"""
        context = {'key': 'value'}
        error = ValidationError('Test', context)

        assert error.context == context


class TestErrorMapping:
    """Test error status and code mapping"""

    def test_all_error_codes_have_suggestions(self):
        """All error codes should have suggestions"""
        for code in ErrorCode:
            suggestion = ErrorHandler.SUGGESTIONS.get(code)
            assert suggestion is not None, f"No suggestion for {code}"

    def test_status_code_to_error_code_mapping(self):
        """Test status code to error code mapping"""
        mappings = [
            (400, ErrorCode.INVALID_INPUT),
            (401, ErrorCode.UNAUTHORIZED),
            (403, ErrorCode.FORBIDDEN),
            (404, ErrorCode.RESOURCE_NOT_FOUND),
            (409, ErrorCode.STATE_CONFLICT),
            (429, ErrorCode.RATE_LIMIT_EXCEEDED),
            (500, ErrorCode.INTERNAL_ERROR),
        ]

        for status, expected_code in mappings:
            assert status in ErrorHandler.STATUS_TO_CODE or status == 500


class TestErrorContext:
    """Test error context management"""

    def test_context_preservation(self):
        """Context should be preserved through error chain"""
        context = {'user_id': 'user-123', 'order_id': 'order-456'}
        error = AppException(
            400,
            'Test error',
            ErrorCode.INVALID_STATE,
            context=context
        )

        assert error.context['user_id'] == 'user-123'
        assert error.context['order_id'] == 'order-456'

    def test_context_merge(self):
        """Contexts should be mergeable"""
        original_context = {'user_id': 'user-123'}
        additional_context = {'action': 'create'}

        merged = {**original_context, **additional_context}
        error = AppException(400, 'Test', ErrorCode.INVALID_INPUT, context=merged)

        assert 'user_id' in error.context
        assert 'action' in error.context


class TestErrorResponse:
    """Test error response models"""

    def test_error_response_structure(self):
        """ErrorResponse should have required fields"""
        from error_handler import ErrorResponse

        response = ErrorResponse(
            status_code=400,
            code=ErrorCode.VALIDATION_FAILED,
            message='Test error',
            timestamp=datetime.utcnow()
        )

        assert response.status_code == 400
        assert response.code == ErrorCode.VALIDATION_FAILED
        assert response.message == 'Test error'
        assert response.timestamp is not None

    def test_error_response_optional_fields(self):
        """ErrorResponse optional fields should work"""
        from error_handler import ErrorResponse

        response = ErrorResponse(
            status_code=400,
            code=ErrorCode.VALIDATION_FAILED,
            message='Test error',
            timestamp=datetime.utcnow(),
            request_id='req-123',
            context={'field': 'email'},
            suggestion='Please check email format'
        )

        assert response.request_id == 'req-123'
        assert response.context is not None
        assert response.suggestion is not None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
