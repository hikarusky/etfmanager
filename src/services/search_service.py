from decimal import Decimal
import logging
import time
from typing import Any
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import ETFMaster, ETFPriceDaily
from src.services.chosung import extract_chosung, is_all_chosung, normalize_query

logger = logging.getLogger("SearchService")


class SearchService:
    def __init__(self):
        self._cached_etfs: list[dict[str, Any]] = []
        self._cache_time: float = 0.0
        self._cache_ttl: float = 300.0  # 5 minutes TTL

    async def _ensure_cache(self, session: AsyncSession) -> None:
        """Cache all active ETFs in memory with latest price for sub-millisecond search."""
        now = time.time()
        if self._cached_etfs and (now - self._cache_time < self._cache_ttl):
            return

        logger.info("Refreshing in-memory ETF search cache from PostgreSQL...")
        # Query active ETF masters
        stmt = (
            select(
                ETFMaster.ticker,
                ETFMaster.name_kr,
                ETFMaster.name_en,
                ETFMaster.name_chosung,
                ETFMaster.issuer,
                ETFMaster.index_name,
                ETFMaster.expense_ratio,
                ETFMaster.aum,
                ETFMaster.asset_class,
                ETFMaster.listed_at,
                ETFMaster.status,
            )
            .where(ETFMaster.status == "ACTIVE")
            .order_by(ETFMaster.aum.desc().nulls_last())
        )
        result = await session.execute(stmt)
        rows = result.all()

        # Query latest price for all tickers
        # Using a subquery or latest base_date
        price_stmt = (
            select(
                ETFPriceDaily.ticker,
                ETFPriceDaily.close_price,
                ETFPriceDaily.prev_close,
                ETFPriceDaily.change_rate,
                ETFPriceDaily.volume,
                ETFPriceDaily.base_date,
            )
            .distinct(ETFPriceDaily.ticker)
            .order_by(ETFPriceDaily.ticker, desc(ETFPriceDaily.base_date))
        )
        price_result = await session.execute(price_stmt)
        price_map = {row.ticker: row for row in price_result.all()}

        cached = []
        for r in rows:
            p = price_map.get(r.ticker)
            cached.append({
                "ticker": r.ticker,
                "name_kr": r.name_kr,
                "name_en": r.name_en,
                "name_chosung": r.name_chosung or extract_chosung(r.name_kr),
                "issuer": r.issuer,
                "index_name": r.index_name,
                "expense_ratio": r.expense_ratio,
                "aum": r.aum or 0,
                "asset_class": r.asset_class,
                "listed_at": r.listed_at,
                "status": r.status,
                "close_price": p.close_price if p else Decimal("0"),
                "prev_close": p.prev_close if p else None,
                "change_rate": p.change_rate if p else Decimal("0"),
                "volume": p.volume if p else 0,
                "base_date": p.base_date if p else None,
            })

        self._cached_etfs = cached
        self._cache_time = now
        logger.info(f"Loaded {len(self._cached_etfs)} ETFs into search cache.")

    def clear_cache(self) -> None:
        self._cached_etfs = []
        self._cache_time = 0.0

    async def search(
        self,
        session: AsyncSession,
        query: str,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """
        Search ETFs with PRD F-01 ranking rules:
        1. 6-digit ticker exact match (Priority 1)
        2. ETF name exact match
        3. ETF name prefix match
        4. Chosung match (e.g. ㅋㄷㅅ -> KODEX, ㅌㅇㄱ -> TIGER)
        5. AUM descending
        """
        if not query or not query.strip():
            return []

        await self._ensure_cache(session)
        q_info = normalize_query(query)
        clean_q = q_info["original"]
        clean_q_upper = clean_q.upper()
        is_chosung = q_info["is_chosung"]
        is_ticker = q_info["is_ticker"]
        variants = [v.upper() for v in q_info["expanded_terms"]]

        scored_results: list[tuple[int, int, dict[str, Any]]] = []

        for item in self._cached_etfs:
            ticker = item["ticker"]
            name_kr = item["name_kr"]
            name_kr_upper = name_kr.upper()
            chosung = item["name_chosung"]
            aum = item["aum"]

            score = 0

            # 1. 6-digit ticker exact match
            if is_ticker and ticker == clean_q:
                score = 100000

            # 2. Ticker prefix match
            elif clean_q.isdigit() and ticker.startswith(clean_q):
                score = 50000

            # 3. Name exact match
            elif name_kr_upper == clean_q_upper or any(name_kr_upper == v for v in variants):
                score = 80000

            # 4. Name prefix match
            elif name_kr_upper.startswith(clean_q_upper) or any(name_kr_upper.startswith(v) for v in variants):
                score = 60000

            # 5. Name substring match
            elif clean_q_upper in name_kr_upper or any(v in name_kr_upper for v in variants):
                score = 40000

            # 6. Chosung exact/prefix/substring match
            elif is_chosung:
                if chosung == clean_q:
                    score = 30000
                elif chosung.startswith(clean_q):
                    score = 25000
                elif clean_q in chosung:
                    score = 20000

            if score > 0:
                # Add AUM as secondary ranking signal
                scored_results.append((score, aum, item))

        # Sort: Primary by score desc, Secondary by AUM desc
        scored_results.sort(key=lambda x: (x[0], x[1]), reverse=True)

        return [item for _, _, item in scored_results[:limit]]

    async def get_etf_detail(
        self, session: AsyncSession, ticker: str
    ) -> dict[str, Any] | None:
        """Get single ETF details and preview data."""
        await self._ensure_cache(session)
        target = str(ticker).zfill(6)
        for item in self._cached_etfs:
            if item["ticker"] == target:
                return item
        return None


search_service = SearchService()
