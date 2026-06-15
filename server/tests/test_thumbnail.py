"""缩略图生成 + Celery 异步任务 测试

测试内容：
1. Pillow resize_image 纯函数测试（格式、尺寸、质量）
2. build_thumbnail_key / build_thumbnail_url 辅助函数
3. Celery app 配置验证
4. process_thumbnail 完整流程（mock MinIO + DB）
5. POST /api/v1/upload/callback 接口
6. Celery task 在 always_eager 模式下的行为
7. MinIO 不可用时的优雅降级
"""

import pytest
from io import BytesIO
from unittest.mock import patch, MagicMock, AsyncMock

from PIL import Image


# ── 辅助：创建测试图片 ────────────────────────────────────

def _make_test_image(width=800, height=600, mode="RGB", fmt="PNG") -> bytes:
    """创建指定尺寸的测试图片 bytes"""
    img = Image.new(mode, (width, height), color=(255, 128, 64))
    buf = BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


# ══════════════════════════════════════════════════════════
# 1. resize_image 纯函数测试
# ══════════════════════════════════════════════════════════

class TestResizeImage:
    """Pillow 缩放逻辑 — 无 IO 依赖，可独立测试"""

    def test_resize_outputs_webp(self):
        """输出格式必须是 WebP"""
        from app.services.thumbnail_service import resize_image

        original = _make_test_image(800, 600)
        result = resize_image(original, 300, 300, 80)

        # WebP magic bytes: RIFF....WEBP
        assert result[:4] == b"RIFF"
        assert result[8:12] == b"WEBP"

    def test_resize_respects_max_dimensions(self):
        """缩放后宽高不超过 300×300"""
        from app.services.thumbnail_service import resize_image

        original = _make_test_image(800, 600)
        result = resize_image(original, 300, 300, 80)

        img = Image.open(BytesIO(result))
        assert img.width <= 300
        assert img.height <= 300

    def test_resize_preserves_aspect_ratio(self):
        """缩放保持纵横比（800:600 = 4:3 → 300:225）"""
        from app.services.thumbnail_service import resize_image

        original = _make_test_image(800, 600)
        result = resize_image(original, 300, 300, 80)

        img = Image.open(BytesIO(result))
        # 800:600 = 4:3 → 300:225
        assert img.width == 300
        assert img.height == 225

    def test_resize_portrait_image(self):
        """竖图缩放：600:800 = 3:4 → 225:300"""
        from app.services.thumbnail_service import resize_image

        original = _make_test_image(600, 800)
        result = resize_image(original, 300, 300, 80)

        img = Image.open(BytesIO(result))
        assert img.width == 225
        assert img.height == 300

    def test_resize_small_image_not_upscaled(self):
        """小于目标尺寸的图片不应放大"""
        from app.services.thumbnail_service import resize_image

        original = _make_test_image(100, 80)
        result = resize_image(original, 300, 300, 80)

        img = Image.open(BytesIO(result))
        # thumbnail() 不会放大，保持原尺寸
        assert img.width == 100
        assert img.height == 80

    def test_resize_rgba_image_converts_to_rgb(self):
        """RGBA 图片应自动转换为 RGB 再保存 WebP"""
        from app.services.thumbnail_service import resize_image

        original = _make_test_image(400, 300, mode="RGBA")
        result = resize_image(original, 300, 300, 80)

        img = Image.open(BytesIO(result))
        assert img.mode == "RGB"

    def test_resize_palette_image_converts_to_rgb(self):
        """P 模式（调色板）图片应自动转换为 RGB"""
        from app.services.thumbnail_service import resize_image

        original = _make_test_image(400, 300, mode="P")
        result = resize_image(original, 300, 300, 80)

        img = Image.open(BytesIO(result))
        assert img.mode == "RGB"

    def test_resize_quality_produces_valid_webp(self):
        """不同质量等级都应产出合法 WebP"""
        from app.services.thumbnail_service import resize_image

        original = _make_test_image(800, 600)
        for q in [10, 50, 90]:
            result = resize_image(original, 300, 300, quality=q)
            # 验证是合法 WebP
            assert result[:4] == b"RIFF"
            assert result[8:12] == b"WEBP"
            # 能被 Pillow 重新打开
            img = Image.open(BytesIO(result))
            assert img.width <= 300
            assert img.height <= 300

    def test_resize_square_image(self):
        """正方形图片缩放后仍为正方形"""
        from app.services.thumbnail_service import resize_image

        original = _make_test_image(500, 500)
        result = resize_image(original, 300, 300, 80)

        img = Image.open(BytesIO(result))
        assert img.width == 300
        assert img.height == 300


