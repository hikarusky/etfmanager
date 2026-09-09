import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class GroupCreateRequest(BaseModel):
    name: str = Field(..., max_length=50, description="계좌 그룹명 (예: 연금저축, IRP, ISA 등)")
    account_type: str = Field("일반", max_length=20, description="계좌 유형 (연금저축, IRP, DC, ISA, 일반, 기타)")
    color: str = Field("#4A90E2", max_length=10, description="그룹 태그 색상 코드 (HEX)")
    sort_order: int = Field(0, description="정렬 순서")


class GroupUpdateRequest(BaseModel):
    name: str | None = Field(None, max_length=50)
    account_type: str | None = Field(None, max_length=20)
    color: str | None = Field(None, max_length=10)
    sort_order: int | None = None


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    group_id: str
    user_id: uuid.UUID | str
    name: str
    account_type: str
    color: str
    sort_order: int
    created_at: datetime
    holdings_count: int = 0
