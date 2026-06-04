"""共享模型"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SharePermission(str, enum.Enum):
    viewer = "viewer"
    editor = "editor"


class InvitationStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    expired = "expired"


class ShareInvitation(Base):
    __tablename__ = "share_invitations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    from_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id")
    )
    baby_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("babies.id")
    )
    token: Mapped[str] = mapped_column(
        String(64), unique=True, index=True
    )
    permission: Mapped[SharePermission] = mapped_column(
        String(10), default=SharePermission.viewer.value
    )
    status: Mapped[InvitationStatus] = mapped_column(
        String(10), default=InvitationStatus.pending.value
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    __table_args__ = (
        Index("idx_share_invite_token", "token"),
    )


class ShareRelation(Base):
    __tablename__ = "share_relations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    owner_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id")
    )
    viewer_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id")
    )
    baby_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("babies.id")
    )
    permission: Mapped[SharePermission] = mapped_column(
        String(10), default=SharePermission.viewer.value
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    __table_args__ = (
        UniqueConstraint("baby_id", "viewer_user_id", name="uq_share_relation"),
    )