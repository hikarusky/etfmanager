import argparse
import asyncio
import logging
from typing import Any

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.collector.base import BaseCollector
from src.collector.fdr_collector import FDRCollector
from src.collector.naver_collector import NaverFinanceCollector
from src.collector.pykrx_collector import PyKrxCollector
from src.core.config import settings
from src.core.database import AsyncSessionLocal
from src.models import ETFMaster, ETFPriceDaily
from src.services.chosung import extract_chosung

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("CollectorManager")


class CollectorManager:
    """
    Orchestrates the hierarchical fallback collection pipeline:
    1st: PyKrxCollector
    2nd: FDRCollector
    3rd: NaverFinanceCollector
    """

    def __init__(self):
        self.collectors: list[BaseCollector] = [
            PyKrxCollector(),
            FDRCollector(),
            NaverFinanceCollector(),
        ]

    async def collect_master(self) -> tuple[str, list[dict[str, Any]]]:
        """Collect ETF master data using the fallback chain."""
        for col in self.collectors:
            logger.info(f"Attempting ETF master collection using '{col.name}'...")
            try:
                data = await col.fetch_etf_master()
                if data and len(data) > 0:
                    logger.info(f"Successfully collected {len(data)} ETF masters using '{col.name}'.")
                    return col.name, data
                else:
                    logger.warning(f"'{col.name}' returned empty master data. Falling back...")
            except Exception as e:
                logger.error(f"Error collecting with '{col.name}': {e}. Falling back...")

        logger.error("All ETF master collectors failed!")
        return "none", []

    async def collect_prices(self) -> tuple[str, list[dict[str, Any]]]:
        """Collect ETF daily prices using the fallback chain."""
        for col in self.collectors:
            logger.info(f"Attempting ETF price collection using '{col.name}'...")
            try:
                data = await col.fetch_daily_prices()
                if data and len(data) > 0:
                    logger.info(f"Successfully collected {len(data)} ETF daily prices using '{col.name}'.")
                    return col.name, data
                else:
                    logger.warning(f"'{col.name}' returned empty price data. Falling back...")
            except Exception as e:
                logger.error(f"Error collecting prices with '{col.name}': {e}. Falling back...")

        logger.error("All ETF price collectors failed!")
        return "none", []

    async def save_master_to_db(self, session: AsyncSession, masters: list[dict[str, Any]]) -> int:
        """Upsert master records into etf_master table with chosung index."""
        if not masters:
            return 0

        logger.info(f"Saving {len(masters)} ETF master records to PostgreSQL '{settings.POSTGRES_DB}'...")
        saved_count = 0

        # Process in batches of 200 for high database throughput
        batch_size = 200
        for i in range(0, len(masters), batch_size):
            batch = masters[i : i + batch_size]
            stmt_values = []
            for item in batch:
                name_kr = item["name_kr"]
                name_chosung = extract_chosung(name_kr)
                stmt_values.append({
                    "ticker": item["ticker"],
                    "name_kr": name_kr,
                    "name_en": item.get("name_en"),
                    "name_chosung": name_chosung,
                    "issuer": item.get("issuer"),
                    "index_name": item.get("index_name"),
                    "expense_ratio": item.get("expense_ratio"),
                    "aum": item.get("aum"),
                    "asset_class": item.get("asset_class"),
                    "listed_at": item.get("listed_at"),
                    "delisted_at": item.get("delisted_at"),
                    "status": item.get("status", "ACTIVE"),
                })

            stmt = pg_insert(ETFMaster).values(stmt_values)
            stmt = stmt.on_conflict_do_update(
                index_elements=[ETFMaster.ticker],
                set_={
                    "name_kr": stmt.excluded.name_kr,
                    "name_chosung": stmt.excluded.name_chosung,
                    "issuer": stmt.excluded.issuer,
                    "aum": stmt.excluded.aum,
                    "status": stmt.excluded.status,
                },
            )
            await session.execute(stmt)
            saved_count += len(batch)

        await session.commit()
        logger.info(f"Successfully upserted {saved_count} ETF master records.")
        return saved_count

    async def save_prices_to_db(self, session: AsyncSession, prices: list[dict[str, Any]]) -> int:
        """Upsert price records into etf_price_daily table."""
        if not prices:
            return 0

        logger.info(f"Saving {len(prices)} ETF daily price records to PostgreSQL '{settings.POSTGRES_DB}'...")
        saved_count = 0

        batch_size = 200
        for i in range(0, len(prices), batch_size):
            batch = prices[i : i + batch_size]
            stmt_values = []
            for item in batch:
                stmt_values.append({
                    "ticker": item["ticker"],
                    "base_date": item["base_date"],
                    "close_price": item["close_price"],
                    "prev_close": item.get("prev_close"),
                    "change_rate": item.get("change_rate"),
                    "volume": item.get("volume"),
                })

            stmt = pg_insert(ETFPriceDaily).values(stmt_values)
            stmt = stmt.on_conflict_do_update(
                index_elements=[ETFPriceDaily.ticker, ETFPriceDaily.base_date],
                set_={
                    "close_price": stmt.excluded.close_price,
                    "prev_close": stmt.excluded.prev_close,
                    "change_rate": stmt.excluded.change_rate,
                    "volume": stmt.excluded.volume,
                },
            )
            await session.execute(stmt)
            saved_count += len(batch)

        await session.commit()
        logger.info(f"Successfully upserted {saved_count} ETF price records.")
        return saved_count


async def run_initial_sync():
    """Run full initial sync of ETF masters and latest prices."""
    manager = CollectorManager()
    async with AsyncSessionLocal() as session:
        # 1. Master sync
        source_m, masters = await manager.collect_master()
        if masters:
            await manager.save_master_to_db(session, masters)

        # 2. Price sync
        source_p, prices = await manager.collect_prices()
        if prices:
            await manager.save_prices_to_db(session, prices)

    print("\n" + "=" * 60)
    print(f" Initial ETF Sync Complete!")
    print(f" Master Source: {source_m} ({len(masters)} tickers)")
    print(f" Price Source:  {source_p} ({len(prices)} tickers)")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ETF Data Collector Manager")
    parser.add_argument("--init", action="store_true", help="Run initial master and price collection")
    args = parser.parse_args()

    if args.init:
        asyncio.run(run_initial_sync())
    else:
        asyncio.run(run_initial_sync())
