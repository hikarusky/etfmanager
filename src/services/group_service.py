import re
import uuid
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import (
    DuplicateEntityException,
    EntityNotFoundException,
    GroupDeletionConflictException,
)
from src.models import Holding, PortfolioGroup, Transaction
from src.schemas.group import GroupCreateRequest, GroupUpdateRequest

ACCOUNT_TYPE_SLUGS = {
    "연금저축": "pension",
    "IRP": "irp",
    "DC": "dc",
    "ISA": "isa",
    "일반": "general",
    "일반위탁": "general",
}


def generate_semantic_group_id(name: str, account_type: str, existing_ids: set[str]) -> str:
    """Generate a clean, semantic string group_id based on account_type and name."""
    slug = ACCOUNT_TYPE_SLUGS.get(account_type.strip(), "account")
    name_clean = re.sub(r"[^a-zA-Z0-9]+", "_", name.strip()).strip("_").lower()

    if name_clean and name_clean != slug:
        candidate = f"grp_{slug}_{name_clean}"
    else:
        candidate = f"grp_{slug}"

    if candidate not in existing_ids:
        return candidate

    idx = 1
    while f"{candidate}_{idx}" in existing_ids:
        idx += 1
    return f"{candidate}_{idx}"


class GroupService:
    async def list_groups(
        self, session: AsyncSession, user_id: uuid.UUID
    ) -> list[dict]:
        """List all groups for user ordered by sort_order with holding counts."""
        stmt = (
            select(
                PortfolioGroup,
                func.count(Holding.holding_id).label("holdings_count"),
            )
            .outerjoin(Holding, Holding.group_id == PortfolioGroup.group_id)
            .where(PortfolioGroup.user_id == user_id)
            .group_by(PortfolioGroup.group_id)
            .order_by(PortfolioGroup.sort_order.asc(), PortfolioGroup.created_at.asc())
        )
        result = await session.execute(stmt)
        rows = result.all()

        results = []
        for group, count in rows:
            results.append({
                "group_id": group.group_id,
                "user_id": group.user_id,
                "name": group.name,
                "account_type": group.account_type,
                "color": group.color,
                "sort_order": group.sort_order,
                "created_at": group.created_at,
                "holdings_count": count,
            })
        return results

    async def get_group(
        self, session: AsyncSession, user_id: uuid.UUID, group_id: str
    ) -> PortfolioGroup:
        stmt = (
            select(PortfolioGroup)
            .where(
                PortfolioGroup.group_id == str(group_id),
                PortfolioGroup.user_id == user_id,
            )
            .options(selectinload(PortfolioGroup.holdings))
            .execution_options(populate_existing=True)
        )
        result = await session.execute(stmt)
        group = result.scalars().first()
        if not group:
            raise EntityNotFoundException(f"Group '{group_id}' not found.")
        return group

    async def create_group(
        self, session: AsyncSession, user_id: uuid.UUID, data: GroupCreateRequest
    ) -> PortfolioGroup:
        # Check duplicate name for same user
        stmt = select(PortfolioGroup).where(
            PortfolioGroup.user_id == user_id,
            PortfolioGroup.name == data.name.strip(),
        )
        existing = (await session.execute(stmt)).scalars().first()
        if existing:
            raise DuplicateEntityException(f"Group with name '{data.name}' already exists.")

        # Get existing group_ids across the entire table to avoid PK collisions
        existing_ids_stmt = select(PortfolioGroup.group_id)
        existing_ids = set((await session.execute(existing_ids_stmt)).scalars().all())

        new_group_id = generate_semantic_group_id(data.name, data.account_type, existing_ids)

        group = PortfolioGroup(
            group_id=new_group_id,
            user_id=user_id,
            name=data.name.strip(),
            account_type=data.account_type,
            color=data.color,
            sort_order=data.sort_order,
        )
        session.add(group)
        await session.commit()
        await session.refresh(group)
        return group

    async def update_group(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        group_id: str,
        data: GroupUpdateRequest,
    ) -> PortfolioGroup:
        group = await self.get_group(session, user_id, group_id)

        if data.name is not None and data.name.strip() != group.name:
            stmt = select(PortfolioGroup).where(
                PortfolioGroup.user_id == user_id,
                PortfolioGroup.name == data.name.strip(),
                PortfolioGroup.group_id != group_id,
            )
            dup = (await session.execute(stmt)).scalars().first()
            if dup:
                raise DuplicateEntityException(f"Group with name '{data.name}' already exists.")
            group.name = data.name.strip()

        if data.account_type is not None:
            group.account_type = data.account_type
        if data.color is not None:
            group.color = data.color
        if data.sort_order is not None:
            group.sort_order = data.sort_order

        await session.commit()
        return await self.get_group(session, user_id, group_id)

    async def delete_group(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        group_id: str,
        delete_holdings: bool = False,
        target_group_id: str | None = None,
    ) -> bool:
        group = await self.get_group(session, user_id, group_id)

        # Check existing holdings
        stmt = select(func.count(Holding.holding_id)).where(Holding.group_id == group_id)
        count = (await session.execute(stmt)).scalar() or 0

        if count > 0:
            if target_group_id:
                # Migrate holdings to target group
                target = await self.get_group(session, user_id, target_group_id)

                # Fetch all holdings in the source group
                source_holdings_stmt = select(Holding).where(Holding.group_id == group_id)
                source_holdings = (await session.execute(source_holdings_stmt)).scalars().all()

                for sh in source_holdings:
                    # Check if target group already has this ticker
                    target_holding_stmt = select(Holding).where(
                        Holding.user_id == user_id,
                        Holding.group_id == target.group_id,
                        Holding.ticker == sh.ticker,
                    )
                    th = (await session.execute(target_holding_stmt)).scalars().first()

                    if th:
                        # Merge into target holding using weighted average price
                        from src.services.portfolio_calc import calculate_weighted_average_price
                        new_avg = calculate_weighted_average_price(
                            current_avg_price=th.avg_price,
                            current_quantity=th.quantity,
                            new_price=sh.avg_price,
                            new_quantity=sh.quantity,
                        )
                        th.avg_price = new_avg
                        th.quantity += sh.quantity

                        # Re-parent transactions to target holding
                        await session.execute(
                            update(Transaction)
                            .where(Transaction.holding_id == sh.holding_id)
                            .values(holding_id=th.holding_id)
                        )
                        # Remove duplicate holding
                        await session.delete(sh)
                    else:
                        sh.group_id = target.group_id
            elif delete_holdings:
                # Cascade will delete holdings automatically
                pass
            else:
                raise GroupDeletionConflictException(
                    "보유 종목이 존재합니다. 종목 삭제(delete_holdings=true) 또는 타 그룹 이관(target_group_id)을 선택해주세요."
                )

        await session.delete(group)
        await session.commit()
        return True


group_service = GroupService()
