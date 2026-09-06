from fastapi import APIRouter
from src.services.scheduler import market_scheduler

router = APIRouter(prefix="/sync", tags=["Sync"])


@router.post("/prices")
async def trigger_price_sync():
    """Manually trigger ETF daily price sync and cache update."""
    result = await market_scheduler.sync_now()
    return result


@router.get("/status")
async def get_sync_status():
    """Get the current market scheduler status and last sync time."""
    return {
        "is_running": market_scheduler._is_running,
        "last_sync_status": market_scheduler.last_sync_status,
        "last_sync_time": market_scheduler.last_sync_time.isoformat() if market_scheduler.last_sync_time else None,
        "last_synced_count": market_scheduler.last_synced_count,
    }
