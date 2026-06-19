"""Permission middleware mock-based tests — call _check directly"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException


class TestRequireBabyAccess:
    @pytest.fixture
    def db(self):
        return AsyncMock()

    async def _check(self, baby_id, user_id, db, min_perm="viewer"):
        from app.middleware.permission import require_baby_access
        check_fn = require_baby_access(min_permission=min_perm)
        return await check_fn(baby_id=baby_id, user_id=user_id, db=db)

    async def test_owner(self, db):
        mock_baby = MagicMock(id="b1", user_id="u1")
        mock_result = MagicMock(scalar_one_or_none=lambda: mock_baby)
        db.execute = AsyncMock(return_value=mock_result)

        result = await self._check("b1", "u1", db)
        assert result["permission"] == "owner"

    async def test_no_access(self, db):
        mock_null = MagicMock(scalar_one_or_none=lambda: None)
        db.execute = AsyncMock(return_value=mock_null)

        with pytest.raises(HTTPException) as exc:
            await self._check("b1", "stranger", db)
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == 40301

    async def test_viewer_access(self, db):
        mock_owner = MagicMock(scalar_one_or_none=lambda: None)
        mock_relation = MagicMock(scalar_one_or_none=lambda: MagicMock(
            viewer_user_id="viewer1", baby_id="b1", permission="viewer"
        ))
        db.execute = AsyncMock(side_effect=[mock_owner, mock_relation])

        result = await self._check("b1", "viewer1", db)
        assert result["permission"] == "viewer"

    async def test_insufficient_permission(self, db):
        mock_owner = MagicMock(scalar_one_or_none=lambda: None)
        mock_relation = MagicMock(scalar_one_or_none=lambda: MagicMock(
            viewer_user_id="viewer1", baby_id="b1", permission="viewer"
        ))
        db.execute = AsyncMock(side_effect=[mock_owner, mock_relation])

        with pytest.raises(HTTPException) as exc:
            await self._check("b1", "viewer1", db, min_perm="editor")
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == 40302

    async def test_unknown_permission_level(self, db):
        mock_owner = MagicMock(scalar_one_or_none=lambda: None)
        mock_rel = MagicMock(scalar_one_or_none=lambda: MagicMock(
            viewer_user_id="x", baby_id="b1", permission="superadmin"
        ))
        db.execute = AsyncMock(side_effect=[mock_owner, mock_rel])

        with pytest.raises(HTTPException) as exc:
            await self._check("b1", "x", db)
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == 40302
