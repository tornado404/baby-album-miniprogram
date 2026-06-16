"""结构化日志工具测试 — setup_logging / get_logger / JsonFormatter / DevFormatter"""

import json
import logging
import os
import io

from app.utils.logging import (
    JsonFormatter,
    DevFormatter,
    StructuredLogger,
    setup_logging,
    get_logger,
)


class TestJsonFormatter:
    """JSON 格式化器测试"""

    def test_basic_format(self):
        """基本日志消息格式化为 JSON"""
        formatter = JsonFormatter()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="test.py",
            lineno=1, msg="hello world", args=(), exc_info=None,
        )
        output = formatter.format(record)
        data = json.loads(output)
        assert data["message"] == "hello world"
        assert data["level"] == "INFO"
        assert data["logger"] == "test"
        assert "timestamp" in data

    def test_format_with_extra_data(self):
        """带 extra_data 的日志"""
        formatter = JsonFormatter()
        record = logging.LogRecord(
            name="test", level=logging.WARNING, pathname="test.py",
            lineno=1, msg="something wrong", args=(), exc_info=None,
        )
        record.extra_data = {"user_id": "abc123", "action": "upload"}
        output = formatter.format(record)
        data = json.loads(output)
        assert data["data"]["user_id"] == "abc123"
        assert data["data"]["action"] == "upload"

    def test_format_with_exception(self):
        """异常信息包含在 JSON 中"""
        formatter = JsonFormatter()
        try:
            raise ValueError("test error")
        except ValueError:
            import sys
            exc_info = sys.exc_info()

        record = logging.LogRecord(
            name="test", level=logging.ERROR, pathname="test.py",
            lineno=1, msg="error occurred", args=(), exc_info=exc_info,
        )
        output = formatter.format(record)
        data = json.loads(output)
        assert data["exception"]["type"] == "ValueError"
        assert data["exception"]["message"] == "test error"

    def test_unicode_message(self):
        """中文消息正确输出"""
        formatter = JsonFormatter()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="test.py",
            lineno=1, msg="用户登录成功", args=(), exc_info=None,
        )
        output = formatter.format(record)
        data = json.loads(output)
        assert data["message"] == "用户登录成功"

    def test_non_serializable_data(self):
        """不可序列化的 extra_data 使用 default=str"""
        formatter = JsonFormatter()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="test.py",
            lineno=1, msg="test", args=(), exc_info=None,
        )
        from datetime import datetime
        record.extra_data = {"created_at": datetime(2026, 6, 15, 12, 0, 0)}
        output = formatter.format(record)
        data = json.loads(output)
        assert "2026" in data["data"]["created_at"]


class TestDevFormatter:
    """开发环境格式化器测试"""

    def test_basic_format(self):
        """基本日志消息格式化"""
        formatter = DevFormatter()
        record = logging.LogRecord(
            name="myapp", level=logging.INFO, pathname="test.py",
            lineno=1, msg="hello", args=(), exc_info=None,
        )
        output = formatter.format(record)
        assert "INFO" in output
        assert "hello" in output
        assert "myapp" in output

    def test_color_codes(self):
        """不同级别有颜色代码"""
        formatter = DevFormatter()
        for level_name, color in DevFormatter.COLORS.items():
            level = getattr(logging, level_name)
            record = logging.LogRecord(
                name="test", level=level, pathname="test.py",
                lineno=1, msg="test", args=(), exc_info=None,
            )
            output = formatter.format(record)
            assert color in output

    def test_format_with_extra_data(self):
        """带 extra_data 的日志（开发模式）"""
        formatter = DevFormatter()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="test.py",
            lineno=1, msg="action", args=(), exc_info=None,
        )
        record.extra_data = {"key": "value"}
        output = formatter.format(record)
        assert "data=" in output
        assert "key" in output


