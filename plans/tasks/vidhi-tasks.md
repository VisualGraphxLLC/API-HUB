# Vidhi — Sprint Tasks

**Status:** 2/3 V0 tasks shipped. Task 3 (resolver) still pending. Three new V1c/V1d tasks added below.
**Branch:** `vidhi-sprint-v1` (mostly merged) → start `vidhi-sprint-v2` after Task 3

---

## ✅ Completed

- **Task 0.4** — Customers (Storefronts) page with list + OAuth2 credential form (`frontend/src/app/customers/page.tsx`)
- **Task 0.5** — Workflows page with animated pipeline visualizer (`frontend/src/components/workflows/pipeline-view.tsx`)

---

## Pending Tasks

### Task 3: WSDL Resolver *(CARRIED OVER — START HERE)*

**Priority:** **DO THIS FIRST.** Blocks Tanishq's SOAP client (Task 3b) which blocks every V1a downstream task.
**File to create:** `backend/modules/promostandards/resolver.py`

### What this does
PromoStandards directory returns endpoint lists where each endpoint has a `ServiceType` like "Product Data", "Inventory Levels", etc. Different suppliers register with inconsistent names ("Product Data" vs "ProductData"). Your resolver normalizes those strings and returns the right `ProductionURL` for each service type.

### Steps

- [ ] **Step 1:** The `backend/modules/promostandards/` directory already exists (Sinchana created it for Task 2). Confirm with `ls backend/modules/promostandards/` — you should see `__init__.py` and `schemas.py`.
- [ ] **Step 2:** Create `backend/modules/promostandards/resolver.py`:

```python
"""Resolve WSDL URLs from cached PromoStandards directory endpoints."""

_SERVICE_TYPE_ALIASES = {
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


def resolve_wsdl_url(endpoint_cache: list[dict], service_type: str) -> str | None:
    target = _normalize_service_type(service_type)
    for ep in endpoint_cache or []:
        raw_type = ep.get("ServiceType") or ep.get("Name") or ""
        if _normalize_service_type(raw_type) == target:
            url = ep.get("ProductionURL")
            if url:
                return url
    return None
```

- [ ] **Step 3:** Sanity-check:
```bash
cd backend && source .venv/bin/activate
python -c "
from modules.promostandards.resolver import resolve_wsdl_url
eps = [
    {'ServiceType': 'Product Data', 'ProductionURL': 'https://ws.sanmar.com/pd?wsdl'},
    {'ServiceType': 'Inventory Levels', 'ProductionURL': 'https://ws.sanmar.com/inv?wsdl'},
]
assert resolve_wsdl_url(eps, 'product_data') == 'https://ws.sanmar.com/pd?wsdl'
assert resolve_wsdl_url(eps, 'inventory') == 'https://ws.sanmar.com/inv?wsdl'
assert resolve_wsdl_url([{'ServiceType': 'ProductData', 'ProductionURL': 'x'}], 'product_data') == 'x'
assert resolve_wsdl_url([], 'product_data') is None
print('resolver OK')
"
```

- [ ] **Step 4:** Commit: `feat: WSDL resolver — maps PS ServiceType strings to ProductionURL with alias normalization`

---

### Task 13: Image Pipeline

**Priority:** After Task 3. Independent of all SOAP work.
**Files to create:**
- `backend/modules/ops_push/__init__.py`
- `backend/modules/ops_push/image_pipeline.py`
- Route added to `backend/modules/ops_push/routes.py`
**Dependencies:** `Pillow`, `httpx` (both already in requirements.txt)

### What this does
When n8n pushes a product to OPS, it needs images in the right size/format. This service downloads a supplier's image URL, resizes to 800×800, converts to WebP quality 85, and returns the processed bytes.

### Function signature

```python
async def process_image(source_url: str) -> bytes:
    """Download, resize to 800×800, convert to WebP q85. Returns bytes."""
```

### Endpoint

```
GET /api/push/image/{image_id}/processed
```
Loads the `ProductImage` row, calls `process_image(image.url)`, returns the WebP bytes with `Content-Type: image/webp`.

### Steps

- [ ] **Step 1:** Create `backend/modules/ops_push/__init__.py` (empty) and `image_pipeline.py`:
```python
from io import BytesIO
import httpx
from PIL import Image

async def process_image(source_url: str) -> bytes:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(source_url)
        r.raise_for_status()
    img = Image.open(BytesIO(r.content)).convert("RGB")
    img.thumbnail((800, 800), Image.Resampling.LANCZOS)
    out = BytesIO()
    img.save(out, format="WEBP", quality=85)
    return out.getvalue()
```

