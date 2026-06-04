"""用户模型"""

import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    open_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    union_id: Mapped[str | None] = mapped_column(String(64))
    nick_name: Mapped[str] = mapped_column(String(50), default="")
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    record_days: Mapped[int] = mapped_column(Integer, default=0)
    total_photos: Mapped[int] = mapped_column(Integer, default=0)
    total_videos: Mapped[int] = mapped_column(Integer, default=0)
    total_3d_models: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    babies = relationship("Baby", back_populates="user")
    media = relationship("Media", back_populates="user")
    achievements = relationship("Achievement", back_populates="user")
    sync_logs = relationship("SyncLog", back_populates="user")