"""结构化日志工具 — 支持 JSON (生产) / 标准格式 (开发)"""

import logging
import json
import os
import sys
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    """JSON 格式化器 — 生产环境使用，输出结构化 JSON 日志"""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # 附加额外字段
        if hasattr(record, "extra_data") and record.extra_data:
            log_entry["data"] = record.extra_data

        # 异常信息
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
            }

        return json.dumps(log_entry, ensure_ascii=False, default=str)


class DevFormatter(logging.Formatter):
    """开发环境格式化器 — 可读性优先"""

    COLORS = {
        "DEBUG": "\033[36m",     # cyan
        "INFO": "\033[32m",      # green
        "WARNING": "\033[33m",   # yellow
        "ERROR": "\033[31m",     # red
        "CRITICAL": "\033[35m",  # magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        msg = f"{color}{record.levelname:<8}{self.RESET} {ts} [{record.name}] {record.getMessage()}"

        # 附加额外字段
        if hasattr(record, "extra_data") and record.extra_data:
            msg += f" | data={json.dumps(record.extra_data, ensure_ascii=False, default=str)}"

        if record.exc_info and record.exc_info[1]:
            msg += f"\n  Exception: {record.exc_info[0].__name__}: {record.exc_info[1]}"

        return msg


class StructuredLogger(logging.Logger):
    """扩展 Logger — 支持 extra_data 关键字参数"""

    def _log(self, level, msg, args, exc_info=None, extra=None, stack_info=False,
             stacklevel=1, extra_data=None, **kwargs):
        """重写 _log 以支持 extra_data 参数"""
        if extra is None:
            extra = {}
        if extra_data:
            extra["extra_data"] = extra_data
        super()._log(level, msg, args, exc_info=exc_info, extra=extra,
                     stack_info=stack_info, stacklevel=stacklevel)


# 保存原始 Logger 类
_original_logger_class = logging.getLoggerClass()

# 标记是否已初始化
_initialized = False


def setup_logging(level: str = "INFO") -> None:
    """配置全局日志系统

    Args:
        level: 日志级别 (DEBUG/INFO/WARNING/ERROR/CRITICAL)
    """
    global _initialized

    if _initialized:
        return

    # 注册 StructuredLogger
    logging.setLoggerClass(StructuredLogger)

    # 获取根日志器
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # 清除已有处理器
    root_logger.handlers.clear()

    # 创建控制台处理器
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(getattr(logging, level.upper(), logging.INFO))

    # 根据环境选择格式
    env = os.getenv("APP_ENV", "development").lower()
    if env in ("production", "staging"):
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(DevFormatter())

    root_logger.addHandler(handler)

    # 降低第三方库日志级别
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    _initialized = True


def get_logger(name: str) -> StructuredLogger:
    """获取命名日志器

    Args:
        name: 日志器名称（通常为模块名）

    Returns:
        StructuredLogger 实例
    """
    # 确保使用 StructuredLogger 类
    logging.setLoggerClass(StructuredLogger)
    logger = logging.getLogger(name)

    # 如果尚未初始化，自动以默认配置初始化
    if not _initialized:
        setup_logging()

    return logger