- [ ] **Step 2:** Create `routes.py` with the endpoint. Stream the bytes via FastAPI `Response(content=..., media_type="image/webp")`. Cache headers: `Cache-Control: public, max-age=86400`.
- [ ] **Step 3:** Register the router in `backend/main.py`.
- [ ] **Step 4:** Manual test:
```bash
curl -o test.webp http://localhost:8000/api/push/image/{some_image_id}/processed
file test.webp  # should say "RIFF ... WEBP"
```
- [ ] **Step 5:** Commit: `feat: OPS image pipeline — download, resize 800×800, WebP q85`

---

### Task 14: 4Over REST + HMAC Client

**Priority:** After Task 3. Blocked on Christian providing 4Over sandbox credentials for E2E — but the client code can be written and unit-tested independently against sample fixtures.
**File to create:** `backend/modules/rest_connector/fourover_client.py`

### What this does
4Over uses HMAC-SHA256 request signing. Every request must include `Authorization: hmac <api_key>:<signature>` where `signature = HMAC-SHA256(private_key, method + path + timestamp)`. You'll build `FourOverClient` using httpx.

### Class skeleton

```python
import hmac
import hashlib
import time
from datetime import datetime, timezone
import httpx

class FourOverClient:
    def __init__(self, base_url: str, auth_config: dict):
        self.base_url = base_url.rstrip("/")
        self.api_key = auth_config["api_key"]
        self.private_key = auth_config["private_key"].encode()

    def _sign(self, method: str, path: str) -> dict:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        payload = f"{method}{path}{timestamp}".encode()
        sig = hmac.new(self.private_key, payload, hashlib.sha256).hexdigest()
        return {
            "Authorization": f"hmac {self.api_key}:{sig}",
            "X-Timestamp": timestamp,
        }

    async def get_categories(self) -> list[dict]: ...
    async def get_products(self) -> list[dict]: ...
    async def get_product_options(self, product_uuid: str) -> dict: ...
    async def get_quote(self, product_uuid: str, options: dict) -> dict: ...
```

### Steps
- [ ] **Step 1:** Create `rest_connector/__init__.py` if it doesn't exist (Urvashi may already have).
- [ ] **Step 2:** Implement the class + 4 methods using httpx `AsyncClient`.
- [ ] **Step 3:** Write a pytest with a mocked httpx transport to verify the signature header format against a known input/output fixture.
- [ ] **Step 4:** Commit: `feat: 4Over REST+HMAC client with SHA-256 request signing`

---

### Task 15: 4Over Normalizer (Reuses Field Mapping UI)

**Priority:** After Task 14.
**File to create:** `backend/modules/rest_connector/fourover_normalizer.py`

### What this does
4Over products have paper types, coatings, folds — not colors and sizes. You built the Field Mapping UI in V0 Task 16; this is the backend half. It reads the field-mapping config from the DB (keyed by `supplier_id`) and applies transforms to map 4Over JSON → `PSProductData` format (same schemas as SanMar).

### Why reuse PSProductData?
The existing upsert logic (from Tanishq's Task 4 normalizer) consumes `PSProductData`. Outputting the same shape means the DB layer works unchanged for all 4 supplier types.

### Steps
- [ ] **Step 1:** Check how the Field Mapping UI stores config — inspect `api-hub/frontend/src/app/mappings/[supplierId]/page.tsx` and find the backend endpoint/table it writes to. Document the schema.
- [ ] **Step 2:** If no backend mapping table exists yet, create one (`field_mappings` table: `supplier_id`, `source_field`, `target_field`, `transform`). Add model + route to a new `mappings` module or extend `suppliers` module.
- [ ] **Step 3:** Build `normalize_4over(raw_products, field_mappings) -> list[PSProductData]`. Handle paper/coating/fold as custom options mapped to the `PSProductPart` description field (or extend `PSProductPart` with an `attributes: dict` if cleaner).
- [ ] **Step 4:** Unit-test with 3 sample 4Over products and a known mapping config.
- [ ] **Step 5:** Commit: `feat: 4Over → PSProductData normalizer using Field Mapping config`

### Note
Task 16 (sync route HMAC branch) is Urvashi's — you coordinate by agreeing on the `PSProductData` output shape.
