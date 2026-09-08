import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base

if TYPE_CHECKING:
    from src.models.holding import Holding


class Transaction(Base):
    __tablename__ = "transaction"

    tx_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    holding_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("holding.holding_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tx_type: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="BUY",
        doc="Transaction type: BUY or SELL",
    )
    price: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        doc="Executed trade price (체결 단가)",
    )
    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="Executed quantity (체결 수량)",
    )
    traded_at: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        doc="Trade date (매매일자)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    holding: Mapped["Holding"] = relationship(
        "Holding",
        back_populates="transactions",
    )
