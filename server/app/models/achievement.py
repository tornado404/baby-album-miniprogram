"""成就模型"""

import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, UniqueConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    badge_key: Mapped[str] = mapped_column(String(32))
    awarded_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    user = relationship("User", back_populates="achievements")

    __table_args__ = (
        UniqueConstraint(
            "user_id", "badge_key", name="uq_user_badge"
        ),
    )