import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class HoldingCreateRequest(BaseModel):
    ticker: str = Field(..., min_length=6, max_length=6, description="종목코드 6자리")
    group_id: str = Field(..., description="귀속될 계좌 그룹 ID")
    price: Decimal = Field(..., gt=0, description="매수가격 (원)")
    quantity: int = Field(..., ge=1, description="매수 수량 (주)")
    traded_at: date | None = Field(None, description="매수일자 (미입력 시 오늘)")
    memo: str | None = Field(None, max_length=100, description="메모")


class HoldingUpdateRequest(BaseModel):
    avg_price: Decimal | None = Field(None, gt=0, description="수정할 평단가")
    quantity: int | None = Field(None, ge=1, description="수정할 보유수량")
    group_id: str | None = Field(None, description="이동할 계좌 그룹 ID")
    sort_order: int | None = Field(None, ge=0, description="정렬 순서")
    memo: str | None = Field(None, max_length=100, description="메모")


class HoldingReorderRequest(BaseModel):
    group_id: str | None = Field(None, description="계좌 그룹 ID (선택)")
    holding_ids: list[str] = Field(..., description="새로운 순서의 보유 종목 ID 목록")


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tx_id: uuid.UUID | str
    holding_id: uuid.UUID | str
    tx_type: str
    price: Decimal
    quantity: int
    traded_at: date
    created_at: datetime


class HoldingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    holding_id: uuid.UUID | str
    user_id: uuid.UUID | str
    group_id: str
    group_name: str | None = None
    group_color: str | None = None
    ticker: str
    name_kr: str
    issuer: str | None = None
    avg_price: Decimal
    quantity: int
    sort_order: int = 0
    memo: str | None = None
    close_price: Decimal = Decimal("0")
    invested_amount: Decimal = Decimal("0")
    valuation_amount: Decimal = Decimal("0")
    pnl: Decimal = Decimal("0")
    return_rate: Decimal = Decimal("0")
    change_rate: Decimal = Decimal("0")
    color_code: str = "#666666"
    created_at: datetime
    updated_at: datetime
    transactions: list[TransactionResponse] = []
