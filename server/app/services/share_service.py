"""共享服务"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models.share import ShareInvitation, ShareRelation, InvitationStatus
from datetime import datetime, timedelta
import uuid


class ShareService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def invite(self, baby_id: str, inviter_id: str, permission: str = "viewer") -> dict:
        inv = ShareInvitation(
            from_user_id=inviter_id, baby_id=baby_id,
            token=uuid.uuid4().hex,
            permission=permission,
            expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        self.db.add(inv)
        await self.db.commit()
        return {"token": inv.token, "expiresAt": inv.expires_at.isoformat()}

    async def accept(self, token: str, user_id: str) -> dict:
        r = await self.db.execute(
            select(ShareInvitation).where(
                ShareInvitation.token == token,
                ShareInvitation.status == InvitationStatus.pending.value,
            )
        )
        inv = r.scalar_one_or_none()
        if not inv:
            raise ValueError("Invalid or expired invitation")
        if inv.expires_at < datetime.utcnow():
            inv.status = InvitationStatus.expired.value
            await self.db.commit()
            raise ValueError("Invitation expired")

        rel = ShareRelation(
            owner_user_id=inv.from_user_id,
            viewer_user_id=user_id,
            baby_id=inv.baby_id,
            permission=inv.permission,
        )
        self.db.add(rel)
        inv.status = InvitationStatus.accepted.value
        await self.db.commit()
        return {"message": "Accepted", "babyId": inv.baby_id}

    async def revoke(self, relation_id: str, owner_id: str):
        r = await self.db.execute(
            select(ShareRelation).where(
                ShareRelation.id == relation_id,
                ShareRelation.owner_user_id == owner_id,
            )
        )
        rel = r.scalar_one_or_none()
        if not rel:
            raise ValueError("Relation not found")
        await self.db.delete(rel)
        await self.db.commit()