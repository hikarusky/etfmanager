import uuid
from datetime import date
from decimal import Decimal
from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import EntityNotFoundException
from src.models import ETFMaster, ETFPriceDaily, Holding, PortfolioGroup, Transaction
from src.schemas.holding import HoldingCreateRequest, HoldingUpdateRequest
from src.services.portfolio_calc import (
    calculate_holding_metrics,
    calculate_weighted_average_price,
)


class HoldingService:
    async def create_or_merge_holding(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        data: HoldingCreateRequest,
    ) -> Holding:
        """
        PRD F-02: 매수 정보 저장 및 동일 그룹 내 동일 종목 평단가 자동 병합.
        """
        # 1. Verify ETF Master exists
        ticker_clean = data.ticker.strip().zfill(6)
        etf_stmt = select(ETFMaster).where(ETFMaster.ticker == ticker_clean)
        etf = (await session.execute(etf_stmt)).scalars().first()
        if not etf:
            raise EntityNotFoundException(f"ETF ticker '{ticker_clean}' not found.")

        # 2. Verify Group belongs to user
        group_stmt = select(PortfolioGroup).where(
            PortfolioGroup.group_id == data.group_id,
            PortfolioGroup.user_id == user_id,
        )
        group = (await session.execute(group_stmt)).scalars().first()
        if not group:
            raise EntityNotFoundException(f"Group '{data.group_id}' not found.")

        trade_date = data.traded_at or date.today()

        # 3. Check existing holding in same group
        holding_stmt = (
            select(Holding)
            .where(
                Holding.user_id == user_id,
                Holding.group_id == data.group_id,
                Holding.ticker == ticker_clean,
            )
            .options(selectinload(Holding.transactions))
        )
        existing_holding = (await session.execute(holding_stmt)).scalars().first()

        if existing_holding:
            # PRD F-02: 가중평균 평단가 병합
            new_avg = calculate_weighted_average_price(
                current_avg_price=existing_holding.avg_price,
                current_quantity=existing_holding.quantity,
                new_price=data.price,
                new_quantity=data.quantity,
            )
            existing_holding.avg_price = new_avg
            existing_holding.quantity += data.quantity
            if data.memo is not None:
                existing_holding.memo = data.memo

            target_id = existing_holding.holding_id
            tx = Transaction(
                holding_id=target_id,
                tx_type="BUY",
                price=data.price,
                quantity=data.quantity,
                traded_at=trade_date,
            )
            session.add(tx)
            await session.commit()
            return await self.get_holding(session, user_id, target_id)
        else:
            # Query current max sort_order in target group
            max_order_stmt = select(func.coalesce(func.max(Holding.sort_order), -1)).where(
                Holding.user_id == user_id,
                Holding.group_id == data.group_id,
            )
            max_order = (await session.execute(max_order_stmt)).scalar() or 0

            # New holding
            holding = Holding(
                user_id=user_id,
                group_id=data.group_id,
                ticker=ticker_clean,
                avg_price=Decimal(str(data.price)),
                quantity=data.quantity,
                sort_order=max_order + 1,
                memo=data.memo,
            )
            session.add(holding)
            await session.flush()

            target_id = holding.holding_id
            tx = Transaction(
                holding_id=target_id,
                tx_type="BUY",
                price=data.price,
                quantity=data.quantity,
                traded_at=trade_date,
            )
            session.add(tx)
            await session.commit()
            return await self.get_holding(session, user_id, target_id)

    async def get_holding(
        self, session: AsyncSession, user_id: uuid.UUID, holding_id: uuid.UUID
    ) -> Holding:
        stmt = (
            select(Holding)
            .where(Holding.holding_id == holding_id, Holding.user_id == user_id)
            .options(
                selectinload(Holding.group),
                selectinload(Holding.etf),
                selectinload(Holding.transactions),
            )
            .execution_options(populate_existing=True)
        )
        holding = (await session.execute(stmt)).scalars().first()
        if not holding:
            raise EntityNotFoundException(f"Holding '{holding_id}' not found.")
        return holding

    async def update_holding(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        holding_id: uuid.UUID,
        data: HoldingUpdateRequest,
    ) -> Holding:
        holding = await self.get_holding(session, user_id, holding_id)

        if data.avg_price is not None:
            holding.avg_price = data.avg_price
        if data.quantity is not None:
            holding.quantity = data.quantity
        if data.sort_order is not None:
            holding.sort_order = data.sort_order
        if data.memo is not None:
            holding.memo = data.memo
        if data.group_id is not None and data.group_id != holding.group_id:
            # Verify new group
            group_stmt = select(PortfolioGroup).where(
                PortfolioGroup.group_id == data.group_id,
                PortfolioGroup.user_id == user_id,
            )
            group = (await session.execute(group_stmt)).scalars().first()
            if not group:
                raise EntityNotFoundException(f"Target group '{data.group_id}' not found.")
            holding.group_id = data.group_id

        target_id = holding.holding_id
        await session.commit()
        return await self.get_holding(session, user_id, target_id)

    async def reorder_holdings(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        holding_ids: list[str],
        group_id: str | None = None,
    ) -> int:
        """Update display sort_order for user holdings according to the provided list order."""
        for idx, hid in enumerate(holding_ids):
            stmt = (
                update(Holding)
                .where(Holding.holding_id == hid, Holding.user_id == user_id)
                .values(sort_order=idx)
            )
            await session.execute(stmt)
        await session.commit()
        return len(holding_ids)

    async def delete_holding(
        self, session: AsyncSession, user_id: uuid.UUID, holding_id: uuid.UUID
    ) -> bool:
        holding = await self.get_holding(session, user_id, holding_id)
        await session.delete(holding)
        await session.commit()
        return True

    async def enrich_holding_response(
        self, session: AsyncSession, holding: Holding
    ) -> dict:
        """Calculate metrics and return serializable dict."""
        # Query latest price
        price_stmt = (
            select(ETFPriceDaily)
            .where(ETFPriceDaily.ticker == holding.ticker)
            .order_by(desc(ETFPriceDaily.base_date))
            .limit(1)
        )
        price_row = (await session.execute(price_stmt)).scalars().first()
        close_price = price_row.close_price if price_row else holding.avg_price
        change_rate = price_row.change_rate if price_row else Decimal("0")

        metrics = calculate_holding_metrics(
            avg_price=holding.avg_price,
            quantity=holding.quantity,
            close_price=close_price,
        )

        return {
            "holding_id": holding.holding_id,
            "user_id": holding.user_id,
            "group_id": holding.group_id,
            "group_name": holding.group.name if holding.group else None,
            "group_color": holding.group.color if holding.group else None,
            "ticker": holding.ticker,
            "name_kr": holding.etf.name_kr if holding.etf else holding.ticker,
            "issuer": holding.etf.issuer if holding.etf else None,
            "avg_price": holding.avg_price,
            "quantity": holding.quantity,
            "sort_order": holding.sort_order,
            "memo": holding.memo,
            "close_price": close_price,
            "invested_amount": metrics["invested_amount"],
            "valuation_amount": metrics["valuation_amount"],
            "pnl": metrics["pnl"],
            "return_rate": metrics["return_rate"],
            "change_rate": change_rate,
            "color_code": metrics["color_code"],
            "created_at": holding.created_at,
            "updated_at": holding.updated_at,
            "transactions": holding.transactions or [],
        }


holding_service = HoldingService()
