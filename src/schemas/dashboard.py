import uuid
from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from src.schemas.holding import HoldingResponse


class DashboardSummary(BaseModel):
    total_valuation: Decimal = Decimal("0")
    total_invested: Decimal = Decimal("0")
    total_pnl: Decimal = Decimal("0")
    total_return_rate: Decimal = Decimal("0.00")
    color_code: str = "#666666"
    base_date: str = ""
    is_today_close: bool = False
    disclaimer: str = "본 서비스는 투자 정보 제공 도구이며 투자자문·매매 권유가 아닙니다. 분배금 미반영 가격수익률 기준."


class DashboardGroupItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    group_id: str
    name: str
    account_type: str
    color: str
    sort_order: int
    valuation_amount: Decimal = Decimal("0")
    invested_amount: Decimal = Decimal("0")
    pnl: Decimal = Decimal("0")
    return_rate: Decimal = Decimal("0.00")
    weight_percent: Decimal = Decimal("0.00")
    color_code: str = "#666666"
    holdings: list[HoldingResponse] = []


class DashboardResponse(BaseModel):
    summary: DashboardSummary
    groups: list[DashboardGroupItem]
    all_holdings: list[HoldingResponse]