class TestSetupLogging:
    """setup_logging 函数测试"""

    def setup_method(self):
        """每个测试前重置日志配置"""
        # 重置初始化状态
        import app.utils.logging as logging_module
        logging_module._initialized = False
        # 清理根日志器
        root = logging.getLogger()
        root.handlers.clear()

    def test_setup_creates_handler(self):
        """setup_logging 创建 StreamHandler"""
        setup_logging("INFO")
        root = logging.getLogger()
        assert len(root.handlers) == 1
        assert isinstance(root.handlers[0], logging.StreamHandler)

    def test_setup_dev_mode(self):
        """开发模式使用 DevFormatter"""
        original_env = os.environ.get("APP_ENV")
        os.environ["APP_ENV"] = "development"
        try:
            import app.utils.logging as logging_module
            logging_module._initialized = False
            setup_logging("INFO")
            root = logging.getLogger()
            assert isinstance(root.handlers[0].formatter, DevFormatter)
        finally:
            if original_env is None:
                os.environ.pop("APP_ENV", None)
            else:
                os.environ["APP_ENV"] = original_env

    def test_setup_production_mode(self):
        """生产模式使用 JsonFormatter"""
        original_env = os.environ.get("APP_ENV")
        os.environ["APP_ENV"] = "production"
        try:
            import app.utils.logging as logging_module
            logging_module._initialized = False
            setup_logging("INFO")
            root = logging.getLogger()
            assert isinstance(root.handlers[0].formatter, JsonFormatter)
        finally:
            if original_env is None:
                os.environ.pop("APP_ENV", None)
            else:
                os.environ["APP_ENV"] = original_env

    def test_setup_log_level(self):
        """设置日志级别"""
        setup_logging("DEBUG")
        root = logging.getLogger()
        assert root.level == logging.DEBUG

    def test_noisy_loggers_suppressed(self):
        """第三方日志级别被降低"""
        setup_logging("INFO")
        for name in ("uvicorn.access", "sqlalchemy.engine", "httpx", "httpcore"):
            logger = logging.getLogger(name)
            assert logger.level == logging.WARNING

    def test_idempotent(self):
        """多次调用 setup_logging 不会重复添加 handler"""
        setup_logging("INFO")
        handler_count = len(logging.getLogger().handlers)
        setup_logging("INFO")
        setup_logging("DEBUG")
        assert len(logging.getLogger().handlers) == handler_count


class TestGetLogger:
    """get_logger 函数测试"""

    def setup_method(self):
        import app.utils.logging as logging_module
        logging_module._initialized = False
        logging.getLogger().handlers.clear()

    def test_returns_structured_logger(self):
        """返回 StructuredLogger 实例"""
        logger = get_logger("test_module")
        assert isinstance(logger, StructuredLogger)

    def test_logger_name(self):
        """日志器名称正确"""
        logger = get_logger("my.module")
        assert logger.name == "my.module"

    def test_logger_auto_setup(self):
        """get_logger 自动初始化日志系统"""
        import app.utils.logging as logging_module
        assert logging_module._initialized is False
        get_logger("auto_init_test")
        assert logging_module._initialized is True

    def test_logger_output(self):
        """日志器正确输出消息"""
        # 捕获输出
        stream = io.StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(JsonFormatter())

        logger = get_logger("output_test")
        # 移除已有的 handler，添加我们自己的
        logger.handlers.clear()
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

        logger.info("test message")
        output = stream.getvalue()
        data = json.loads(output.strip())
        assert data["message"] == "test message"
        assert data["logger"] == "output_test"

    def test_logger_with_extra_data(self):
        """StructuredLogger 支持 extra_data"""
        stream = io.StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(JsonFormatter())

        logger = get_logger("extra_test")
        logger.handlers.clear()
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

        logger.info("with data", extra_data={"request_id": "req-123"})
        output = stream.getvalue()
        data = json.loads(output.strip())
        assert data["data"]["request_id"] == "req-123"
