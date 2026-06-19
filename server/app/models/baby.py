"""宝宝模型"""

import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Integer, Date, Numeric, Boolean, DateTime, ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Baby(Base):
    __tablename__ = "babies"
    __table_args__ = (
        Index("uq_babies_user_name", "user_id", "name", unique=True,
              postgresql_where=text("is_deleted = FALSE")),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    name: Mapped[str] = mapped_column(String(50))
    gender: Mapped[str | None] = mapped_column(String(10))
    birth_date: Mapped[str | None] = mapped_column(String(10))  # YYYY-MM-DD
    weight: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    height: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    avatar: Mapped[str | None] = mapped_column(String(500))
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = relationship("User", back_populates="babies")
    media = relationship("Media", back_populates="baby")