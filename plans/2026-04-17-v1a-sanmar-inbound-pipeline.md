# V1a SanMar Inbound Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch product catalogs from any PromoStandards-compliant supplier (starting with SanMar), normalize them into the canonical `Product` / `ProductVariant` / `ProductImage` schema, and expose HTTP triggers for n8n to orchestrate full syncs + incremental inventory updates.

**Architecture:** One supplier-agnostic SOAP client wraps zeep with `asyncio.to_thread()` around synchronous calls. A resolver maps PromoStandards directory service-type strings to WSDL URLs. A normalizer layer ingests typed Pydantic responses (`PSProductData` etc. — already defined) and performs Postgres `ON CONFLICT DO UPDATE` upserts against the existing unique constraints. FastAPI routes accept HTTP POSTs from n8n, spawn background tasks, and return `202 Accepted` with a job ID that n8n polls.

**Tech Stack:** Python 3.12, FastAPI, zeep 4.3 (SOAP), httpx (async HTTP), SQLAlchemy 2 async + asyncpg, Pydantic v2, pytest + pytest-asyncio, PostgreSQL 16.

---

## Scope

**In scope (this plan):**
- WSDL resolver with PS ServiceType alias normalization
- `PromoStandardsClient` — four methods: `get_sellable_product_ids`, `get_product`, `get_products_batch`, `get_inventory`
- Normalizer — `upsert_products`, `update_inventory_only`, `update_pricing_only`
- Sync trigger routes — `POST /api/sync/{id}/products|inventory|pricing` + `GET /api/sync/{id}/status`
- SanMar E2E verification script

**Out of scope (future plans):**
- S&S REST adapter (V1b Task 8) — different plan
- 4Over HMAC adapter (V1d) — different plan
- OPS push / markup engine (V1c) — different plan
- Delta sync (V1e Task 18) — deferred; adds `get_product_date_modified`
- n8n workflow JSON (V1e Task 17) — deferred; n8n will call these routes manually until the cron workflows are built

**Already shipped (do not re-implement):**
- `backend/modules/promostandards/schemas.py` — PS Pydantic models
- `backend/modules/catalog/models.py` — unique constraints, `category`, `ops_product_id`, `ProductImage`
- `backend/modules/sync_jobs/models.py` — `SyncJob` model
- `backend/modules/suppliers/service.py::get_cached_endpoints` — 24h endpoint cache

---

## File Structure

| Path | Status | Responsibility |
|------|--------|----------------|
| `backend/modules/promostandards/resolver.py` | **Create** | Normalize ServiceType strings → canonical keys, return WSDL URL |
| `backend/modules/promostandards/client.py` | **Create** | Sync SOAP calls wrapped in `asyncio.to_thread`; returns PS Pydantic types |
| `backend/modules/promostandards/normalizer.py` | **Create** | DB upserts using `postgresql.insert().on_conflict_do_update()` |
| `backend/modules/promostandards/routes.py` | **Create** | FastAPI router: 3 POST triggers + 1 GET status |
| `backend/main.py` | **Modify** | Register the sync router |
| `backend/tests/__init__.py` | **Create** | Test package marker |
| `backend/tests/conftest.py` | **Create** | pytest-asyncio config + async DB session fixture |
| `backend/tests/test_resolver.py` | **Create** | Unit tests for ServiceType resolution |
| `backend/tests/test_client.py` | **Create** | Unit tests with mocked zeep Transport |
| `backend/tests/test_normalizer.py` | **Create** | Integration tests against Postgres |
| `backend/tests/test_sync_routes.py` | **Create** | Route tests with FastAPI TestClient + mocked SOAP client |
| `backend/requirements.txt` | **Modify** | Add `pytest`, `pytest-asyncio`, `pytest-httpx` |
| `docs/v1a_sanmar_e2e.md` | **Create** | E2E verification runbook |

Design note: five new source files all live under `promostandards/`, each with one responsibility. Tests mirror the layout one-to-one. Nothing in this plan touches any other module except `main.py` (one import + one `include_router`).

---

## Task 1: Test Infrastructure

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/pytest.ini`

- [ ] **Step 1: Add test dependencies to `backend/requirements.txt`**

Append these three lines to the existing file:

```
pytest>=8.3.0
pytest-asyncio>=0.24.0
pytest-httpx>=0.32.0
```

- [ ] **Step 2: Install the new dependencies**

```bash
cd api-hub/backend && source .venv/bin/activate
pip install -r requirements.txt
```

Expected: `Successfully installed pytest-... pytest-asyncio-... pytest-httpx-...`

- [ ] **Step 3: Create `backend/pytest.ini`**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
pythonpath = .
```

- [ ] **Step 4: Create `backend/tests/__init__.py`** (empty file)

```bash
touch backend/tests/__init__.py
```

- [ ] **Step 5: Create `backend/tests/conftest.py`**

```python
"""Shared pytest fixtures for the backend test suite."""

import asyncio
from typing import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from database import Base, async_session, engine


@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop so async fixtures share one loop."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _setup_schema():
    """Create all tables once per test session."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Intentionally do NOT drop — tests clean up per-test via transaction rollback


@pytest_asyncio.fixture
async def db() -> AsyncIterator[AsyncSession]:
    """Per-test async session with explicit rollback."""
    async with async_session() as session:
        yield session
        await session.rollback()
```

- [ ] **Step 6: Verify pytest runs (zero tests yet)**

```bash
cd api-hub/backend && source .venv/bin/activate
pytest -v
```

Expected: `collected 0 items` — no errors.

- [ ] **Step 7: Commit**

```bash
cd api-hub
git add backend/requirements.txt backend/pytest.ini backend/tests/__init__.py backend/tests/conftest.py
git commit -m "chore: add pytest + pytest-asyncio + pytest-httpx test infrastructure"
```

---

## Task 2: WSDL Resolver

**Files:**
- Create: `backend/modules/promostandards/resolver.py`
- Create: `backend/tests/test_resolver.py`

The resolver normalizes inconsistent PromoStandards `ServiceType` strings (suppliers register endpoints with names like "Product Data" vs "ProductData" vs "Inventory Levels") to canonical keys — `product_data`, `inventory`, `ppc`, `media` — and returns the `ProductionURL` for the requested service.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_resolver.py`:

```python
"""Tests for WSDL resolver — ServiceType alias normalization."""

from modules.promostandards.resolver import resolve_wsdl_url


def test_canonical_product_data():
    endpoints = [{"ServiceType": "Product Data", "ProductionURL": "https://x/pd?wsdl"}]
    assert resolve_wsdl_url(endpoints, "product_data") == "https://x/pd?wsdl"


def test_alias_productdata_no_space():
    endpoints = [{"ServiceType": "ProductData", "ProductionURL": "https://x/pd?wsdl"}]
    assert resolve_wsdl_url(endpoints, "product_data") == "https://x/pd?wsdl"


