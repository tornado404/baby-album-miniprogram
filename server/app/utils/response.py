"""统一响应格式化工具"""

from typing import Any


def success_response(data: Any = None, code: int = 0) -> dict:
    """成功响应

    Returns:
        {"code": 0, "data": data}
    """
    return {"code": code, "data": data}


def error_response(message: str, code: int = 1, status_code: int = 400) -> dict:
    """错误响应

    注意：status_code 仅用于调用方设置 HTTP 状态码，不包含在响应体中。

    Returns:
        {"code": code, "message": message}
    """
    return {"code": code, "message": message}


def paginated_response(
    data: Any,
    total: int,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """分页响应

    Returns:
        {"code": 0, "data": data, "pagination": {"page": ..., "page_size": ..., "total": ...}}
    """
    return {
        "code": 0,
        "data": data,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
        },
    }
