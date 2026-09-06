from abc import ABC, abstractmethod
from typing import Any


class BaseCollector(ABC):
    """Abstract interface for ETF market data collectors."""

    name: str = "BaseCollector"

    @abstractmethod
    async def fetch_etf_master(self) -> list[dict[str, Any]]:
        """
        Fetch KRX ETF master list.
        Each item should contain:
        - ticker: str (6 digits)
        - name_kr: str
        - name_en: str | None
        - issuer: str | None
        - index_name: str | None
        - expense_ratio: Decimal | float | None
        - aum: int | None
        - asset_class: str | None
        - listed_at: date | None
        - status: str ("ACTIVE")
        """
        pass

    @abstractmethod
    async def fetch_daily_prices(self) -> list[dict[str, Any]]:
        """
        Fetch latest daily closing prices.
        Each item should contain:
        - ticker: str (6 digits)
        - base_date: date
        - close_price: Decimal | float
        - prev_close: Decimal | float | None
        - change_rate: Decimal | float | None
        - volume: int | None
        """
        pass