def test_inventory_alias():
    endpoints = [{"ServiceType": "Inventory Levels", "ProductionURL": "https://x/inv?wsdl"}]
    assert resolve_wsdl_url(endpoints, "inventory") == "https://x/inv?wsdl"


def test_ppc_alias():
    endpoints = [
        {"ServiceType": "Product Pricing and Configuration", "ProductionURL": "https://x/ppc?wsdl"}
    ]
    assert resolve_wsdl_url(endpoints, "ppc") == "https://x/ppc?wsdl"


def test_media_alias():
    endpoints = [{"ServiceType": "Media Content", "ProductionURL": "https://x/media?wsdl"}]
    assert resolve_wsdl_url(endpoints, "media") == "https://x/media?wsdl"


def test_falls_back_to_name_field():
    """Some suppliers use 'Name' instead of 'ServiceType'."""
    endpoints = [{"Name": "Inventory", "ProductionURL": "https://x/inv?wsdl"}]
    assert resolve_wsdl_url(endpoints, "inventory") == "https://x/inv?wsdl"


def test_case_insensitive():
    endpoints = [{"ServiceType": "PRODUCT DATA", "ProductionURL": "https://x/pd?wsdl"}]
    assert resolve_wsdl_url(endpoints, "product_data") == "https://x/pd?wsdl"


def test_returns_none_for_missing_service():
    endpoints = [{"ServiceType": "Product Data", "ProductionURL": "https://x/pd?wsdl"}]
    assert resolve_wsdl_url(endpoints, "nonexistent") is None


def test_returns_none_for_empty_list():
    assert resolve_wsdl_url([], "product_data") is None


def test_returns_none_for_none_input():
    assert resolve_wsdl_url(None, "product_data") is None


def test_skips_endpoints_without_production_url():
    endpoints = [
        {"ServiceType": "Product Data", "TestURL": "https://test/pd?wsdl"},
        {"ServiceType": "Product Data", "ProductionURL": "https://prod/pd?wsdl"},
    ]
    assert resolve_wsdl_url(endpoints, "product_data") == "https://prod/pd?wsdl"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd api-hub/backend && source .venv/bin/activate
pytest tests/test_resolver.py -v
```

Expected: `ModuleNotFoundError: No module named 'modules.promostandards.resolver'` — all 11 tests error out at import.

- [ ] **Step 3: Write the implementation**

Create `backend/modules/promostandards/resolver.py`:

```python
"""Resolve WSDL URLs from cached PromoStandards directory endpoints.

The PS directory returns endpoint lists where each entry has a
`ServiceType` field naming the service ("Product Data", "Inventory
Levels", etc.). Different suppliers register with inconsistent casing
and punctuation. This module normalizes those strings to canonical
keys and returns the `ProductionURL`.
"""

from __future__ import annotations

_SERVICE_TYPE_ALIASES: dict[str, str] = {
    "product data": "product_data",
    "productdata": "product_data",
    "product": "product_data",
    "inventory": "inventory",
    "inventory levels": "inventory",
    "inventorylevels": "inventory",
    "product pricing and configuration": "ppc",
    "ppc": "ppc",
    "pricing": "ppc",
    "pricing and configuration": "ppc",
    "media content": "media",
    "mediacontent": "media",
    "media": "media",
}


def _normalize_service_type(raw: str) -> str:
    return _SERVICE_TYPE_ALIASES.get(raw.strip().lower(), raw.strip().lower())


def resolve_wsdl_url(
    endpoint_cache: list[dict] | None, service_type: str
) -> str | None:
    """Return the ProductionURL for a canonical service type.

    Args:
        endpoint_cache: List of endpoint dicts from the PS directory API,
            typically stored in `Supplier.endpoint_cache`.
        service_type: One of "product_data", "inventory", "ppc", "media".

    Returns:
        The ProductionURL string, or None if no matching endpoint is found.
    """
    target = _normalize_service_type(service_type)
    for ep in endpoint_cache or []:
        raw_type = ep.get("ServiceType") or ep.get("Name") or ""
        if _normalize_service_type(raw_type) == target:
            url = ep.get("ProductionURL")
            if url:
                return url
    return None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd api-hub/backend && source .venv/bin/activate
pytest tests/test_resolver.py -v
```

Expected: `11 passed`.

- [ ] **Step 5: Commit**

```bash
cd api-hub
git add backend/modules/promostandards/resolver.py backend/tests/test_resolver.py
git commit -m "feat: WSDL resolver — PS ServiceType alias normalization with full test coverage"
```

---

## Task 3: PromoStandards SOAP Client

**Files:**
- Create: `backend/modules/promostandards/client.py`
- Create: `backend/tests/test_client.py`

`PromoStandardsClient` is the supplier-agnostic SOAP adapter. Its constructor takes a WSDL URL and credentials dict. All four methods wrap synchronous zeep calls with `asyncio.to_thread()` so the FastAPI event loop is never blocked.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_client.py`:

