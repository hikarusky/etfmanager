import asyncio
from datetime import datetime
import logging
from zoneinfo import ZoneInfo
from sqlalchemy.ext.asyncio import AsyncSession

from src.collector.manager import CollectorManager
from src.core.database import AsyncSessionLocal
from src.services.search_service import search_service

logger = logging.getLogger("MarketScheduler")
KST = ZoneInfo("Asia/Seoul")


class MarketScheduler:
    def __init__(self):
        self._is_running = False
        self._task: asyncio.Task | None = None
        self.last_sync_time: datetime | None = None
        self.last_sync_status: str = "IDLE"
        self.last_synced_count: int = 0

    async def sync_now(self) -> dict:
        """Trigger an immediate price sync using the collector fallback pipeline."""
        logger.info("Starting immediate market price sync...")
        self.last_sync_status = "SYNCING"
        manager = CollectorManager()

        try:
            source, prices = await manager.collect_prices()
            if prices:
                async with AsyncSessionLocal() as session:
                    count = await manager.save_prices_to_db(session, prices)
                    self.last_synced_count = count
                    search_service.clear_cache()
                    self.last_sync_time = datetime.now(KST)
                    self.last_sync_status = "SUCCESS"
                    logger.info(f"Price sync completed. Synced {count} prices via '{source}'.")
                    return {
                        "status": "success",
                        "source": source,
                        "count": count,
                        "synced_at": self.last_sync_time.isoformat(),
                    }
            else:
                self.last_sync_status = "EMPTY"
                return {
                    "status": "empty",
                    "source": source,
                    "count": 0,
                    "message": "No price data returned from collectors",
                }
        except Exception as e:
            logger.error(f"Error during price sync: {e}", exc_info=True)
            self.last_sync_status = "FAILED"
            return {
                "status": "error",
                "message": str(e),
            }

    async def _loop(self):
        """Background loop that checks for 18:00 KST daily market close on weekdays."""
        self._is_running = True
        logger.info("Market data scheduler background loop started.")

        while self._is_running:
            try:
                now_kst = datetime.now(KST)
                is_weekday = now_kst.weekday() < 5
                is_after_close = (now_kst.hour == 18 and now_kst.minute >= 5) or (now_kst.hour > 18)

                today_str = now_kst.strftime("%Y-%m-%d")
                already_synced_today = (
                    self.last_sync_time is not None
                    and self.last_sync_time.strftime("%Y-%m-%d") == today_str
                    and self.last_sync_status == "SUCCESS"
                )

                if is_weekday and is_after_close and not already_synced_today:
                    logger.info(f"Scheduled 18:05 KST price sync triggered for {today_str}.")
                    await self.sync_now()

            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")

            await asyncio.sleep(60)

    def start(self):
        if not self._is_running:
            self._task = asyncio.create_task(self._loop())

    def stop(self):
        self._is_running = False
        if self._task:
            self._task.cancel()


market_scheduler = MarketScheduler()
