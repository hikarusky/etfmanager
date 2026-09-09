from datetime import date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class ETFListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ticker: str
    name_kr: str
    issuer: str | None = None
    close_price: Decimal = Decimal("0")
    change_rate: Decimal = Decimal("0")
    volume: int = 0
    aum: int | None = None
    base_date: date | None = None


class ETFDetailResponse(ETFListItemResponse):
    name_en: str | None = None
    name_chosung: str | None = None
    index_name: str | None = None
    expense_ratio: Decimal | None = None
    asset_class: str | None = None
    listed_at: date | None = None
    status: str = "ACTIVE"