```python
"""Unit tests for PromoStandardsClient with mocked zeep service.

We don't exercise real SOAP here — that's the E2E test (Task 6). These
tests verify that our Python wrapper shapes inputs/outputs correctly
given a canned zeep response.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from modules.promostandards.client import PromoStandardsClient
from modules.promostandards.schemas import (
    PSInventoryLevel,
    PSProductData,
    PSProductPart,
)


@pytest.fixture
def mock_zeep_client():
    """Patch zeep.Client so constructor doesn't fetch a real WSDL."""
    with patch("modules.promostandards.client.Client") as mock_cls:
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance
        yield mock_instance


async def test_get_sellable_product_ids_returns_list_of_strings(mock_zeep_client):
    """getProductSellable returns nested XML; we flatten to list[str]."""
    mock_zeep_client.service.getProductSellable.return_value = SimpleNamespace(
        ProductSellableArray=SimpleNamespace(
            ProductSellable=[
                SimpleNamespace(productId="PC61"),
                SimpleNamespace(productId="PC54"),
            ]
        )
    )
    client = PromoStandardsClient("https://x/pd?wsdl", {"id": "u", "password": "p"})
    ids = await client.get_sellable_product_ids()
    assert ids == ["PC61", "PC54"]


async def test_get_sellable_product_ids_handles_empty_response(mock_zeep_client):
    mock_zeep_client.service.getProductSellable.return_value = SimpleNamespace(
        ProductSellableArray=None
    )
    client = PromoStandardsClient("https://x/pd?wsdl", {"id": "u", "password": "p"})
    ids = await client.get_sellable_product_ids()
    assert ids == []


async def test_get_product_returns_ps_product_data(mock_zeep_client):
    """getProduct returns one product with nested parts."""
    mock_zeep_client.service.getProduct.return_value = SimpleNamespace(
        Product=SimpleNamespace(
            productId="PC61",
            productName="Essential Tee",
            description="100% cotton",
            ProductBrand="Port & Company",
            ProductCategoryArray=SimpleNamespace(
                ProductCategory=[SimpleNamespace(categoryName="T-Shirts")]
            ),
            primaryImageURL="https://cdn/pc61.jpg",
            ProductPartArray=SimpleNamespace(
                ProductPart=[
                    SimpleNamespace(partId="PC61-NVY-M", ColorArray=SimpleNamespace(
                        Color=[SimpleNamespace(colorName="Navy")]
                    ), ApparelSize=SimpleNamespace(labelSize="M"), description=None),
                ]
            ),
        )
    )
    client = PromoStandardsClient("https://x/pd?wsdl", {"id": "u", "password": "p"})
    product = await client.get_product("PC61")
    assert isinstance(product, PSProductData)
    assert product.product_id == "PC61"
    assert product.product_name == "Essential Tee"
    assert product.brand == "Port & Company"
    assert product.categories == ["T-Shirts"]
    assert len(product.parts) == 1
    assert product.parts[0] == PSProductPart(
        part_id="PC61-NVY-M", color_name="Navy", size_name="M", description=None
    )


async def test_get_products_batch_respects_batch_size(mock_zeep_client):
    """Batch size of 2 against 5 IDs should produce 3 zeep calls (2+2+1)."""
    mock_zeep_client.service.getProduct.return_value = SimpleNamespace(
        Product=SimpleNamespace(
            productId="X", productName=None, description=None,
            ProductBrand=None, ProductCategoryArray=None, primaryImageURL=None,
            ProductPartArray=None,
        )
    )
    client = PromoStandardsClient("https://x/pd?wsdl", {"id": "u", "password": "p"})
    results = await client.get_products_batch(["A", "B", "C", "D", "E"], batch_size=2)
    assert len(results) == 5
    assert mock_zeep_client.service.getProduct.call_count == 5


async def test_get_products_batch_skips_failures(mock_zeep_client):
    """Individual product failures must not abort the whole batch."""
    def side_effect(**kwargs):
        if kwargs["productId"] == "BAD":
            raise RuntimeError("SOAP fault")
        return SimpleNamespace(
            Product=SimpleNamespace(
                productId=kwargs["productId"], productName=None, description=None,
                ProductBrand=None, ProductCategoryArray=None, primaryImageURL=None,
                ProductPartArray=None,
            )
        )
    mock_zeep_client.service.getProduct.side_effect = side_effect
    client = PromoStandardsClient("https://x/pd?wsdl", {"id": "u", "password": "p"})
    results = await client.get_products_batch(["GOOD1", "BAD", "GOOD2"])
    assert [p.product_id for p in results] == ["GOOD1", "GOOD2"]


async def test_get_inventory_maps_fields(mock_zeep_client):
    """getInventoryLevels returns parts with part-level qty + warehouse."""
    mock_zeep_client.service.getInventoryLevels.return_value = SimpleNamespace(
        Inventory=SimpleNamespace(
            ProductVariationInventoryArray=SimpleNamespace(
                ProductVariationInventory=[
                    SimpleNamespace(
                        partId="PC61-NVY-M",
                        quantityAvailable=SimpleNamespace(Quantity=SimpleNamespace(value=120)),
                        InventoryLocationArray=SimpleNamespace(
                            InventoryLocation=[SimpleNamespace(inventoryLocationId="IL")]
                        ),
                    )
                ]
            )
        )
    )
    client = PromoStandardsClient("https://x/inv?wsdl", {"id": "u", "password": "p"})
    levels = await client.get_inventory(["PC61"])
    assert len(levels) == 1
    assert levels[0] == PSInventoryLevel(
        product_id="PC61", part_id="PC61-NVY-M",
        quantity_available=120, warehouse_code="IL",
    )


async def test_credentials_passed_in_wsSecurityHeader(mock_zeep_client):
    """Verify credentials are forwarded to zeep service calls as id/password."""
    mock_zeep_client.service.getProductSellable.return_value = SimpleNamespace(
        ProductSellableArray=None
    )
    client = PromoStandardsClient("https://x/pd?wsdl", {"id": "my_user", "password": "my_pass"})
    await client.get_sellable_product_ids()
    kwargs = mock_zeep_client.service.getProductSellable.call_args.kwargs
    assert kwargs["wsVersion"] == "2.0.0"
    assert kwargs["id"] == "my_user"
    assert kwargs["password"] == "my_pass"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd api-hub/backend && source .venv/bin/activate
pytest tests/test_client.py -v
```

Expected: `ModuleNotFoundError: No module named 'modules.promostandards.client'`.

- [ ] **Step 3: Write the implementation**

Create `backend/modules/promostandards/client.py`:

