"""媒体模型"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    String, Integer, BigInteger, Boolean, DateTime, Float,
    ForeignKey, Index, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MediaType(str, enum.Enum):
    image = "image"
    video = "video"
    threedmodel = "threedmodel"


class Media(Base):
    __tablename__ = "media"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    baby_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("babies.id"), index=True
    )
    type: Mapped[MediaType] = mapped_column(
        SAEnum(MediaType, create_constraint=True)
    )
    title: Mapped[str] = mapped_column(String(200), default="")
    cos_key: Mapped[str] = mapped_column(String(500))
    cos_url: Mapped[str | None] = mapped_column(String(1000))
    thumbnail_key: Mapped[str | None] = mapped_column(String(500))
    thumbnail_url: Mapped[str | None] = mapped_column(String(1000))
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    file_size: Mapped[int | None] = mapped_column(BigInteger, default=0)
    mime_type: Mapped[str | None] = mapped_column(String(50))
    capture_date: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD
    baby_age_yrs: Mapped[int | None] = mapped_column(Integer)
    baby_age_mos: Mapped[int | None] = mapped_column(Integer)
    baby_age_days: Mapped[int | None] = mapped_column(Integer)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)

    # v2.0 extended fields
    location_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    moment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    milestone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = relationship("User", back_populates="media")
    baby = relationship("Baby", back_populates="media")

    __table_args__ = (
        Index("idx_media_baby_capture", "baby_id", "capture_date"),
    )