# ══════════════════════════════════════════════════════════
# 2. 辅助函数测试
# ══════════════════════════════════════════════════════════

class TestHelperFunctions:
    """缩略图路径/URL 生成辅助函数"""

    def test_build_thumbnail_key_format(self):
        """缩略图路径格式: thumbnails/{userId}/{uuid}.webp"""
        from app.services.thumbnail_service import build_thumbnail_key

        key = build_thumbnail_key("user123")
        assert key.startswith("thumbnails/user123/")
        assert key.endswith(".webp")

        # uuid 部分应为 32 位十六进制
        parts = key.split("/")
        uuid_part = parts[2].replace(".webp", "")
        assert len(uuid_part) == 32
        # 十六进制字符
        assert all(c in "0123456789abcdef" for c in uuid_part)

    def test_build_thumbnail_key_unique(self):
        """每次生成的 key 应不同"""
        from app.services.thumbnail_service import build_thumbnail_key

        key1 = build_thumbnail_key("user1")
        key2 = build_thumbnail_key("user1")
        assert key1 != key2

    def test_build_thumbnail_url(self):
        """URL 格式: {MINIO_PUBLIC_URL}/{MINIO_BUCKET}/{thumb_key}"""
        from app.services.thumbnail_service import build_thumbnail_url

        thumb_key = "thumbnails/user123/abc.webp"
        url = build_thumbnail_url(thumb_key)

        assert "thumbnails/user123/abc.webp" in url
        assert url.startswith("http")


# ══════════════════════════════════════════════════════════
# 3. Celery App 配置测试
# ══════════════════════════════════════════════════════════

class TestCeleryAppConfig:
    """Celery 应用配置验证"""

    def test_celery_app_exists(self):
        """celery_app 应可正常导入"""
        from app.tasks.celery_app import celery_app
        assert celery_app is not None

    def test_celery_app_name(self):
        """Celery app 名称应为 baby_album"""
        from app.tasks.celery_app import celery_app
        assert celery_app.main == "baby_album"

    def test_celery_serializer_json(self):
        """序列化格式应为 JSON"""
        from app.tasks.celery_app import celery_app
        assert celery_app.conf.task_serializer == "json"
        assert celery_app.conf.result_serializer == "json"

    def test_celery_task_routes(self):
        """缩略图任务应路由到 thumbnails 队列"""
        from app.tasks.celery_app import celery_app
        routes = celery_app.conf.task_routes
        assert "app.tasks.thumbnail.generate_thumbnail" in routes
        assert routes["app.tasks.thumbnail.generate_thumbnail"]["queue"] == "thumbnails"

    def test_celery_utc_timezone(self):
        """时区应为 UTC"""
        from app.tasks.celery_app import celery_app
        assert celery_app.conf.timezone == "UTC"
        assert celery_app.conf.enable_utc is True


# ══════════════════════════════════════════════════════════
# 4. Celery Task 注册测试
# ══════════════════════════════════════════════════════════

class TestCeleryTask:
    """Celery 任务注册与基本属性"""

    def test_generate_thumbnail_task_registered(self):
        """generate_thumbnail 应注册为 Celery task"""
        from app.tasks.thumbnail import generate_thumbnail
        assert generate_thumbnail.name == "app.tasks.thumbnail.generate_thumbnail"

    def test_generate_thumbnail_max_retries(self):
        """最大重试次数应为 3"""
        from app.tasks.thumbnail import generate_thumbnail
        assert generate_thumbnail.max_retries == 3

    def test_generate_thumbnail_default_retry_delay(self):
        """重试间隔应为 5 秒"""
        from app.tasks.thumbnail import generate_thumbnail
        assert generate_thumbnail.default_retry_delay == 5