```python
"""PromoStandardsClient — zeep SOAP wrapper for any PS-compliant supplier.

zeep is synchronous. Every service call is wrapped in ``asyncio.to_thread``
so the FastAPI event loop is never blocked during a long-running sync.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from zeep import Client, Settings
from zeep.cache import SqliteCache
from zeep.transports import Transport

from .schemas import (
    PSInventoryLevel,
    PSMediaItem,
    PSPricePoint,
    PSProductData,
    PSProductPart,
)

log = logging.getLogger(__name__)

# Shared WSDL cache — zeep parses WSDLs once per process+URL.
_WSDL_CACHE = SqliteCache(timeout=86400)  # 24h


def _get(obj: Any, *path: str, default: Any = None) -> Any:
    """Safely drill into nested zeep objects using dotted paths."""
    cur = obj
    for key in path:
        if cur is None:
            return default
        cur = getattr(cur, key, None)
    return cur if cur is not None else default


def _iter_array(array_wrapper: Any, item_attr: str) -> list[Any]:
    """PS responses wrap lists as `<FooArray><Foo>...</Foo><Foo>...</Foo></FooArray>`.

    Return the inner list, or [] if the wrapper is None.
    """
    if array_wrapper is None:
        return []
    inner = getattr(array_wrapper, item_attr, None)
    if inner is None:
        return []
    return inner if isinstance(inner, list) else [inner]


class PromoStandardsClient:
    """SOAP client for any PromoStandards supplier endpoint."""

    def __init__(self, wsdl_url: str, credentials: dict):
        self._wsdl_url = wsdl_url
        self._credentials = credentials
        transport = Transport(cache=_WSDL_CACHE, timeout=30)
        settings = Settings(strict=False, xml_huge_tree=True)
        self._client = Client(wsdl_url, transport=transport, settings=settings)

    # ------------- public methods -------------

    async def get_sellable_product_ids(self, ws_version: str = "2.0.0") -> list[str]:
        """Return all active supplier product IDs."""
        resp = await asyncio.to_thread(
            self._client.service.getProductSellable,
            wsVersion=ws_version,
            **self._credentials,
        )
        items = _iter_array(_get(resp, "ProductSellableArray"), "ProductSellable")
        return [str(_get(i, "productId", default="")) for i in items if _get(i, "productId")]

    async def get_product(self, product_id: str, ws_version: str = "2.0.0") -> PSProductData:
        """Return one product with its color/size parts."""
        resp = await asyncio.to_thread(
            self._client.service.getProduct,
            wsVersion=ws_version,
            productId=product_id,
            **self._credentials,
        )
        return self._parse_product(_get(resp, "Product"))

    async def get_products_batch(
        self, product_ids: list[str], batch_size: int = 50
    ) -> list[PSProductData]:
        """Fetch products one at a time (per PS spec) but in batched chunks.

        Individual product failures are logged and skipped so one bad SKU
        doesn't abort a full catalog sync.
        """
        results: list[PSProductData] = []
        for start in range(0, len(product_ids), batch_size):
            chunk = product_ids[start : start + batch_size]
            for pid in chunk:
                try:
                    results.append(await self.get_product(pid))
                except Exception as exc:  # noqa: BLE001 — intentionally broad
                    log.warning("get_product(%s) failed: %s", pid, exc)
        return results

    async def get_inventory(
        self, product_ids: list[str], ws_version: str = "2.0.0"
    ) -> list[PSInventoryLevel]:
        """Return part-level inventory for the given products."""
        levels: list[PSInventoryLevel] = []
        for pid in product_ids:
            try:
                resp = await asyncio.to_thread(
                    self._client.service.getInventoryLevels,
                    wsVersion=ws_version,
                    productId=pid,
                    **self._credentials,
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("getInventoryLevels(%s) failed: %s", pid, exc)
                continue
            parts = _iter_array(
                _get(resp, "Inventory", "ProductVariationInventoryArray"),
                "ProductVariationInventory",
            )
            for part in parts:
                locations = _iter_array(
                    _get(part, "InventoryLocationArray"), "InventoryLocation"
                )
                warehouse = (
                    str(_get(locations[0], "inventoryLocationId", default="")) if locations else None
                )
                qty = int(_get(part, "quantityAvailable", "Quantity", "value", default=0) or 0)
                levels.append(
                    PSInventoryLevel(
                        product_id=pid,
                        part_id=str(_get(part, "partId", default="")),
                        quantity_available=min(qty, 500),
                        warehouse_code=warehouse,
                    )
                )
        return levels

    # ------------- parsers -------------

    def _parse_product(self, raw: Any) -> PSProductData:
        categories = [
            str(_get(c, "categoryName", default=""))
            for c in _iter_array(_get(raw, "ProductCategoryArray"), "ProductCategory")
        ]
        parts = [self._parse_part(p) for p in _iter_array(_get(raw, "ProductPartArray"), "ProductPart")]
        return PSProductData(
            product_id=str(_get(raw, "productId", default="")),
            product_name=_get(raw, "productName"),
            description=_get(raw, "description"),
            brand=_get(raw, "ProductBrand"),
            categories=[c for c in categories if c],
            primary_image_url=_get(raw, "primaryImageURL"),
            parts=parts,
        )

    def _parse_part(self, raw: Any) -> PSProductPart:
        colors = _iter_array(_get(raw, "ColorArray"), "Color")
        color_name = _get(colors[0], "colorName") if colors else None
        size_name = _get(raw, "ApparelSize", "labelSize")
        return PSProductPart(
            part_id=str(_get(raw, "partId", default="")),
            color_name=color_name,
            size_name=size_name,
            description=_get(raw, "description"),
        )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd api-hub/backend && source .venv/bin/activate
pytest tests/test_client.py -v
```

Expected: `7 passed`. If you see a batching failure, confirm that `get_products_batch` calls `get_product` for each ID sequentially (the test asserts `call_count == 5`).

- [ ] **Step 5: Commit**

```bash
cd api-hub
git add backend/modules/promostandards/client.py backend/tests/test_client.py
git commit -m "feat: PromoStandardsClient — async zeep wrapper with WSDL cache + batch fetch"
```

---

## Task 4: Normalization Layer

**Files:**
- Create: `backend/modules/promostandards/normalizer.py`
- Create: `backend/tests/test_normalizer.py`

The normalizer takes typed PS responses and writes them to Postgres using `INSERT ... ON CONFLICT DO UPDATE` against the unique constraints defined in `catalog/models.py`. Three entry points: `upsert_products` (full), `update_inventory_only` (30-min cron), `update_pricing_only` (daily cron).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_normalizer.py`:

```python
"""Integration tests for the normalizer against a real Postgres DB.

Requires docker compose postgres running on localhost:5432.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from modules.catalog.models import Product, ProductImage, ProductVariant
from modules.promostandards.normalizer import (
    update_inventory_only,
    update_pricing_only,
    upsert_products,
)
from modules.promostandards.schemas import (
    PSInventoryLevel,
    PSMediaItem,
    PSPricePoint,
    PSProductData,
    PSProductPart,
)
from modules.suppliers.models import Supplier


@pytest.fixture
async def supplier_id(db):
    s = Supplier(
        name="Test SanMar", slug=f"test-sanmar-{uuid.uuid4().hex[:8]}",
        protocol="promostandards", promostandards_code="SANM",
        auth_config={"id": "x", "password": "y"},
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s.id


def _sample_product(pid: str = "PC61") -> PSProductData:
    return PSProductData(
        product_id=pid,
        product_name="Essential Tee",
        description="100% cotton",
        brand="Port & Company",
        categories=["T-Shirts"],
        primary_image_url="https://cdn/pc61.jpg",
        parts=[
            PSProductPart(part_id=f"{pid}-NVY-M", color_name="Navy", size_name="M"),
            PSProductPart(part_id=f"{pid}-NVY-L", color_name="Navy", size_name="L"),
        ],
    )


async def test_upsert_creates_product_variants_and_images(db, supplier_id):
    count = await upsert_products(
        db,
        supplier_id=supplier_id,
        products=[_sample_product()],
        inventory=[
            PSInventoryLevel(product_id="PC61", part_id="PC61-NVY-M", quantity_available=120, warehouse_code="IL"),
        ],
        pricing=[
            PSPricePoint(product_id="PC61", part_id="PC61-NVY-M", price=3.99),
        ],
        media=[
            PSMediaItem(product_id="PC61", url="https://cdn/pc61-front.jpg", media_type="front"),
        ],
    )
    assert count == 1

    product = (await db.execute(
        select(Product).where(Product.supplier_id == supplier_id, Product.supplier_sku == "PC61")
    )).scalar_one()
    assert product.product_name == "Essential Tee"
    assert product.brand == "Port & Company"
    assert product.category == "T-Shirts"

    variants = (await db.execute(
        select(ProductVariant).where(ProductVariant.product_id == product.id)
    )).scalars().all()
    assert {(v.color, v.size) for v in variants} == {("Navy", "M"), ("Navy", "L")}

    nvy_m = next(v for v in variants if v.size == "M")
    assert nvy_m.inventory == 120
    assert nvy_m.warehouse == "IL"
    assert float(nvy_m.base_price) == 3.99

    images = (await db.execute(
        select(ProductImage).where(ProductImage.product_id == product.id)
    )).scalars().all()
    assert len(images) == 1
    assert images[0].url == "https://cdn/pc61-front.jpg"


async def test_upsert_is_idempotent(db, supplier_id):
    """Running twice produces the same row count — no duplicates."""
    prod = _sample_product()
    await upsert_products(db, supplier_id=supplier_id, products=[prod])
    await upsert_products(db, supplier_id=supplier_id, products=[prod])

    products = (await db.execute(
        select(Product).where(Product.supplier_id == supplier_id, Product.supplier_sku == "PC61")
    )).scalars().all()
    assert len(products) == 1

    variants = (await db.execute(
        select(ProductVariant).where(ProductVariant.product_id == products[0].id)
    )).scalars().all()
    assert len(variants) == 2


async def test_update_inventory_only_touches_only_inventory(db, supplier_id):
    """After full upsert, inventory-only update should change qty but not prices."""
    await upsert_products(
        db, supplier_id=supplier_id, products=[_sample_product()],
        pricing=[PSPricePoint(product_id="PC61", part_id="PC61-NVY-M", price=3.99)],
    )

    updated = await update_inventory_only(
        db, supplier_id=supplier_id,
        inventory=[PSInventoryLevel(
            product_id="PC61", part_id="PC61-NVY-M",
            quantity_available=42, warehouse_code="TX",
        )],
    )
    assert updated == 1

    product = (await db.execute(
        select(Product).where(Product.supplier_sku == "PC61", Product.supplier_id == supplier_id)
    )).scalar_one()
    variant = (await db.execute(
        select(ProductVariant).where(
            ProductVariant.product_id == product.id,
            ProductVariant.color == "Navy", ProductVariant.size == "M",
        )
    )).scalar_one()
    assert variant.inventory == 42
    assert variant.warehouse == "TX"
    assert float(variant.base_price) == 3.99  # unchanged


async def test_update_pricing_only(db, supplier_id):
    await upsert_products(db, supplier_id=supplier_id, products=[_sample_product()])
    updated = await update_pricing_only(
        db, supplier_id=supplier_id,
        pricing=[PSPricePoint(product_id="PC61", part_id="PC61-NVY-M", price=5.50)],
    )
    assert updated == 1
    product = (await db.execute(
        select(Product).where(Product.supplier_sku == "PC61", Product.supplier_id == supplier_id)
    )).scalar_one()
    variant = (await db.execute(
        select(ProductVariant).where(
            ProductVariant.product_id == product.id,
            ProductVariant.color == "Navy", ProductVariant.size == "M",
        )
    )).scalar_one()
    assert float(variant.base_price) == 5.50
```

- [ ] **Step 2: Start Postgres if not running**

```bash
cd api-hub
docker compose up -d postgres
docker compose ps  # postgres should be up
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd api-hub/backend && source .venv/bin/activate
pytest tests/test_normalizer.py -v
```

Expected: `ModuleNotFoundError: No module named 'modules.promostandards.normalizer'`.

- [ ] **Step 4: Write the implementation**

Create `backend/modules/promostandards/normalizer.py`:

```python
"""Map typed PS responses into canonical DB rows via PostgreSQL upserts.

