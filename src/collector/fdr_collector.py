import asyncio
from datetime import date, datetime
from decimal import Decimal
import logging
from typing import Any

from src.collector.base import BaseCollector

logger = logging.getLogger(__name__)


class FDRCollector(BaseCollector):
    name: str = "FinanceDataReader"

    def _fetch_all_sync(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        import FinanceDataReader as fdr

        df = fdr.StockListing("ETF/KR")
        if df is None or df.empty:
            return [], []

        today = date.today()
        master_list = []
        price_list = []

        for _, row in df.iterrows():
            ticker = str(row.get("Symbol", "")).zfill(6)
            name = str(row.get("Name", "")).strip()
            if not ticker or not name:
                continue

            # Parse numeric fields safely
            raw_price = row.get("Price", 0)
            raw_change_won = row.get("Change", 0)
            raw_change_rate = row.get("ChangeRate", 0)
            raw_vol = row.get("Volume", 0)
            raw_marcap = row.get("MarCap", 0)
            category = row.get("Category")

            try:
                close_price = Decimal(str(raw_price))
            except Exception:
                close_price = Decimal("0")

            try:
                change_diff = Decimal(str(raw_change_won))
                prev_close = close_price - change_diff if close_price > 0 else None
            except Exception:
                prev_close = None

            try:
                change_rate = Decimal(str(raw_change_rate)) / Decimal("100")
            except Exception:
                change_rate = Decimal("0")

            try:
                vol = int(raw_vol) if raw_vol else 0
            except Exception:
                vol = 0

            try:
                # FDR MarCap is typically in 100 million KRW (억원)
                aum = int(Decimal(str(raw_marcap)) * Decimal("100000000")) if raw_marcap else None
            except Exception:
                aum = None

            master_list.append({
                "ticker": ticker,
                "name_kr": name,
                "name_en": None,
                "issuer": self._infer_issuer(name),
                "index_name": None,
                "expense_ratio": None,
                "aum": aum,
                "asset_class": str(category) if category else None,
                "listed_at": None,
                "status": "ACTIVE",
            })

            if close_price > 0:
                price_list.append({
                    "ticker": ticker,
                    "base_date": today,
                    "close_price": close_price,
                    "prev_close": prev_close,
                    "change_rate": change_rate,
                    "volume": vol,
                })

        return master_list, price_list

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
            masters, _ = await asyncio.to_thread(self._fetch_all_sync)
            return masters
        except Exception as e:
            logger.warning(f"FDRCollector master fetch failed: {e}")
            return []

    async def fetch_daily_prices(self) -> list[dict[str, Any]]:
        try:
            _, prices = await asyncio.to_thread(self._fetch_all_sync)
            return prices
        except Exception as e:
            logger.warning(f"FDRCollector price fetch failed: {e}")
            return []
