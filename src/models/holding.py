import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base

if TYPE_CHECKING:
    from src.models.etf_master import ETFMaster
    from src.models.group import PortfolioGroup
    from src.models.transaction import Transaction
    from src.models.user import User


class Holding(Base):
    __tablename__ = "holding"
    __table_args__ = (
        UniqueConstraint("user_id", "group_id", "ticker", name="uq_user_group_ticker"),
    )

    holding_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("portfolio_group.group_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ticker: Mapped[str] = mapped_column(
        String(6),
        ForeignKey("etf_master.ticker", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    avg_price: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        doc="Weighted average purchase unit price (가중평균 평단가)",
    )
    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="Total quantity held (보유 수량)",
    )
    sort_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0",
        nullable=False,
        doc="Display order index (정렬 순서)",
    )
    memo: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        doc="Optional user memo",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="holdings",
    )
    group: Mapped["PortfolioGroup"] = relationship(
        "PortfolioGroup",
        back_populates="holdings",
    )
    etf: Mapped["ETFMaster"] = relationship(
        "ETFMaster",
        back_populates="holdings",
    )
    transactions: Mapped[list["Transaction"]] = relationship(
        "Transaction",
        back_populates="holding",
        cascade="all, delete-orphan",
    )
