"""Celery 缩略图生成任务

generate_thumbnail.delay(media_id, cos_key, user_id)
→ 内部调用 thumbnail_service.process_thumbnail 执行实际工作
→ 通过同步 DB 会话更新 Media 记录（Celery worker 运行在同步上下文）
"""

import logging

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def generate_thumbnail(self, media_id: str, cos_key: str, user_id: str):
    """异步生成缩略图

    Args:
        media_id: 媒体记录 ID
        cos_key: 原图在 MinIO 中的 key
        user_id: 用户 ID

    Retries:
        最多重试 3 次，间隔 5 秒
    """
    from app.services.thumbnail_service import process_thumbnail
    from app.database import AsyncSessionLocal

    logger.info("Generating thumbnail: media_id=%s cos_key=%s", media_id, cos_key)

    try:
        import asyncio

        async def _run():
            async with AsyncSessionLocal() as db:
                result = await process_thumbnail(media_id, cos_key, user_id, db)
                return result

        # Celery worker 是同步的，需要创建事件循环运行异步代码
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        if loop.is_running():
            # 如果已在异步上下文（如测试中 task_always_eager=True），
            # 用新线程运行
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(asyncio.run, _run())
                result = future.result()
        else:
            result = loop.run_until_complete(_run())

        if result is None:
            raise RuntimeError("Thumbnail generation returned None — possible MinIO failure")

        logger.info("Thumbnail generated successfully: media_id=%s", media_id)
        return result

    except Exception as exc:
        logger.warning(
            "Thumbnail generation failed (attempt %d/%d): media_id=%s error=%s",
            self.request.retries + 1,
            self.max_retries,
            media_id,
            exc,
        )
        try:
            self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.error(
                "Thumbnail generation exhausted retries: media_id=%s", media_id
            )
            raise
