import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user_id
from src.core.database import get_db
from src.core.exceptions import EntityNotFoundException
from src.schemas.holding import (
    HoldingCreateRequest,
    HoldingResponse,
    HoldingUpdateRequest,
)
from src.services.holding_service import holding_service

router = APIRouter(prefix="/holdings", tags=["Holdings"])


@router.post("", response_model=HoldingResponse, status_code=status.HTTP_201_CREATED)
async def create_or_merge_holding(
    data: HoldingCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    ETF 보유 등록 및 분할 매수 시 가중평균 평단가 자동 병합 (PRD F-02).
    동일 계좌 그룹에 동일 종목 매수 시 평단가가 자동 재계산되고 거래 이력이 기록됩니다.
    """
    try:
        holding = await holding_service.create_or_merge_holding(
            db, user_id=user_id, data=data
        )
        enriched = await holding_service.enrich_holding_response(db, holding)
        return enriched
    except EntityNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.get("/{holding_id}", response_model=HoldingResponse)
async def get_holding(
    holding_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """보유 종목 상세 및 거래 이력 조회 (PRD F-03)."""
    try:
        holding = await holding_service.get_holding(db, user_id=user_id, holding_id=holding_id)
        enriched = await holding_service.enrich_holding_response(db, holding)
        return enriched
    except EntityNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.patch("/{holding_id}", response_model=HoldingResponse)
async def update_holding(
    holding_id: uuid.UUID,
    data: HoldingUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """보유 수량, 평단가, 메모 수정 또는 타 그룹 이동 (PRD F-02, F-05)."""
    try:
        holding = await holding_service.update_holding(
            db, user_id=user_id, holding_id=holding_id, data=data
        )
        enriched = await holding_service.enrich_holding_response(db, holding)
        return enriched
    except EntityNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.delete("/{holding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_holding(
    holding_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """보유 종목 삭제 (거래 이력 함께 삭제)."""
    try:
        await holding_service.delete_holding(
            db, user_id=user_id, holding_id=holding_id
        )
    except EntityNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)