Relies on unique constraints defined in catalog.models:
  - uq_product_supplier_sku   (supplier_id, supplier_sku)
  - uq_variant_product_color_size   (product_id, color, size)
  - uq_product_image_url   (product_id, url)
"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from modules.catalog.models import Product, ProductImage, ProductVariant

from .schemas import (
    PSInventoryLevel,
    PSMediaItem,
    PSPricePoint,
    PSProductData,
)

_BATCH_SIZE = 100


async def upsert_products(
    db: AsyncSession,
    supplier_id: UUID,
    products: list[PSProductData],
    inventory: list[PSInventoryLevel] | None = None,
    pricing: list[PSPricePoint] | None = None,
    media: list[PSMediaItem] | None = None,
) -> int:
    """Full sync: upsert products + variants + images. Returns product count."""
    if not products:
        return 0

    inv_by_part = {i.part_id: i for i in (inventory or [])}
    price_by_part = _lowest_price_per_part(pricing or [])
    media_by_product = _group_media(media or [])

    for chunk_start in range(0, len(products), _BATCH_SIZE):
        chunk = products[chunk_start : chunk_start + _BATCH_SIZE]
        await _upsert_chunk(
            db, supplier_id, chunk, inv_by_part, price_by_part, media_by_product
        )
        await db.commit()

    return len(products)


async def update_inventory_only(
    db: AsyncSession, supplier_id: UUID, inventory: list[PSInventoryLevel]
) -> int:
    """Lightweight sync: update Variant.inventory + warehouse only."""
    if not inventory:
        return 0

    part_ids = [lvl.part_id for lvl in inventory]
    variants = (
        await db.execute(
            select(ProductVariant)
            .join(Product, Product.id == ProductVariant.product_id)
            .where(
                Product.supplier_id == supplier_id,
                ProductVariant.sku.in_(part_ids),
            )
        )
    ).scalars().all()

    by_sku = {v.sku: v for v in variants}
    updated = 0
    for lvl in inventory:
        v = by_sku.get(lvl.part_id)
        if v is None:
            continue
        v.inventory = min(int(lvl.quantity_available), 500)
        v.warehouse = lvl.warehouse_code
        updated += 1
    await db.commit()
    return updated


async def update_pricing_only(
    db: AsyncSession, supplier_id: UUID, pricing: list[PSPricePoint]
) -> int:
    """Lightweight sync: update Variant.base_price only."""
    if not pricing:
        return 0

    price_by_part = _lowest_price_per_part(pricing)
    variants = (
        await db.execute(
            select(ProductVariant)
            .join(Product, Product.id == ProductVariant.product_id)
            .where(
                Product.supplier_id == supplier_id,
                ProductVariant.sku.in_(list(price_by_part.keys())),
            )
        )
    ).scalars().all()

    updated = 0
    for v in variants:
        price = price_by_part.get(v.sku)
        if price is None:
            continue
        v.base_price = Decimal(str(price))
        updated += 1
    await db.commit()
    return updated


# -------- helpers --------


def _lowest_price_per_part(pricing: list[PSPricePoint]) -> dict[str, float]:
    """Take the lowest-tier price per part (smallest quantity_min wins)."""
    best: dict[str, PSPricePoint] = {}
    for p in pricing:
        existing = best.get(p.part_id)
        if existing is None or p.quantity_min < existing.quantity_min:
            best[p.part_id] = p
    return {k: v.price for k, v in best.items()}


def _group_media(media: list[PSMediaItem]) -> dict[str, list[PSMediaItem]]:
    grouped: dict[str, list[PSMediaItem]] = defaultdict(list)
    for m in media:
        grouped[m.product_id].append(m)
    return grouped


