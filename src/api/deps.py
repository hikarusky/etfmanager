import uuid
from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models import User

DEFAULT_USER_ID = "hikarusky"


def resolve_user_uuid(input_val: str | None) -> str:
    """
    Convert an input string (UUID, custom string, or None) to a valid user_id.
    If None, empty, or DEFAULT_USER_ID, returns DEFAULT_USER_ID ('hikarusky').
    """
    if not input_val or not input_val.strip() or input_val.strip() in (DEFAULT_USER_ID, "88ba0ed8-3940-4f81-b21b-31b1984d0f12"):
        return DEFAULT_USER_ID

    cleaned = input_val.strip()
    try:
        return str(uuid.UUID(cleaned))
    except ValueError:
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, cleaned))


async def get_current_user_id(
    x_user_id: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> str:
    """
    Get current user ID from X-User-Id header or default to primary user ('hikarusky').
    Never auto-creates random new UUID users on normal/default sessions.
    """
    target_id = resolve_user_uuid(x_user_id)

    # If primary user ('hikarusky'), return directly without DB writes
    if target_id == DEFAULT_USER_ID:
        return DEFAULT_USER_ID

    # Only ensure record exists if an explicit non-default user ID was requested (e.g. tests)
    result = await db.execute(select(User).where(User.user_id == target_id))
    user = result.scalars().first()
    if not user:
        user = User(user_id=target_id, device_id="custom_user")
        db.add(user)
        await db.commit()

    return target_id
