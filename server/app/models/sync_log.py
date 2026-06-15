"""同步日志模型"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import String, DateTime, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SyncAction(str, enum.Enum):
    create = "create"
    update = "update"
    delete = "delete"


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    entity_type: Mapped[str] = mapped_column(String(20))
    entity_id: Mapped[str] = mapped_column(String(36))
    action: Mapped[SyncAction] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    user = relationship("User", back_populates="sync_logs")

    __table_args__ = (
        Index("idx_sync_user_time", "user_id", "created_at"),
    )