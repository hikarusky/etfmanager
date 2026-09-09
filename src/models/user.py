import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, StringUUID

if TYPE_CHECKING:
    from src.models.group import PortfolioGroup
    from src.models.holding import Holding


class User(Base):
    __tablename__ = "user"

    user_id: Mapped[uuid.UUID] = mapped_column(
        StringUUID,
        primary_key=True,
        default=uuid.uuid4,
    )
    device_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    groups: Mapped[list["PortfolioGroup"]] = relationship(
        "PortfolioGroup",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    holdings: Mapped[list["Holding"]] = relationship(
        "Holding",
        back_populates="user",
        cascade="all, delete-orphan",
    )
