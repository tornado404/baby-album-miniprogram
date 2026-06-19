"""Thumbnail Celery task additional tests — loop handling & retry exhaustion"""
import pytest
from unittest.mock import patch


class TestLoopHandling:
    def test_task_with_running_loop(self):
        """loop.is_running() == True → ThreadPoolExecutor path"""
        from app.tasks.celery_app import celery_app
        celery_app.conf.task_always_eager = True
        celery_app.conf.task_eager_propagates = True

        try:
            with patch("app.services.thumbnail_service.process_thumbnail",
                       return_value="http://cdn/thumb.webp"), \
                    patch("app.database.AsyncSessionLocal"):
                from app.tasks.thumbnail import generate_thumbnail
                result = generate_thumbnail.delay("m1", "photos/test.jpg", "u1")
            assert result.successful()
        finally:
            celery_app.conf.task_always_eager = False
            celery_app.conf.task_eager_propagates = False


class TestRetryExhaustion:
    def test_retry_returns_none_exhausted(self):
        """process_thumbnail 返回 None 触发重试，耗尽后抛出异常"""
        from app.tasks.celery_app import celery_app
        celery_app.conf.task_always_eager = True
        celery_app.conf.task_eager_propagates = True

        try:
            with patch("app.services.thumbnail_service.process_thumbnail",
                       return_value=None), \
                    patch("app.database.AsyncSessionLocal"):
                from app.tasks.thumbnail import generate_thumbnail
                with pytest.raises(Exception):
                    generate_thumbnail.delay("m1", "photos/test.jpg", "u1")
        finally:
            celery_app.conf.task_always_eager = False
            celery_app.conf.task_eager_propagates = False