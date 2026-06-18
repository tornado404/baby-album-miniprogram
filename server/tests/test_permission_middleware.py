"""权限中间件测试 — 直接调用 _check 函数测试所有分支"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException


class TestRequireBabyAccess:
    """权限中间件 _check 函数全部路径测试"""

    @pytest.fixture
    def db_session(self):
        return AsyncMock()

    async def _call_check(self, baby_id, user_id, db, min_permission="viewer"):
        from app.middleware.permission import require_baby_access
        fn = require_baby_access(min_permission=min_permission)
        return await fn(baby_id=baby_id, user_id=user_id, db=db)

    async def test_owner_path(self, db_session):
        """宝宝所有者 → owner"""
        mock_result = MagicMock()
        mock_baby = MagicMock()
        mock_baby.id = "baby-1"
        mock_baby.user_id = "user-1"
        mock_result.scalar_one_or_none.return_value = mock_baby
        db_session.execute.return_value = mock_result

        result = await self._call_check("baby-1", "user-1", db_session)
        assert result == {"user_id": "user-1", "permission": "owner", "baby_id": "baby-1"}

    async def test_no_relation_path(self, db_session):
        """无共享关系 → 40301"""
        r1 = MagicMock()
        r1.scalar_one_or_none.return_value = None
        r2 = MagicMock()
        r2.scalar_one_or_none.return_value = None
        db_session.execute.side_effect = [r1, r2]

        with pytest.raises(HTTPException) as e:
            await self._call_check("baby-1", "stranger", db_session)
        assert e.value.status_code == 403
        assert e.value.detail["code"] == 40301

    async def test_viewer_shared_path(self, db_session):
        """共享 viewer → 返回 viewer"""
        r1 = MagicMock()
        r1.scalar_one_or_none.return_value = None
        rel = MagicMock()
        rel.viewer_user_id = "v1"
        rel.baby_id = "baby-1"
        rel.permission = "viewer"
        r2 = MagicMock()
        r2.scalar_one_or_none.return_value = rel
        db_session.execute.side_effect = [r1, r2]

        result = await self._call_check("baby-1", "v1", db_session)
        assert result == {"user_id": "v1", "permission": "viewer", "baby_id": "baby-1"}

    async def test_insufficient_permission_path(self, db_session):
        """权限不足（viewer 要求 editor）→ 40302"""
        r1 = MagicMock()
        r1.scalar_one_or_none.return_value = None
        rel = MagicMock()
        rel.viewer_user_id = "v1"
        rel.baby_id = "baby-1"
        rel.permission = "viewer"
        r2 = MagicMock()
        r2.scalar_one_or_none.return_value = rel
        db_session.execute.side_effect = [r1, r2]

        with pytest.raises(HTTPException) as e:
            await self._call_check("baby-1", "v1", db_session, min_permission="editor")
        assert e.value.status_code == 403
        assert e.value.detail["code"] == 40302

    async def test_unknown_permission_defaults_minus_one(self, db_session):
        """未知 permission → 默认 -1 → 权限不足"""
        r1 = MagicMock()
        r1.scalar_one_or_none.return_value = None
        rel = MagicMock()
        rel.viewer_user_id = "x1"
        rel.baby_id = "baby-1"
        rel.permission = "unknown_role"
        r2 = MagicMock()
        r2.scalar_one_or_none.return_value = rel
        db_session.execute.side_effect = [r1, r2]

        with pytest.raises(HTTPException) as e:
            await self._call_check("baby-1", "x1", db_session)
        assert e.value.status_code == 403
        assert e.value.detail["code"] == 40302