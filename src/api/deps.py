import uuid
from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models import User

DEFAULT_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


async def get_current_user_id(
    x_user_id: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    """
    Get current user ID from X-User-Id header or default to single-user local UUID.
    Ensures user record exists in PostgreSQL 'etf_portfolio' DB.
    """
    if x_user_id:
        try:
            target_id = uuid.UUID(x_user_id)
        except ValueError:
            target_id = DEFAULT_USER_ID
    else:
        target_id = DEFAULT_USER_ID

    # Ensure user exists in database
    result = await db.execute(select(User).where(User.user_id == target_id))
    user = result.scalars().first()
    if not user:
        user = User(user_id=target_id, device_id="local_user")
        db.add(user)
        await db.commit()

    return target_id
