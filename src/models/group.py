import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, StringUUID

if TYPE_CHECKING:
    from src.models.holding import Holding
    from src.models.user import User


class PortfolioGroup(Base):
    __tablename__ = "portfolio_group"

    group_id: Mapped[uuid.UUID] = mapped_column(
        StringUUID,
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        StringUUID,
        ForeignKey("user.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        doc="Group name (e.g. 연금저축, IRP, ISA, 일반)",
    )
    account_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="일반",
        doc="Account classification: 연금저축, IRP, DC, ISA, 일반, 기타",
    )
    color: Mapped[str] = mapped_column(
        String(10),
        default="#4A90E2",
        nullable=False,
        doc="Color hex code for UI tags",
    )
    sort_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Display order index",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="groups",
    )
    holdings: Mapped[list["Holding"]] = relationship(
        "Holding",
        back_populates="group",
        cascade="all, delete-orphan",
    )
