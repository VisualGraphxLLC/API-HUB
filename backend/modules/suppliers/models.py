import uuid as uuid_mod
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from database import Base, EncryptedJSON


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[uuid_mod.UUID] = mapped_column(primary_key=True, default=uuid_mod.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    protocol: Mapped[str] = mapped_column(String(50))
    promostandards_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    base_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    auth_config: Mapped[dict] = mapped_column(EncryptedJSON, default=dict)
    endpoint_cache: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    endpoint_cache_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