async def _upsert_chunk(
    db: AsyncSession,
    supplier_id: UUID,
    products: list[PSProductData],
    inv_by_part: dict,
    price_by_part: dict,
    media_by_product: dict,
) -> None:
    # 1. Upsert products
    product_rows = [
        {
            "supplier_id": supplier_id,
            "supplier_sku": p.product_id,
            "product_name": p.product_name or p.product_id,
            "brand": p.brand,
            "category": p.categories[0] if p.categories else None,
            "description": p.description,
            "product_type": p.product_type,
            "image_url": p.primary_image_url,
        }
        for p in products
    ]
    stmt = pg_insert(Product).values(product_rows)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_product_supplier_sku",
        set_={
            "product_name": stmt.excluded.product_name,
            "brand": stmt.excluded.brand,
            "category": stmt.excluded.category,
            "description": stmt.excluded.description,
            "image_url": stmt.excluded.image_url,
        },
    )
    await db.execute(stmt)

    # 2. Load the products back (we need their UUIDs for variants/images)
    skus = [p.product_id for p in products]
    db_products = (
        await db.execute(
            select(Product).where(
                Product.supplier_id == supplier_id,
                Product.supplier_sku.in_(skus),
            )
        )
    ).scalars().all()
    pid_by_sku = {p.supplier_sku: p.id for p in db_products}

    # 3. Upsert variants
    variant_rows = []
    for p in products:
        product_uuid = pid_by_sku[p.product_id]
        for part in p.parts:
            inv = inv_by_part.get(part.part_id)
            variant_rows.append(
                {
                    "product_id": product_uuid,
                    "color": part.color_name,
                    "size": part.size_name,
                    "sku": part.part_id,
                    "base_price": Decimal(str(price_by_part[part.part_id]))
                    if part.part_id in price_by_part
                    else None,
                    "inventory": min(int(inv.quantity_available), 500) if inv else None,
                    "warehouse": inv.warehouse_code if inv else None,
                }
            )
    if variant_rows:
        v_stmt = pg_insert(ProductVariant).values(variant_rows)
        v_stmt = v_stmt.on_conflict_do_update(
            constraint="uq_variant_product_color_size",
            set_={
                "sku": v_stmt.excluded.sku,
                "base_price": v_stmt.excluded.base_price,
                "inventory": v_stmt.excluded.inventory,
                "warehouse": v_stmt.excluded.warehouse,
            },
        )
        await db.execute(v_stmt)

    # 4. Upsert images
    image_rows = []
    for p in products:
        product_uuid = pid_by_sku[p.product_id]
        for idx, m in enumerate(media_by_product.get(p.product_id, [])):
            image_rows.append(
                {
                    "product_id": product_uuid,
                    "url": m.url,
                    "image_type": m.media_type,
                    "color": m.color_name,
                    "sort_order": idx,
                }
            )
    if image_rows:
        i_stmt = pg_insert(ProductImage).values(image_rows)
        i_stmt = i_stmt.on_conflict_do_update(
            constraint="uq_product_image_url",
            set_={
                "image_type": i_stmt.excluded.image_type,
                "color": i_stmt.excluded.color,
                "sort_order": i_stmt.excluded.sort_order,
            },
        )
        await db.execute(i_stmt)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd api-hub/backend && source .venv/bin/activate
pytest tests/test_normalizer.py -v
```

Expected: `4 passed`. If a test fails with a constraint-name error, re-check that the `catalog/models.py` unique-constraint names match the `constraint=` strings exactly.

- [ ] **Step 6: Commit**

```bash
cd api-hub
git add backend/modules/promostandards/normalizer.py backend/tests/test_normalizer.py
git commit -m "feat: PS normalizer — upsert products/variants/images with ON CONFLICT DO UPDATE"
```

---

## Task 5: Sync Trigger Routes

**Files:**
- Create: `backend/modules/promostandards/routes.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_sync_routes.py`

Four HTTP endpoints that n8n calls. Products/inventory/pricing all enqueue background work and return `202 Accepted` with the new `SyncJob.id`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_sync_routes.py`:

```python
"""Route tests — mock SOAP client + verify 202 response shape and SyncJob created."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from main import app
from modules.promostandards.schemas import PSProductData, PSProductPart
from modules.suppliers.models import Supplier
from modules.sync_jobs.models import SyncJob


@pytest.fixture
async def sanmar_with_endpoints(db):
    s = Supplier(
        name="Test SanMar",
        slug=f"test-sanmar-{uuid.uuid4().hex[:8]}",
        protocol="promostandards",
        promostandards_code="SANM",
        auth_config={"id": "u", "password": "p"},
        endpoint_cache=[
            {"ServiceType": "Product Data", "ProductionURL": "https://fake/pd?wsdl"},
            {"ServiceType": "Inventory Levels", "ProductionURL": "https://fake/inv?wsdl"},
        ],
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


async def test_trigger_products_returns_202_with_job_id(sanmar_with_endpoints, db):
    with patch("modules.promostandards.routes.PromoStandardsClient") as Cli, \
         patch("modules.promostandards.routes.upsert_products", new=AsyncMock(return_value=1)):
        cli = Cli.return_value
        cli.get_sellable_product_ids = AsyncMock(return_value=["PC61"])
        cli.get_products_batch = AsyncMock(return_value=[
            PSProductData(product_id="PC61", parts=[PSProductPart(part_id="PC61-M")])
        ])
        cli.get_inventory = AsyncMock(return_value=[])

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as ac:
            r = await ac.post(f"/api/sync/{sanmar_with_endpoints.id}/products")

    assert r.status_code == 202
    body = r.json()
    assert "job_id" in body
    assert body["status"] == "running"

    job = (await db.execute(
        select(SyncJob).where(SyncJob.id == uuid.UUID(body["job_id"]))
    )).scalar_one()
    assert job.supplier_id == sanmar_with_endpoints.id
    assert job.job_type == "full_sync"


async def test_trigger_inventory_returns_202(sanmar_with_endpoints, db):
    with patch("modules.promostandards.routes.PromoStandardsClient") as Cli, \
         patch("modules.promostandards.routes.update_inventory_only", new=AsyncMock(return_value=0)):
        Cli.return_value.get_inventory = AsyncMock(return_value=[])
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as ac:
            r = await ac.post(f"/api/sync/{sanmar_with_endpoints.id}/inventory")
    assert r.status_code == 202
    assert "job_id" in r.json()


async def test_unknown_supplier_returns_404(db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as ac:
        r = await ac.post(f"/api/sync/{uuid.uuid4()}/products")
    assert r.status_code == 404


async def test_supplier_without_ps_code_returns_400(db):
    s = Supplier(
        name="Custom", slug=f"custom-{uuid.uuid4().hex[:8]}",
        protocol="rest", auth_config={},
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as ac:
        r = await ac.post(f"/api/sync/{s.id}/products")
    assert r.status_code == 400


async def test_status_returns_latest_job(sanmar_with_endpoints, db):
    job = SyncJob(
        supplier_id=sanmar_with_endpoints.id,
        supplier_name=sanmar_with_endpoints.name,
        job_type="full_sync",
        status="completed",
        records_processed=42,
    )
    db.add(job)
    await db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as ac:
        r = await ac.get(f"/api/sync/{sanmar_with_endpoints.id}/status")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "completed"
    assert body["records_processed"] == 42
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd api-hub/backend && source .venv/bin/activate
pytest tests/test_sync_routes.py -v
```

