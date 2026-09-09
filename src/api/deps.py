import uuid
from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models import User

DEFAULT_USER_ID = uuid.UUID("88ba0ed8-3940-4f81-b21b-31b1984d0f12")


def resolve_user_uuid(input_val: str | None) -> uuid.UUID:
    """
    Convert an input string (UUID or custom string) to a valid UUID.
    If valid UUID format, returns it.
    If arbitrary string is provided, returns deterministic UUIDv5.
    If None or empty, returns DEFAULT_USER_ID.
    """
    if not input_val or not input_val.strip():
        return DEFAULT_USER_ID

    cleaned = input_val.strip()
    try:
        return uuid.UUID(cleaned)
    except ValueError:
        return uuid.uuid5(uuid.NAMESPACE_DNS, cleaned)


async def get_current_user_id(
    x_user_id: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    """
    Get current user ID from X-User-Id header or default to primary user UUID.
    Ensures user record exists in PostgreSQL 'etf_portfolio' DB.
    """
    target_id = resolve_user_uuid(x_user_id)

    # Ensure user exists in database
    result = await db.execute(select(User).where(User.user_id == target_id))
    user = result.scalars().first()
    if not user:
        user = User(user_id=target_id, device_id="custom_user")
        db.add(user)
        await db.commit()

    return target_id
