import re
import uuid
from urllib.parse import unquote
from fastapi import Depends, Header
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models import PortfolioGroup, User

DEFAULT_USER_ID = "hikarusky"

DEFAULT_GROUP_TEMPLATES = [
    {"name": "연금저축", "account_type": "연금저축", "color": "#4A90E2", "sort_order": 1, "slug": "pension"},
    {"name": "IRP", "account_type": "IRP", "color": "#50E3C2", "sort_order": 2, "slug": "irp"},
    {"name": "DC", "account_type": "DC", "color": "#F5A623", "sort_order": 3, "slug": "dc"},
    {"name": "ISA", "account_type": "ISA", "color": "#9013FE", "sort_order": 4, "slug": "isa"},
    {"name": "일반위탁", "account_type": "일반", "color": "#7ED321", "sort_order": 5, "slug": "general"},
]


def resolve_user_id(input_val: str | None) -> str:
    """
    Convert or validate user input string into a valid user_id.
    - If empty, None, undefined/null, or DEFAULT_USER_ID -> returns DEFAULT_USER_ID ('hikarusky').
    - If valid UUID string -> returns canonical lowercase UUID string.
    - If custom string -> returns the trimmed string directly (up to 50 chars),
      allowing users to use their own memorable User ID without forced UUID hashing.
    """
    if not input_val:
        return DEFAULT_USER_ID

    cleaned = input_val.strip()
    if not cleaned or cleaned.lower() in (
        DEFAULT_USER_ID.lower(),
        "undefined",
        "null",
        "88ba0ed8-3940-4f81-b21b-31b1984d0f12",
    ):
        return DEFAULT_USER_ID

    # Check if input is a canonical UUID
    try:
        return str(uuid.UUID(cleaned))
    except ValueError:
        pass

    # Custom string ID: sanitize control characters and limit length
    cleaned = re.sub(r"[\x00-\x1f\x7f]", "", cleaned)
    if len(cleaned) > 50:
        cleaned = cleaned[:50]
    return cleaned if cleaned else DEFAULT_USER_ID


# Backward compatibility alias
resolve_user_uuid = resolve_user_id


async def create_default_groups_for_user(
    db: AsyncSession, user_id: str
) -> list[PortfolioGroup]:
    """
    Create 5 standard portfolio account groups (연금저축, IRP, DC, ISA, 일반위탁)
    for the newly registered user so they can immediately buy and hold ETFs.
    """
    existing_ids_stmt = select(PortfolioGroup.group_id)
    existing_ids = set((await db.execute(existing_ids_stmt)).scalars().all())

    created: list[PortfolioGroup] = []
    for tpl in DEFAULT_GROUP_TEMPLATES:
        safe_user = re.sub(r"[^a-zA-Z0-9]+", "_", user_id).strip("_").lower()
        base_id = f"grp_{tpl['slug']}_{safe_user}" if safe_user else f"grp_{tpl['slug']}"
        cand = base_id
        idx = 1
        while cand in existing_ids:
            cand = f"{base_id}_{idx}"
            idx += 1
        existing_ids.add(cand)

        group = PortfolioGroup(
            group_id=cand,
            user_id=user_id,
            name=tpl["name"],
            account_type=tpl["account_type"],
            color=tpl["color"],
            sort_order=tpl["sort_order"],
        )
        db.add(group)
        created.append(group)

    return created


async def ensure_user_with_default_groups(
    db: AsyncSession, user_id: str
) -> tuple[User, bool]:
    """
    Ensure the user exists in the DB. If not, creates the user record and
    seeds the 5 default account groups so the user can immediately record ETF holdings.
    Returns: (User, is_new: bool)
    """
    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalars().first()

    if user:
        # Check if user has no groups; if 0 groups, seed them to ensure usability
        g_cnt_stmt = select(func.count(PortfolioGroup.group_id)).where(PortfolioGroup.user_id == user_id)
        g_cnt = (await db.execute(g_cnt_stmt)).scalar() or 0
        if g_cnt == 0:
            await create_default_groups_for_user(db, user_id)
            await db.commit()
        return user, False

    # Create new user
    user = User(user_id=user_id, device_id="custom_user")
    db.add(user)
    await db.flush()

    # Seed 5 default account groups for immediate ETF purchase capability
    await create_default_groups_for_user(db, user_id)
    await db.commit()
    await db.refresh(user)
    return user, True


async def get_current_user_id(
    x_user_id: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> str:
    """
    Get current user ID from X-User-Id header or default to primary user ('hikarusky').
    Decodes URL-encoded headers if needed and ensures user and groups are initialized.
    """
    raw_header = x_user_id
    if raw_header:
        raw_header = unquote(raw_header)

    target_id = resolve_user_id(raw_header)

    # If primary user ('hikarusky'), return directly
    if target_id == DEFAULT_USER_ID:
        return DEFAULT_USER_ID

    # Ensure custom user and default groups exist
    await ensure_user_with_default_groups(db, target_id)
    return target_id