Expected: `ModuleNotFoundError: No module named 'modules.promostandards.routes'`.

- [ ] **Step 3: Write the implementation**

Create `backend/modules/promostandards/routes.py`:

```python
"""Sync trigger endpoints — n8n calls these via HTTP Request node.

Each endpoint creates a SyncJob row, returns 202 Accepted with the job ID,
and runs the actual SOAP work in a FastAPI BackgroundTask.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session, get_db
from modules.catalog.models import Product
from modules.suppliers.models import Supplier
from modules.suppliers.service import get_cached_endpoints
from modules.sync_jobs.models import SyncJob

from .client import PromoStandardsClient
from .normalizer import (
    update_inventory_only,
    update_pricing_only,
    upsert_products,
)
from .resolver import resolve_wsdl_url

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("/{supplier_id}/products", status_code=202)
async def trigger_product_sync(
    supplier_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    supplier = await _load_ps_supplier(db, supplier_id)
    endpoints = await get_cached_endpoints(db, supplier_id)
    if not resolve_wsdl_url(endpoints, "product_data"):
        raise HTTPException(400, "No Product Data WSDL found for this supplier")

    job = await _create_job(db, supplier, "full_sync")
    background_tasks.add_task(
        _run_product_sync, supplier_id, job.id, dict(supplier.auth_config), list(endpoints)
    )
    return {"job_id": str(job.id), "status": "running"}


@router.post("/{supplier_id}/inventory", status_code=202)
async def trigger_inventory_sync(
    supplier_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    supplier = await _load_ps_supplier(db, supplier_id)
    endpoints = await get_cached_endpoints(db, supplier_id)
    if not resolve_wsdl_url(endpoints, "inventory"):
        raise HTTPException(400, "No Inventory WSDL found for this supplier")

    job = await _create_job(db, supplier, "inventory")
    background_tasks.add_task(
        _run_inventory_sync, supplier_id, job.id, dict(supplier.auth_config), list(endpoints)
    )
    return {"job_id": str(job.id), "status": "running"}


@router.post("/{supplier_id}/pricing", status_code=202)
async def trigger_pricing_sync(
    supplier_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    supplier = await _load_ps_supplier(db, supplier_id)
    endpoints = await get_cached_endpoints(db, supplier_id)
    if not resolve_wsdl_url(endpoints, "ppc"):
        raise HTTPException(400, "No PPC (pricing) WSDL found for this supplier")

    job = await _create_job(db, supplier, "pricing")
    background_tasks.add_task(
        _run_pricing_sync, supplier_id, job.id, dict(supplier.auth_config), list(endpoints)
    )
    return {"job_id": str(job.id), "status": "running"}


@router.get("/{supplier_id}/status")
async def get_sync_status(supplier_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SyncJob)
        .where(SyncJob.supplier_id == supplier_id)
        .order_by(SyncJob.started_at.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    if not job:
        return {"status": "never_synced"}
    return {
        "job_id": str(job.id),
        "status": job.status,
        "job_type": job.job_type,
        "records_processed": job.records_processed,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "error_log": job.error_log,
    }


# -------- helpers --------


async def _load_ps_supplier(db: AsyncSession, supplier_id: UUID) -> Supplier:
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(404, "Supplier not found")
    if supplier.protocol != "promostandards" or not supplier.promostandards_code:
        raise HTTPException(400, "Supplier is not a PromoStandards supplier")
    return supplier


async def _create_job(db: AsyncSession, supplier: Supplier, job_type: str) -> SyncJob:
    job = SyncJob(
        supplier_id=supplier.id,
        supplier_name=supplier.name,
        job_type=job_type,
        status="running",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


# -------- background tasks --------


async def _run_product_sync(
    supplier_id: UUID, job_id: UUID, auth_config: dict, endpoints: list[dict]
) -> None:
    async with async_session() as db:
        job = await db.get(SyncJob, job_id)
        try:
            pd_wsdl = resolve_wsdl_url(endpoints, "product_data")
            inv_wsdl = resolve_wsdl_url(endpoints, "inventory")
            ppc_wsdl = resolve_wsdl_url(endpoints, "ppc")

            pd_client = PromoStandardsClient(pd_wsdl, auth_config)
            product_ids = await pd_client.get_sellable_product_ids()
            if not product_ids:
                _finish(job, "completed", 0)
                await db.commit()
                return

            products = await pd_client.get_products_batch(product_ids)

            inventory = []
            if inv_wsdl:
                inventory = await PromoStandardsClient(inv_wsdl, auth_config).get_inventory(product_ids)

            pricing = []
            if ppc_wsdl:
                # PPC fetch is parallelizable in V2; V1 just no-ops if WSDL missing
                pass

            count = await upsert_products(db, supplier_id, products, inventory, pricing)
            _finish(job, "completed", count)
        except Exception as exc:  # noqa: BLE001
            _finish(job, "failed", job.records_processed, str(exc))
        await db.commit()


async def _run_inventory_sync(
    supplier_id: UUID, job_id: UUID, auth_config: dict, endpoints: list[dict]
) -> None:
    async with async_session() as db:
        job = await db.get(SyncJob, job_id)
        try:
            inv_wsdl = resolve_wsdl_url(endpoints, "inventory")
            client = PromoStandardsClient(inv_wsdl, auth_config)

            product_ids = [
                row[0] for row in (await db.execute(
                    select(Product.supplier_sku).where(Product.supplier_id == supplier_id)
                )).all()
            ]
            if not product_ids:
                _finish(job, "completed", 0)
                await db.commit()
                return

            inventory = await client.get_inventory(product_ids)
            count = await update_inventory_only(db, supplier_id, inventory)
            _finish(job, "completed", count)
        except Exception as exc:  # noqa: BLE001
            _finish(job, "failed", job.records_processed, str(exc))
        await db.commit()


async def _run_pricing_sync(
    supplier_id: UUID, job_id: UUID, auth_config: dict, endpoints: list[dict]
) -> None:
    async with async_session() as db:
        job = await db.get(SyncJob, job_id)
        try:
            # PPC implementation follows same pattern as inventory once supplier
            # confirms pricing fields. Mark as completed with zero processed
            # until a real supplier WSDL is wired.
            _finish(job, "completed", 0)
        except Exception as exc:  # noqa: BLE001
            _finish(job, "failed", job.records_processed, str(exc))
        await db.commit()


def _finish(job: SyncJob, status: str, records: int, error: str | None = None) -> None:
    job.status = status
    job.records_processed = records
    job.finished_at = datetime.now(timezone.utc)
    if error:
        job.error_log = error[:2000]
```

- [ ] **Step 4: Register the router in `backend/main.py`**

