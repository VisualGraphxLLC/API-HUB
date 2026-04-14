from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.ps_directory.client import get_ps_endpoints

from .models import Supplier


async def get_cached_endpoints(db: AsyncSession, supplier_id) -> list[dict]:
    """Return cached PS endpoints, refreshing if older than 24 hours."""
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier or not supplier.promostandards_code:
        return []

    # Check cache freshness
    if supplier.endpoint_cache and supplier.endpoint_cache_updated_at:
        age = datetime.now(timezone.utc) - supplier.endpoint_cache_updated_at
        if age < timedelta(hours=24):
            return supplier.endpoint_cache

    # Refresh from PS directory API
    endpoints = await get_ps_endpoints(supplier.promostandards_code)
    supplier.endpoint_cache = endpoints
    supplier.endpoint_cache_updated_at = datetime.now(timezone.utc)
    await db.commit()
    return endpoints
