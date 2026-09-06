from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.collector.manager import CollectorManager
from src.core.database import get_db
from src.schemas.etf import ETFDetailResponse, ETFListItemResponse
from src.services.search_service import search_service

router = APIRouter(prefix="/etfs", tags=["ETFs"])


@router.get("/search", response_model=list[ETFListItemResponse])
async def search_etfs(
    q: str = Query(..., min_length=1, description="종목명, 티커 6자리 또는 한글 초성 (예: ㅋㄷㅅ, 069500, KODEX)"),
    limit: int = Query(20, ge=1, le=100, description="최대 반환 건수 (기본 20)"),
    db: AsyncSession = Depends(get_db),
):
    """
    KRX 상장 ETF 고속 검색 API (PRD F-01).
    정렬 우선순위:
    1. 6자리 종목코드 완전일치
    2. 종목명 완전일치
    3. 종목명 접두일치
    4. 초성 일치 (예: ㅋㄷㅅ -> KODEX, ㅌㅇㄱ -> TIGER)
    5. AUM(순자산총액) 내림차순
    """
    results = await search_service.search(db, query=q, limit=limit)
    return results


@router.get("/{ticker}", response_model=ETFDetailResponse)
async def get_etf_detail(
    ticker: str,
    db: AsyncSession = Depends(get_db),
):
    """ETF 상세 정보 및 미리보기 데이터 조회 API (PRD F-01)."""
    detail = await search_service.get_etf_detail(db, ticker=ticker)
    if not detail:
        raise HTTPException(status_code=404, detail=f"ETF ticker '{ticker}' not found.")
    return detail


@router.post("/sync")
async def trigger_etf_sync(
    db: AsyncSession = Depends(get_db),
):
    """수동 시세/마스터 수집 파이프라인 실행 API."""
    manager = CollectorManager()
    m_src, masters = await manager.collect_master()
    if masters:
        await manager.save_master_to_db(db, masters)

    p_src, prices = await manager.collect_prices()
    if prices:
        await manager.save_prices_to_db(db, prices)

    search_service.clear_cache()
    return {
        "status": "success",
        "master_source": m_src,
        "master_count": len(masters),
        "price_source": p_src,
        "price_count": len(prices),
    }