# ══════════════════════════════════════════════════════════
# 5. process_thumbnail 完整流程（mock MinIO + DB）
# ══════════════════════════════════════════════════════════

class TestProcessThumbnail:
    """process_thumbnail 完整流程 — mock MinIO 和 DB"""

    @pytest.mark.asyncio
    async def test_process_thumbnail_success(self, db_session):
        """正常流程：下载 → 缩放 → 上传 → 更新 DB"""
        from app.services.thumbnail_service import process_thumbnail
        from app.models.media import Media, MediaType

        # 创建测试 Media 记录
        media = Media(
            id="test-media-1",
            user_id="user-1",
            baby_id="baby-1",
            type=MediaType.image,
            cos_key="photos/user-1/test.png",
            capture_date="2026-06-15",
        )
        db_session.add(media)
        await db_session.commit()

        # Mock MinIO
        test_image = _make_test_image(800, 600)
        mock_response = MagicMock()
        mock_response.read.return_value = test_image
        mock_response.close = MagicMock()
        mock_response.release_conn = MagicMock()

        with patch("app.services.thumbnail_service.minio_client") as mock_minio:
            mock_minio.get_object.return_value = mock_response
            mock_minio.put_object.return_value = None

            result = await process_thumbnail(
                media_id="test-media-1",
                cos_key="photos/user-1/test.png",
                user_id="user-1",
                db=db_session,
            )

        # 应返回缩略图 URL
        assert result is not None
        assert "thumbnails/user-1/" in result
        assert ".webp" in result

        # 验证 MinIO 调用
        mock_minio.get_object.assert_called_once()
        mock_minio.put_object.assert_called_once()

        # 验证 DB 记录已更新
        from sqlalchemy import select
        r = await db_session.execute(select(Media).where(Media.id == "test-media-1"))
        updated = r.scalar_one()
        assert updated.thumbnail_key is not None
        assert updated.thumbnail_url is not None
        assert "thumbnails/user-1/" in updated.thumbnail_key

    @pytest.mark.asyncio
    async def test_process_thumbnail_minio_unavailable(self, db_session):
        """MinIO 不可用时应优雅降级，返回 None"""
        from app.services.thumbnail_service import process_thumbnail
        from app.models.media import Media, MediaType

        media = Media(
            id="test-media-2",
            user_id="user-1",
            baby_id="baby-1",
            type=MediaType.image,
            cos_key="photos/user-1/test.png",
            capture_date="2026-06-15",
        )
        db_session.add(media)
        await db_session.commit()

        with patch("app.services.thumbnail_service.minio_client") as mock_minio:
            mock_minio.get_object.side_effect = Exception("MinIO connection refused")

            result = await process_thumbnail(
                media_id="test-media-2",
                cos_key="photos/user-1/test.png",
                user_id="user-1",
                db=db_session,
            )

        # 应返回 None，不抛异常
        assert result is None

        # DB 记录不应被修改
        from sqlalchemy import select
        r = await db_session.execute(select(Media).where(Media.id == "test-media-2"))
        unchanged = r.scalar_one()
        assert unchanged.thumbnail_key is None
        assert unchanged.thumbnail_url is None


# ══════════════════════════════════════════════════════════
# 6. POST /api/v1/upload/callback 接口测试
# ══════════════════════════════════════════════════════════

