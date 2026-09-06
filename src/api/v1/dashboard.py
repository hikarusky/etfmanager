import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user_id
from src.core.database import get_db
from src.schemas.dashboard import DashboardResponse
from src.services.dashboard_service import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    ETF 전 계좌 통합 대시보드 조회 API (PRD F-04).
    - 전체 합계: 총 평가금액, 총 매수금액, 총 평가손익, 총 수익률(%), 기준 종가 일자
    - 그룹별 소계: 계좌 유형별 평가금액, 손익, 수익률, 전체 자산 대비 비중(%)
    - 보유 종목 목록: 평단가, 수량, 종가, 평가금액, 평가손익, 수익률, 전일 대비 등락률
    """
    return await dashboard_service.get_dashboard(db, user_id=user_id)
