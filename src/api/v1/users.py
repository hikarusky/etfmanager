import uuid
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import DEFAULT_USER_ID, get_current_user_id, resolve_user_uuid
from src.core.database import get_db
from src.models import Holding, PortfolioGroup, User

router = APIRouter(prefix="/users", tags=["Users"])


class UserItem(BaseModel):
    user_id: str
    device_id: str | None
    created_at: datetime
    group_count: int
    holding_count: int
    is_default: bool
    is_current: bool


class UserResolveRequest(BaseModel):
    input_id: str


class UserResolveResponse(BaseModel):
    resolved_user_id: str
    group_count: int
    holding_count: int
    is_new: bool


@router.get("", response_model=list[UserItem])
async def list_users(
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    List all registered users with their account and holding counts.
    Allows user to see and switch to any existing portfolio in the database.
    """
    # Query users with count of groups and holdings
    users_stmt = select(User).order_by(User.created_at.desc())
    users_result = await db.execute(users_stmt)
    users = users_result.scalars().all()

    items: list[UserItem] = []
    for u in users:
        # Group count
        g_cnt_stmt = select(func.count(PortfolioGroup.group_id)).where(PortfolioGroup.user_id == u.user_id)
        g_cnt = (await db.execute(g_cnt_stmt)).scalar() or 0

        # Holding count
        h_cnt_stmt = select(func.count(Holding.holding_id)).where(Holding.user_id == u.user_id)
        h_cnt = (await db.execute(h_cnt_stmt)).scalar() or 0

        items.append(
            UserItem(
                user_id=str(u.user_id),
                device_id=u.device_id,
                created_at=u.created_at,
                group_count=g_cnt,
                holding_count=h_cnt,
                is_default=(u.user_id == DEFAULT_USER_ID),
                is_current=(u.user_id == current_user_id),
            )
        )

    # Sort so users with holdings appear first, then by created_at
    items.sort(key=lambda x: (x.holding_count, x.group_count, x.is_default), reverse=True)
    return items


@router.get("/me", response_model=UserItem)
async def get_current_user(
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get active user info and counts.
    """
    u_stmt = select(User).where(User.user_id == current_user_id)
    u = (await db.execute(u_stmt)).scalars().first()

    g_cnt_stmt = select(func.count(PortfolioGroup.group_id)).where(PortfolioGroup.user_id == current_user_id)
    g_cnt = (await db.execute(g_cnt_stmt)).scalar() or 0

    h_cnt_stmt = select(func.count(Holding.holding_id)).where(Holding.user_id == current_user_id)
    h_cnt = (await db.execute(h_cnt_stmt)).scalar() or 0

    return UserItem(
        user_id=str(current_user_id),
        device_id=u.device_id if u else None,
        created_at=u.created_at if u else datetime.now(),
        group_count=g_cnt,
        holding_count=h_cnt,
        is_default=(current_user_id == DEFAULT_USER_ID),
        is_current=True,
    )


@router.post("/resolve", response_model=UserResolveResponse)
async def resolve_user_id_endpoint(
    req: UserResolveRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Validate or transform user input into a deterministic user_id UUID,
    and return portfolio holding information for that user.
    """
    target_id = resolve_user_uuid(req.input_id)

    # Check if user exists
    u_stmt = select(User).where(User.user_id == target_id)
    user = (await db.execute(u_stmt)).scalars().first()

    is_new = False
    if not user:
        user = User(user_id=target_id, device_id="custom_user")
        db.add(user)
        await db.commit()
        is_new = True

    g_cnt_stmt = select(func.count(PortfolioGroup.group_id)).where(PortfolioGroup.user_id == target_id)
    g_cnt = (await db.execute(g_cnt_stmt)).scalar() or 0

    h_cnt_stmt = select(func.count(Holding.holding_id)).where(Holding.user_id == target_id)
    h_cnt = (await db.execute(h_cnt_stmt)).scalar() or 0

    return UserResolveResponse(
        resolved_user_id=str(target_id),
        group_count=g_cnt,
        holding_count=h_cnt,
        is_new=is_new,
    )
