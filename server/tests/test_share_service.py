"""ShareService mock-based unit tests — no conftest dependency"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta


@pytest.fixture
def db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def svc(db):
    from app.services.share_service import ShareService
    return ShareService(db)


class TestInvite:
    async def test_creates_invitation(self, svc, db):
        with patch("app.services.share_service.uuid.uuid4") as mock_uuid:
            mock_uuid.return_value.hex = "tok123"
            result = await svc.invite("b1", "u1", "viewer")
        assert result["token"] == "tok123"
        db.add.assert_called_once()
        db.commit.assert_awaited_once()

    async def test_default_permission(self, svc, db):
        with patch("app.services.share_service.uuid.uuid4") as mock_uuid:
            mock_uuid.return_value.hex = "tok456"
            result = await svc.invite("b1", "u1")
        assert result["token"] == "tok456"


class TestAccept:
    async def test_happy_path(self, svc, db):
        inv = MagicMock(token="tok1", status="pending", expires_at=datetime.utcnow() + timedelta(hours=1),
                        from_user_id="u1", baby_id="b1", permission="viewer")
        mock_result = MagicMock(scalar_one_or_none=lambda: inv)
        db.execute = AsyncMock(return_value=mock_result)

        result = await svc.accept("tok1", "u2")
        assert result["message"] == "Accepted"
        assert result["babyId"] == "b1"

    async def test_invalid_token(self, svc, db):
        mock_result = MagicMock(scalar_one_or_none=lambda: None)
        db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="Invalid or expired invitation"):
            await svc.accept("invalid", "u2")

    async def test_expired(self, svc, db):
        inv = MagicMock(token="tok_exp", status="pending", expires_at=datetime.utcnow() - timedelta(hours=1))
        mock_result = MagicMock(scalar_one_or_none=lambda: inv)
        db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="Invitation expired"):
            await svc.accept("tok_exp", "u2")


class TestRevoke:
    async def test_not_found_raises(self, svc, db):
        mock_result = MagicMock(scalar_one_or_none=lambda: None)
        db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="Relation not found"):
            await svc.revoke("nonexistent", "u1")


class TestListRelations:
    async def test_empty(self, svc, db):
        mock_result = MagicMock(scalars=lambda: MagicMock(all=lambda: []))
        db.execute = AsyncMock(return_value=mock_result)
        assert await svc.list_relations("u1") == []

    async def test_with_dates(self, svc, db):
        rel = MagicMock(id="r1", owner_user_id="u1", viewer_user_id="u2",
                        baby_id="b1", permission="viewer", created_at=datetime(2026, 1, 1))
        mock_result = MagicMock(scalars=lambda: MagicMock(all=lambda: [rel]))
        db.execute = AsyncMock(return_value=mock_result)

        result = await svc.list_relations("u1")
        assert result[0]["id"] == "r1"
        assert result[0]["createdAt"] == "2026-01-01T00:00:00"

    async def test_none_created_at(self, svc, db):
        rel = MagicMock(id="r2", owner_user_id="u1", viewer_user_id="u2",
                        baby_id="b1", permission="viewer", created_at=None)
        mock_result = MagicMock(scalars=lambda: MagicMock(all=lambda: [rel]))
        db.execute = AsyncMock(return_value=mock_result)

        result = await svc.list_relations("u1")
        assert result[0]["createdAt"] is None