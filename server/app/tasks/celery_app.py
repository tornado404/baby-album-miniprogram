"""Celery 应用配置 — Redis broker + backend"""

from celery import Celery
from app.config import settings

celery_app = Celery(
    "baby_album",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.tasks.thumbnail.generate_thumbnail": {"queue": "thumbnails"},
    },
)

# Autodiscover tasks in app/tasks/
celery_app.autodiscover_tasks(["app.tasks"])
