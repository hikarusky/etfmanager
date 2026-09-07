from datetime import date
from decimal import Decimal
import logging
from typing import Any
import httpx

from src.collector.base import BaseCollector

logger = logging.getLogger(__name__)

NAVER_ETF_API_URL = "https://finance.naver.com/api/sise/etfItemList.nhn"


class NaverFinanceCollector(BaseCollector):
    name: str = "NaverFinance"

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

    async def _fetch_data(self) -> list[dict[str, Any]]:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Referer": "https://finance.naver.com/sise/etf.naver",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(NAVER_ETF_API_URL, headers=headers)
            response.raise_for_status()
            data = response.json()

        if data.get("resultCode") != "success":
            return []

        return data.get("result", {}).get("etfItemList", [])

    async def fetch_etf_master(self) -> list[dict[str, Any]]:
        try:
            items = await self._fetch_data()
            results = []
            for it in items:
                ticker = str(it.get("itemcode", "")).zfill(6)
                name = str(it.get("itemname", "")).strip()
                if not ticker or not name:
                    continue

                raw_market_sum = it.get("marketSum", 0)
                try:
                    # Naver marketSum is in 억원 (100,000,000 KRW)
                    aum = int(Decimal(str(raw_market_sum)) * Decimal("100000000")) if raw_market_sum else None
                except Exception:
                    aum = None

                results.append({
                    "ticker": ticker,
                    "name_kr": name,
                    "name_en": None,
                    "issuer": self._infer_issuer(name),
                    "index_name": None,
                    "expense_ratio": None,
                    "aum": aum,
                    "asset_class": None,
                    "listed_at": None,
                    "status": "ACTIVE",
                })
            return results
        except Exception as e:
            logger.warning(f"NaverFinanceCollector master fetch failed: {e}")
            return []

    async def fetch_daily_prices(self) -> list[dict[str, Any]]:
        try:
            items = await self._fetch_data()
            today = date.today()
            results = []
            for it in items:
                ticker = str(it.get("itemcode", "")).zfill(6)
                if not ticker:
                    continue

                raw_val = it.get("nowVal", 0)
                raw_change_rate = it.get("changeRate", 0)
                raw_quant = it.get("quant", 0)

                try:
                    close_p = Decimal(str(raw_val))
                except Exception:
                    close_p = Decimal("0")

                if close_p <= 0:
                    continue

                try:
                    change_r = Decimal(str(raw_change_rate)) / Decimal("100")
                except Exception:
                    change_r = Decimal("0")

                try:
                    vol = int(raw_quant)
                except Exception:
                    vol = 0

                results.append({
                    "ticker": ticker,
                    "base_date": today,
                    "close_price": close_p,
                    "prev_close": None,
                    "change_rate": change_r,
                    "volume": vol,
                })
            return results
        except Exception as e:
            logger.warning(f"NaverFinanceCollector price fetch failed: {e}")
            return []
