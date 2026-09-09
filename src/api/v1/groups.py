import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user_id
from src.core.database import get_db
from src.core.exceptions import (
    DuplicateEntityException,
    EntityNotFoundException,
    GroupDeletionConflictException,
)
from src.schemas.group import (
    GroupCreateRequest,
    GroupResponse,
    GroupUpdateRequest,
)
from src.services.group_service import group_service

router = APIRouter(prefix="/groups", tags=["Groups"])


@router.get("", response_model=list[GroupResponse])
async def list_groups(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """사용자의 계좌 그룹 목록 및 소속 종목 수 조회 (PRD F-05)."""
    return await group_service.list_groups(db, user_id=user_id)


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    data: GroupCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """신규 계좌 그룹 생성 (PRD F-05)."""
    try:
        group = await group_service.create_group(db, user_id=user_id, data=data)
        return GroupResponse(
            group_id=group.group_id,
            user_id=group.user_id,
            name=group.name,
            account_type=group.account_type,
            color=group.color,
            sort_order=group.sort_order,
            created_at=group.created_at,
            holdings_count=0,
        )
    except DuplicateEntityException as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """단일 계좌 그룹 조회."""
    try:
        group = await group_service.get_group(db, user_id=user_id, group_id=group_id)
        return GroupResponse(
            group_id=str(group.group_id),
            user_id=str(group.user_id),
            name=group.name,
            account_type=group.account_type,
            color=group.color,
            sort_order=group.sort_order,
            created_at=group.created_at,
            holdings_count=len(group.holdings) if group.holdings else 0,
        )
    except EntityNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.patch("/{group_id}", response_model=GroupResponse)
@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: str,
    data: GroupUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """계좌 그룹 정보 수정 (이름, 색상, 정렬 순서)."""
    try:
        group = await group_service.update_group(
            db, user_id=user_id, group_id=group_id, data=data
        )
        return GroupResponse(
            group_id=str(group.group_id),
            user_id=str(group.user_id),
            name=group.name,
            account_type=group.account_type,
            color=group.color,
            sort_order=group.sort_order,
            created_at=group.created_at,
            holdings_count=len(group.holdings) if group.holdings else 0,
        )
    except EntityNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)
    except DuplicateEntityException as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: str,
    delete_holdings: bool = Query(False, description="보유 종목 함께 삭제 여부"),
    target_group_id: str | None = Query(None, description="보유 종목을 이관할 대상 그룹 ID"),
    force_delete_holdings: bool = Query(False, description="하위 호환용 파라미터"),
    transfer_to_group_id: str | None = Query(None, description="하위 호환용 파라미터"),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    계좌 그룹 삭제 (PRD F-05).
    보유 종목이 존재하는 경우 delete_holdings=true 또는 target_group_id를 반드시 지정해야 합니다.
    """
    eff_delete_holdings = delete_holdings or force_delete_holdings
    eff_target_group_id = target_group_id or transfer_to_group_id
    try:
        await group_service.delete_group(
            db,
            user_id=user_id,
            group_id=group_id,
            delete_holdings=eff_delete_holdings,
            target_group_id=eff_target_group_id,
        )
    except EntityNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)
    except GroupDeletionConflictException as e:
        raise HTTPException(status_code=409, detail=e.message)
