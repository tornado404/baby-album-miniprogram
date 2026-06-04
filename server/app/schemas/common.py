"""通用 Pydantic 模型"""
from pydantic import BaseModel
from typing import Any, Optional


class ApiResponse(BaseModel):
    code: int = 0
    message: str = ""
    data: Any = None


class ErrorDetail(BaseModel):
    field: Optional[str] = None
    message: str


class ErrorResponse(BaseModel):
    code: int
    message: str
    details: Optional[list[ErrorDetail]] = None


class PaginationMeta(BaseModel):
    page: int = 1
    page_size: int = 20
    total: int = 0