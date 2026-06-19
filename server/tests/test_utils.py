"""Utility function tests — pure functions, no mocks needed"""
import pytest
from datetime import date


class TestCalculateBabyAge:
    def test_normal_age(self):
        from app.utils.age import calculate_baby_age
        result = calculate_baby_age("2025-01-15")
        assert "years" in result
        assert "months" in result
        assert "days" in result

    def test_invalid_date_raises(self):
        from app.utils.age import calculate_baby_age
        with pytest.raises(ValueError, match="Invalid date format"):
            calculate_baby_age("not-a-date")

    def test_future_date_returns_zero(self):
        from app.utils.age import calculate_baby_age
        result = calculate_baby_age("2099-01-01")
        assert result == {"years": 0, "months": 0, "days": 0}

    def test_none_date_raises(self):
        from app.utils.age import calculate_baby_age
        with pytest.raises(ValueError):
            calculate_baby_age(None)


class TestGetRecommendedMilestones:
    def test_returns_list(self):
        from app.utils.milestones import get_recommended_milestones
        result = get_recommended_milestones("2026-01-01")
        assert len(result) > 0
        assert result[0]["name"] == "出生"
        assert "achieved" in result[0]

    def test_empty_date_returns_empty(self):
        from app.utils.milestones import get_recommended_milestones
        assert get_recommended_milestones("") == []

    def test_invalid_date_returns_empty(self):
        from app.utils.milestones import get_recommended_milestones
        assert get_recommended_milestones("bad-date") == []


class TestSuccessResponse:
    def test_with_data(self):
        from app.utils.response import success_response
        result = success_response({"id": "1"})
        assert result["code"] == 0
        assert result["data"]["id"] == "1"

    def test_with_none(self):
        from app.utils.response import success_response
        result = success_response()
        assert result["code"] == 0
        assert result["data"] is None

    def test_custom_code(self):
        from app.utils.response import success_response
        result = success_response("ok", code=100)
        assert result["code"] == 100


class TestErrorResponse:
    def test_defaults(self):
        from app.utils.response import error_response
        result = error_response("Something went wrong")
        assert result["code"] == 1
        assert result["message"] == "Something went wrong"

    def test_custom_code(self):
        from app.utils.response import error_response
        result = error_response("Not found", code=404)
        assert result["code"] == 404


class TestPaginatedResponse:
    def test_defaults(self):
        from app.utils.response import paginated_response
        result = paginated_response([], total=0)
        assert result["pagination"]["page"] == 1
        assert result["pagination"]["page_size"] == 20
        assert result["pagination"]["total"] == 0

    def test_custom_pagination(self):
        from app.utils.response import paginated_response
        result = paginated_response(["a", "b"], total=100, page=3, page_size=10)
        assert result["pagination"]["page"] == 3
        assert result["pagination"]["page_size"] == 10
        assert result["pagination"]["total"] == 100
        assert len(result["data"]) == 2


class TestSetupLogging:
    def test_setup_development(self):
        from app.utils.logging import setup_logging, _initialized
        import os

        # Reset the initialized flag for testing
        import app.utils.logging as logging_module
        logging_module._initialized = False

        os.environ["APP_ENV"] = "development"
        setup_logging("DEBUG")
        assert logging_module._initialized is True

    def test_setup_production(self):
        import app.utils.logging as logging_module
        import os

        logging_module._initialized = False
        os.environ["APP_ENV"] = "production"
        logging_module.setup_logging("INFO")
        assert logging_module._initialized is True

    def test_initialize_only_once(self):
        import app.utils.logging as logging_module

        logging_module._initialized = False
        logging_module.setup_logging()
        logging_module.setup_logging()  # second call should be no-op
        assert logging_module._initialized is True


class TestGetLogger:
    def test_returns_logger(self):
        from app.utils.logging import get_logger
        logger = get_logger("test")
        assert logger.name == "test"

    def test_supports_extra_data(self):
        from app.utils.logging import get_logger
        logger = get_logger("test_extra")
        logger.info("test", extra_data={"key": "val"})


class TestDevFormatter:
    def test_format_with_extra_data(self):
        from app.utils.logging import DevFormatter
        import logging

        fmt = DevFormatter()
        record = logging.LogRecord("test", logging.INFO, "file.py", 1, "msg %s", ("arg",), None)
        record.extra_data = {"user": "u1"}
        result = fmt.format(record)
        assert "msg arg" in result
        assert "user" in result

    def test_format_with_exc_info(self):
        from app.utils.logging import DevFormatter
        import logging
        import sys

        fmt = DevFormatter()
        try:
            raise ValueError("test error")
        except ValueError:
            record = logging.LogRecord("test", logging.ERROR, "file.py", 1, "msg", (), exc_info=sys.exc_info())

        result = fmt.format(record)
        assert "ValueError" in result
        assert "test error" in result


class TestAutoSetup:
    def test_get_logger_auto_setup(self):
        import app.utils.logging as logging_module
        logging_module._initialized = False
        from app.utils.logging import get_logger
        logger = get_logger("auto_test")
        assert logging_module._initialized is True
        assert logger.name == "auto_test"