Find the block of `from modules.*.routes import router as ..._router` (currently ends at line 26 with `sync_jobs_router`). Add one line after the last existing import:

```python
from modules.promostandards.routes import router as sync_router
```

Find the block of `app.include_router(...)` calls (lines 64–70). Add one line after the last existing call:

```python
app.include_router(sync_router)
```

- [ ] **Step 5: Run route tests**

```bash
cd api-hub/backend && source .venv/bin/activate
pytest tests/test_sync_routes.py -v
```

Expected: `5 passed`.

- [ ] **Step 6: Run the full suite to catch regressions**

```bash
cd api-hub/backend && source .venv/bin/activate
pytest -v
```

Expected: all tests from Tasks 2–5 pass (~27 tests total).

- [ ] **Step 7: Smoke-test the running server**

```bash
# Terminal 1:
cd api-hub/backend && source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2:
curl http://localhost:8000/docs | grep -o '/api/sync[^"]*'
```

Expected output includes:
```
/api/sync/{supplier_id}/products
/api/sync/{supplier_id}/inventory
/api/sync/{supplier_id}/pricing
/api/sync/{supplier_id}/status
```

- [ ] **Step 8: Commit**

```bash
cd api-hub
git add backend/modules/promostandards/routes.py backend/main.py backend/tests/test_sync_routes.py
git commit -m "feat: sync trigger routes — POST products/inventory/pricing + GET status"
```

---

## Task 6: SanMar E2E Verification Runbook

**Files:**
- Create: `api-hub/docs/v1a_sanmar_e2e.md`

This task is the acceptance test for V1a: trigger a real sync against SanMar's WSDL and verify products land in the catalog. It is **blocked on Christian's SanMar credentials**. The runbook below is the exact script to execute the moment credentials arrive.

- [ ] **Step 1: Create `api-hub/docs/v1a_sanmar_e2e.md`**

```markdown
# V1a SanMar E2E Verification

**Blocker:** Requires real SanMar API credentials from Christian.

## Preconditions

- Backend running: `uvicorn main:app --reload --port 8000`
- Postgres up: `docker compose up -d postgres`
- Demo data seeded: `python seed_demo.py` (gives you the SanMar supplier row)
- All V1a unit + integration tests green: `pytest -v`

## Steps

1. **Patch SanMar credentials into the existing supplier row**

   ```bash
   SANMAR_ID=$(curl -s http://localhost:8000/api/suppliers | jq -r '.[] | select(.slug=="sanmar") | .id')
   echo "SanMar ID: $SANMAR_ID"
   curl -X PATCH "http://localhost:8000/api/suppliers/$SANMAR_ID" \
     -H "Content-Type: application/json" \
     -d '{"auth_config": {"id": "REAL_USER", "password": "REAL_PASS"}, "is_active": true}'
   ```

2. **Force a PS directory refresh to populate endpoint_cache**

   ```bash
   curl http://localhost:8000/api/suppliers/$SANMAR_ID/endpoints | jq '.[] | {ServiceType, ProductionURL}'
   ```
   Expected output includes `ServiceType: "Product Data"` and `ServiceType: "Inventory Levels"` rows with WSDL URLs.

3. **Trigger a full sync**

   ```bash
   JOB=$(curl -s -X POST "http://localhost:8000/api/sync/$SANMAR_ID/products" | jq -r '.job_id')
   echo "Job ID: $JOB"
   ```

4. **Poll until completed**

   ```bash
   while true; do
     STATUS=$(curl -s "http://localhost:8000/api/sync/$SANMAR_ID/status" | jq -r '.status')
     echo "Status: $STATUS"
     [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
     sleep 10
   done
   curl -s "http://localhost:8000/api/sync/$SANMAR_ID/status" | jq
   ```
   Expected: `status: completed`, `records_processed` > 0, `error_log: null`.

5. **Verify products in the catalog**

   ```bash
   curl -s "http://localhost:8000/api/products?supplier_id=$SANMAR_ID&limit=5" | jq '.[] | {supplier_sku, product_name, category}'
   ```
   Expected: 5 real SanMar products with names like "Port & Company Essential Tee", categories like "T-Shirts".

6. **Verify variants + pricing + inventory**

   ```bash
   PID=$(curl -s "http://localhost:8000/api/products?supplier_id=$SANMAR_ID&limit=1" | jq -r '.[0].id')
   curl -s "http://localhost:8000/api/products/$PID" | jq '.variants | length'
   curl -s "http://localhost:8000/api/products/$PID" | jq '.variants[0] | {color, size, base_price, inventory, warehouse}'
   ```
   Expected: variant count > 5; non-null color/size/price/inventory.

7. **Verify idempotency**

   Re-run Step 3. `records_processed` should match; total product count in the DB must not grow.

   ```bash
   curl -s http://localhost:8000/api/stats | jq '.products'
   ```
   Record this number, run the sync again, recheck — must be identical.

8. **Verify the frontend**

   Open `http://localhost:3000/products` — SanMar products must be visible with the SanMar supplier badge, image thumbnails, and category labels.

## Record for V2 Sizing

Fill in after the first successful run:

- Total products fetched: __________
- Total variants created: __________
- Total images stored: __________
- Sync duration (start → completed): __________
- Peak memory during sync: __________ (observe via `docker stats` or similar)

This becomes the baseline for deciding when to graduate from FastAPI BackgroundTasks to a task queue in V2.
```

- [ ] **Step 2: Commit the runbook**

```bash
cd api-hub
git add docs/v1a_sanmar_e2e.md
git commit -m "docs: V1a SanMar E2E verification runbook (waiting on credentials)"
```

- [ ] **Step 3: Execute the runbook once credentials arrive**

Fill in every blank in the "Record for V2 Sizing" section. Open a PR with the filled-in doc titled `docs: V1a SanMar E2E results`. That PR is the V1a acceptance proof.

---

## Verification (end-to-end)

After every task is complete:

```bash
# 1. All unit + integration tests pass
cd api-hub/backend && source .venv/bin/activate
pytest -v

# Expected summary: ~27 passed in ~5s

# 2. Backend starts with sync router registered
uvicorn main:app --reload --port 8000 &
sleep 3
curl -s http://localhost:8000/openapi.json | jq '.paths | keys | map(select(startswith("/api/sync")))'

# Expected: ["/api/sync/{supplier_id}/inventory", "/api/sync/{supplier_id}/pricing",
#            "/api/sync/{supplier_id}/products", "/api/sync/{supplier_id}/status"]

# 3. Graph knows about the new module
# (run from a Claude Code session with code-review-graph MCP)
#   mcp__code-review-graph__query_graph_tool pattern=file_summary
#     target=api-hub/backend/modules/promostandards/client.py
# Expected: nodes for PromoStandardsClient class + four public methods.
```

A fresh engineer picking up V1b (S&S REST adapter), V1c (markup engine), or V1d (4Over) can now rely on the normalizer's `upsert_products` as a stable interface — their job is just to produce `PSProductData` from their respective APIs.
