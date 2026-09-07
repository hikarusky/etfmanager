from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING
from sqlalchemy import BigInteger, Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base

if TYPE_CHECKING:
    from src.models.etf_master import ETFMaster


class ETFPriceDaily(Base):
    __tablename__ = "etf_price_daily"

    ticker: Mapped[str] = mapped_column(
        String(6),
        ForeignKey("etf_master.ticker", ondelete="CASCADE"),
        primary_key=True,
    )
    base_date: Mapped[date] = mapped_column(
        Date,
        primary_key=True,
        doc="Market trading date (기준일자)",
    )
    close_price: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        doc="Closing price in KRW",
    )
    prev_close: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
        doc="Previous trading day closing price",
    )
    change_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4),
        nullable=True,
        doc="Daily change percentage (e.g. 0.0150 = +1.50%)",
    )
    volume: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
        doc="Trading volume (거래량)",
    )

    # Relationships
    etf: Mapped["ETFMaster"] = relationship(
        "ETFMaster",
        back_populates="prices",
    )
