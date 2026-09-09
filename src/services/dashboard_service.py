import uuid
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models import ETFPriceDaily, Holding, PortfolioGroup
from src.schemas.dashboard import (
    DashboardGroupItem,
    DashboardResponse,
    DashboardSummary,
)
from src.schemas.holding import HoldingResponse
from src.services.portfolio_calc import (
    calculate_holding_metrics,
    calculate_portfolio_totals,
    is_today_close_confirmed,
)


class DashboardService:
    async def get_dashboard(
        self, session: AsyncSession, user_id: uuid.UUID
    ) -> DashboardResponse:
        """
        PRD F-04: 대시보드 전체 합계, 그룹별 소계 및 종목별 상세 집계.
        """
        # 1. Fetch user groups
        group_stmt = (
            select(PortfolioGroup)
            .where(PortfolioGroup.user_id == user_id)
            .order_by(PortfolioGroup.sort_order.asc(), PortfolioGroup.created_at.asc())
        )
        groups = (await session.execute(group_stmt)).scalars().all()

        # 2. Fetch user holdings
        holding_stmt = (
            select(Holding)
            .where(Holding.user_id == user_id)
            .options(
                selectinload(Holding.group),
                selectinload(Holding.etf),
                selectinload(Holding.transactions),
            )
            .order_by(Holding.sort_order.asc(), Holding.created_at.asc())
        )
        holdings = (await session.execute(holding_stmt)).scalars().all()

        # 3. Fetch latest prices for held tickers
        held_tickers = list({h.ticker for h in holdings})
        price_map: dict[str, ETFPriceDaily] = {}
        latest_base_date = None

        if held_tickers:
            price_stmt = (
                select(ETFPriceDaily)
                .where(ETFPriceDaily.ticker.in_(held_tickers))
                .order_by(desc(ETFPriceDaily.base_date))
            )
            price_rows = (await session.execute(price_stmt)).scalars().all()
            for p in price_rows:
                if p.ticker not in price_map:
                    price_map[p.ticker] = p
                    if latest_base_date is None or p.base_date > latest_base_date:
                        latest_base_date = p.base_date

        # Format base date label (e.g. "09/04")
        if latest_base_date:
            base_date_str = latest_base_date.strftime("%m/%d")
        else:
            base_date_str = datetime.now().strftime("%m/%d")

        today_confirmed = is_today_close_confirmed()

        # 4. Compute metrics for each holding
        group_holding_map: dict[str, list[HoldingResponse]] = {
            str(g.group_id): [] for g in groups
        }
        all_holding_responses: list[HoldingResponse] = []
        all_metrics: list[dict] = []

        for h in holdings:
            p_row = price_map.get(h.ticker)
            close_price = p_row.close_price if p_row else h.avg_price
            change_rate = p_row.change_rate if p_row else Decimal("0")

            metrics = calculate_holding_metrics(
                avg_price=h.avg_price,
                quantity=h.quantity,
                close_price=close_price,
            )
            all_metrics.append(metrics)

            resp_item = HoldingResponse(
                holding_id=h.holding_id,
                user_id=h.user_id,
                group_id=h.group_id,
                group_name=h.group.name if h.group else None,
                group_color=h.group.color if h.group else None,
                ticker=h.ticker,
                name_kr=h.etf.name_kr if h.etf else h.ticker,
                issuer=h.etf.issuer if h.etf else None,
                avg_price=h.avg_price,
                quantity=h.quantity,
                sort_order=h.sort_order,
                memo=h.memo,
                close_price=close_price,
                invested_amount=metrics["invested_amount"],
                valuation_amount=metrics["valuation_amount"],
                pnl=metrics["pnl"],
                return_rate=metrics["return_rate"],
                change_rate=change_rate,
                color_code=metrics["color_code"],
                created_at=h.created_at,
                updated_at=h.updated_at,
                transactions=h.transactions or [],
            )

            all_holding_responses.append(resp_item)
            h_grp_id = str(h.group_id)
            if h_grp_id in group_holding_map:
                group_holding_map[h_grp_id].append(resp_item)

        # 5. Calculate overall portfolio totals
        totals = calculate_portfolio_totals(all_metrics)
        total_valuation = totals["total_valuation"]

        summary = DashboardSummary(
            total_valuation=totals["total_valuation"],
            total_invested=totals["total_invested"],
            total_pnl=totals["total_pnl"],
            total_return_rate=totals["total_return_rate"],
            color_code=totals["color_code"],
            base_date=base_date_str,
            is_today_close=today_confirmed,
        )

        # 6. Build group items with subtotal & asset allocation weight
        group_items: list[DashboardGroupItem] = []
        for g in groups:
            g_holdings = group_holding_map.get(str(g.group_id), [])
            g_metrics = [
                {
                    "invested_amount": it.invested_amount,
                    "valuation_amount": it.valuation_amount,
                }
                for it in g_holdings
            ]
            g_totals = calculate_portfolio_totals(g_metrics)

            # Weight against total valuation
            if total_valuation > 0:
                weight = (g_totals["total_valuation"] / total_valuation * Decimal("100")).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
            else:
                weight = Decimal("0.00")

            group_items.append(
                DashboardGroupItem(
                    group_id=g.group_id,
                    name=g.name,
                    account_type=g.account_type,
                    color=g.color,
                    sort_order=g.sort_order,
                    valuation_amount=g_totals["total_valuation"],
                    invested_amount=g_totals["total_invested"],
                    pnl=g_totals["total_pnl"],
                    return_rate=g_totals["total_return_rate"],
                    weight_percent=weight,
                    color_code=g_totals["color_code"],
                    holdings=g_holdings,
                )
            )

        return DashboardResponse(
            summary=summary,
            groups=group_items,
            all_holdings=all_holding_responses,
        )


dashboard_service = DashboardService()
