import uuid as uuid_mod
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid_mod.UUID] = mapped_column(primary_key=True, default=uuid_mod.uuid4)
    supplier_id: Mapped[uuid_mod.UUID] = mapped_column(ForeignKey("suppliers.id"))
    supplier_sku: Mapped[str] = mapped_column(String(255))
    product_name: Mapped[str] = mapped_column(String(500))
    brand: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_type: Mapped[str] = mapped_column(String(50), default="apparel")
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_synced: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id: Mapped[uuid_mod.UUID] = mapped_column(primary_key=True, default=uuid_mod.uuid4)
    product_id: Mapped[uuid_mod.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE")
    )
    color: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sku: Mapped[str | None] = mapped_column(String(255), nullable=True)
    base_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    inventory: Mapped[int | None] = mapped_column(Integer, nullable=True)
    warehouse: Mapped[str | None] = mapped_column(String(255), nullable=True)

    product: Mapped["Product"] = relationship(back_populates="variants")
