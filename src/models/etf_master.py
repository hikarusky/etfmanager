from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING
from sqlalchemy import BigInteger, Date, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base

if TYPE_CHECKING:
    from src.models.holding import Holding
    from src.models.price_daily import ETFPriceDaily


class ETFMaster(Base):
    __tablename__ = "etf_master"

    ticker: Mapped[str] = mapped_column(
        String(6),
        primary_key=True,
        doc="6-digit KRX stock ticker code",
    )
    name_kr: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        doc="Korean ETF name",
    )
    name_en: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
        doc="English ETF name",
    )
    name_chosung: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        doc="Extracted Korean initial consonants (초성)",
    )
    issuer: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        doc="Asset management company (e.g. 삼성자산운용)",
    )
    index_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        doc="Underlying benchmark index name",
    )
    expense_ratio: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 6),
        nullable=True,
        doc="Total annual expense ratio (%)",
    )
    aum: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
        doc="Assets under management in KRW (순자산총액)",
    )
    asset_class: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        doc="Asset class (주식, 채권, 원자재 등)",
    )
    listed_at: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        doc="Date listed on KRX",
    )
    delisted_at: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        doc="Date delisted if applicable",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="ACTIVE",
        nullable=False,
        doc="Trading status: ACTIVE, HALT, DELISTED",
    )

    # Relationships
    prices: Mapped[list["ETFPriceDaily"]] = relationship(
        "ETFPriceDaily",
        back_populates="etf",
        cascade="all, delete-orphan",
    )
    holdings: Mapped[list["Holding"]] = relationship(
        "Holding",
        back_populates="etf",
    )