class TestUploadCallbackAPI:
    """上传回调接口测试"""

    @pytest.mark.asyncio
    async def test_callback_dispatches_task(self, client, db_session, auth_headers):
        """callback 接口应触发 Celery 任务"""
        import jwt as pyjwt
        from app.config import settings
        from app.models.media import Media, MediaType

        # 从 auth_headers 的 token 中提取真实 user_id
        token = auth_headers["Authorization"].replace("Bearer ", "")
        payload = pyjwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        real_user_id = payload["sub"]

        # 创建测试 Media 记录，user_id 必须与认证用户一致
        media = Media(
            id="callback-media-1",
            user_id=real_user_id,
            baby_id="baby-1",
            type=MediaType.image,
            cos_key="photos/" + real_user_id + "/photo.png",
            capture_date="2026-06-15",
        )
        db_session.add(media)
        await db_session.commit()

        # generate_thumbnail 在路由函数内部通过 from...import 导入，
        # 所以需要 mock app.tasks.thumbnail 模块上的 generate_thumbnail
        with patch("app.tasks.thumbnail.generate_thumbnail") as mock_task_func:
            mock_result = MagicMock()
            mock_result.id = "task-abc-123"
            mock_task_func.delay.return_value = mock_result

            response = await client.post(
                "/api/v1/upload/callback",
                json={"mediaId": "callback-media-1"},
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["taskId"] == "task-abc-123"
        assert "started" in data["message"].lower() or "Thumbnail" in data["message"]

    @pytest.mark.asyncio
    async def test_callback_media_not_found(self, client, auth_headers):
        """不存在的 media_id 应返回 404"""
        response = await client.post(
            "/api/v1/upload/callback",
            json={"mediaId": "nonexistent-id"},
            headers=auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_callback_no_auth(self, client, db_session):
        """未认证请求应返回 401"""
        from app.models.media import Media, MediaType

        media = Media(
            id="callback-media-noauth",
            user_id="user-1",
            baby_id="baby-1",
            type=MediaType.image,
            cos_key="photos/user-1/photo.png",
            capture_date="2026-06-15",
        )
        db_session.add(media)
        await db_session.commit()

        response = await client.post(
            "/api/v1/upload/callback",
            json={"mediaId": "callback-media-noauth"},
        )

        assert response.status_code == 401


# ══════════════════════════════════════════════════════════
# 7. Celery always_eager 模式测试
# ══════════════════════════════════════════════════════════

class TestCeleryEagerMode:
    """在 task_always_eager=True 下同步执行 Celery 任务"""

    def test_task_executes_synchronously_in_eager_mode(self):
        """always_eager 模式下任务应同步执行"""
        from app.tasks.celery_app import celery_app

        # 设置 eager 模式
        celery_app.conf.task_always_eager = True
        celery_app.conf.task_eager_propagates = True

        try:
            # process_thumbnail 在任务函数内通过 from app.services.thumbnail_service import
            # AsyncSessionLocal 在任务函数内通过 from app.database import
            with patch("app.services.thumbnail_service.process_thumbnail") as mock_process:
                with patch("app.database.AsyncSessionLocal") as mock_session_local:
                    mock_db = AsyncMock()
                    mock_session_local.return_value.__aenter__ = AsyncMock(return_value=mock_db)
                    mock_session_local.return_value.__aexit__ = AsyncMock(return_value=None)

                    mock_process.return_value = "http://example.com/thumb.webp"

                    from app.tasks.thumbnail import generate_thumbnail
                    result = generate_thumbnail.delay(
                        "media-1", "photos/user1/test.png", "user-1"
                    )

                    # eager 模式下 result.get() 立即返回
                    assert result.successful()
        finally:
            celery_app.conf.task_always_eager = False
            celery_app.conf.task_eager_propagates = False

    def test_task_retries_on_failure(self):
        """任务失败应触发重试"""
        from app.tasks.celery_app import celery_app

        celery_app.conf.task_always_eager = True
        celery_app.conf.task_eager_propagates = True

        try:
            with patch("app.services.thumbnail_service.process_thumbnail") as mock_process:
                with patch("app.database.AsyncSessionLocal") as mock_session_local:
                    mock_db = AsyncMock()
                    mock_session_local.return_value.__aenter__ = AsyncMock(return_value=mock_db)
                    mock_session_local.return_value.__aexit__ = AsyncMock(return_value=None)

                    mock_process.return_value = None  # 返回 None 表示失败

                    from app.tasks.thumbnail import generate_thumbnail

                    # 在 eager 模式下，重试会立即执行
                    # 最终应抛出 MaxRetriesExceededError 或 RuntimeError
                    with pytest.raises(Exception):
                        generate_thumbnail.delay(
                            "media-retry", "photos/user1/test.png", "user-1"
                        )
        finally:
            celery_app.conf.task_always_eager = False
            celery_app.conf.task_eager_propagates = False
