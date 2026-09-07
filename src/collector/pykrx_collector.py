import asyncio
from datetime import date, datetime, timedelta
from decimal import Decimal
import logging
from typing import Any

from src.collector.base import BaseCollector

logger = logging.getLogger(__name__)


class PyKrxCollector(BaseCollector):
    name: str = "pykrx"

    def _get_latest_business_day(self) -> str:
        """Return the latest candidate business date string in YYYYMMDD."""
        dt = datetime.now()
        # If weekend, rewind to Friday
        if dt.weekday() == 5:  # Saturday
            dt = dt - timedelta(days=1)
        elif dt.weekday() == 6:  # Sunday
            dt = dt - timedelta(days=2)
        return dt.strftime("%Y%m%d")

    def _fetch_master_sync(self) -> list[dict[str, Any]]:
        from pykrx import stock

        target_date = self._get_latest_business_day()
        tickers = stock.get_etf_ticker_list(target_date)
        if not tickers:
            tickers = stock.get_etf_ticker_list()

        results = []
        for ticker in tickers:
            name = stock.get_market_ticker_name(ticker)
            if not name:
                continue

            results.append({
                "ticker": str(ticker).zfill(6),
                "name_kr": name,
                "name_en": None,
                "issuer": self._infer_issuer(name),
                "index_name": None,
                "expense_ratio": None,
                "aum": None,
                "asset_class": None,
                "listed_at": None,
                "status": "ACTIVE",
            })
        return results

    def _fetch_prices_sync(self) -> list[dict[str, Any]]:
        from pykrx import stock

        target_date = self._get_latest_business_day()
        df = stock.get_etf_ohlcv_by_ticker(target_date)
        if df is None or df.empty:
            # Fallback to general market ohlcv
            df = stock.get_market_ohlcv_by_ticker(target_date, market="ETF")

        if df is None or df.empty:
            return []

        base_d = datetime.strptime(target_date, "%Y%m%d").date()
        results = []
        for ticker_idx, row in df.iterrows():
            ticker = str(ticker_idx).zfill(6)
            close_p = Decimal(str(row.get("종가", 0)))
            if close_p <= 0:
                continue
            prev_p = Decimal(str(row.get("시가", close_p)))  # approximate if prev not directly in table
            change_r = Decimal(str(row.get("등락률", 0))) / Decimal("100")
            vol = int(row.get("거래량", 0))

            results.append({
                "ticker": ticker,
                "base_date": base_d,
                "close_price": close_p,
                "prev_close": prev_p,
                "change_rate": change_r,
                "volume": vol,
            })
        return results

    def _infer_issuer(self, name: str) -> str | None:
        name_upper = name.upper()
        if "KODEX" in name_upper or "삼성" in name:
            return "삼성자산운용"
        elif "TIGER" in name_upper or "미래에셋" in name:
            return "미래에셋자산운용"
        elif "ACE" in name_upper or "한국투자" in name:
            return "한국투자신탁운용"
        elif "KBSTAR" in name_upper or "RISE" in name_upper or "KB" in name:
            return "KB자산운용"
        elif "SOL" in name_upper or "신한" in name:
            return "신한자산운용"
        elif "ARIRANG" in name_upper or "PLUS" in name_upper or "한화" in name:
            return "한화자산운용"
        elif "KOSEF" in name_upper or "키움" in name:
            return "키움투자자산운용"
        elif "HANARO" in name_upper or "NH" in name:
            return "NH-Amundi자산운용"
        elif "TIMEFOLIO" in name_upper:
            return "타임폴리오자산운용"
        elif "WOORI" in name_upper or "WON" in name_upper or "우리" in name:
            return "우리자산운용"
        return None

    async def fetch_etf_master(self) -> list[dict[str, Any]]:
        try:
            return await asyncio.to_thread(self._fetch_master_sync)
        except Exception as e:
            logger.warning(f"PyKrxCollector master fetch failed: {e}")
            return []

    async def fetch_daily_prices(self) -> list[dict[str, Any]]:
        try:
            return await asyncio.to_thread(self._fetch_prices_sync)
        except Exception as e:
            logger.warning(f"PyKrxCollector price fetch failed: {e}")
            return []
