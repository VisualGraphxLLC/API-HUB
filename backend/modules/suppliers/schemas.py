from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SupplierCreate(BaseModel):
    name: str
    slug: str
    protocol: str
    promostandards_code: str | None = None
    base_url: str | None = None
    auth_config: dict = {}


class SupplierRead(BaseModel):
    id: UUID
    name: str
    slug: str
    protocol: str
    promostandards_code: str | None
    base_url: str | None
    auth_config: dict
    is_active: bool
    created_at: datetime
    product_count: int = 0

    model_config = {"from_attributes": True}
