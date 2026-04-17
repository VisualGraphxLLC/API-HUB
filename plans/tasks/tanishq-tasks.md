# Tanishq — Sprint Tasks

**Status:** 0/3 original V1a tasks done — all three (SOAP client, normalizer, E2E) are still pending and blocked on Vidhi's resolver landing first. Four new V1c/V1e tasks added below once V1a completes.
**Plus:** PR reviews + unblocking Christian for credentials + OPS Postman export.

---

## Pending — Critical Path (V1a)

### Task 3b: SOAP Client (client.py) *(HIGHEST PRIORITY — unblocks V1a)*

**Priority:** Start the moment Vidhi's Task 3 (`resolver.py`) is merged.
**File to create:** `backend/modules/promostandards/client.py`
**Depends on:** `schemas.py` (Sinchana, DONE), `resolver.py` (Vidhi, pending)

### What this does
The core protocol adapter. zeep-backed SOAP client that talks to any PromoStandards supplier given a WSDL URL + credentials dict.

### Key technical decisions
- zeep is **synchronous** — wrap every call with `asyncio.to_thread()`
- `zeep.cache.SqliteCache` for WSDL parse caching
- Batch product fetches (50 at a time)
- Individual product failures don't abort the entire sync — log and continue

### Class methods
```python
class PromoStandardsClient:
    def __init__(self, wsdl_url: str, credentials: dict): ...
    async def get_sellable_product_ids(self, ws_version: str = "2.0.0") -> list[str]: ...
    async def get_product(self, product_id: str, ws_version: str = "2.0.0") -> PSProductData: ...
    async def get_products_batch(self, product_ids: list[str], batch_size: int = 50) -> list[PSProductData]: ...
    async def get_inventory(self, product_ids: list[str], ws_version: str = "2.0.0") -> list[PSInventoryLevel]: ...
```

### Steps
- [ ] Implement all four public methods + XML response parsing into the PS Pydantic schemas
- [ ] Verify zeep WSDL cache is used (check `~/.zeep` or configured path)
- [ ] Pytest with a mocked zeep Transport (record a SanMar WSDL fixture)
- [ ] Commit: `feat: PromoStandardsClient — zeep SOAP adapter for any PS supplier`

---

### Task 4: Normalization Layer

**Priority:** After Task 3b + Urvashi's Task 1 all merged.
**File to create:** `backend/modules/promostandards/normalizer.py`

### Three functions
```python
async def upsert_products(
    db: AsyncSession,
    supplier_id: UUID,
    products: list[PSProductData],
    inventory: list[PSInventoryLevel] | None = None,
    pricing: list[PSPricePoint] | None = None,
    media: list[PSMediaItem] | None = None,
) -> int: ...

async def update_inventory_only(
    db: AsyncSession, supplier_id: UUID, inventory: list[PSInventoryLevel]
) -> int: ...

async def update_pricing_only(
    db: AsyncSession, supplier_id: UUID, pricing: list[PSPricePoint]
) -> int: ...
```

### Implementation notes
- Use `postgresql.insert(Product).on_conflict_do_update(...)` — requires Urvashi's unique constraints from Task 1
- Process in batches of 100, commit between batches
- Return row counts for the `SyncJob.records_processed` field

### Steps
- [ ] Implement all three functions using `pg_insert().on_conflict_do_update()`
- [ ] Pytest with a SanMar fixture product → verify rows in `products`, `product_variants`, `product_images`
- [ ] Verify idempotency: running `upsert_products` twice produces the same row count, no duplicates
- [ ] Commit: `feat: PS data → DB upserts (full sync + inventory-only + pricing-only)`

---

### Task 6: SanMar E2E Verification

**Priority:** After Task 5 (Urvashi) + SanMar credentials from Christian.
**Blocked on:** Christian's SanMar API credentials.

### Steps
Document in `docs/v1a_sanmar_e2e.md`:
1. Update SanMar supplier row with real creds
2. `curl -X POST http://localhost:8000/api/sync/{sanmar_id}/products`
3. Poll `curl http://localhost:8000/api/sync-jobs/{job_id}` until `status: "completed"`
4. Verify products in catalog + frontend shows SanMar badge
5. Note the actual runtime (benchmark for V2 performance work)

---

## Pending — V1c (OPS Push)

### Task 10b: Product Mutation Execution Logic

**Priority:** After Sinchana's Task 10a (UI fields scaffolded) + OPS Postman collection export.
**File:** `api-hub/n8n-nodes-onprintshop/nodes/OnPrintShop.node.ts`

### What this does
Wire the GraphQL mutation execution for the 7 missing product mutations Sinchana scaffolded UI fields for. Each needs:
- GraphQL mutation string
- Input variable mapping from n8n UI fields
- Error handling for API failures

### Mutations
`setProductCategory`, `setAssignOptions`, `setProductSize`, `setProductPages`, `setMasterOptionAttributes`, `setMasterOptionAttributePrice`, `setProductOptionRules`.

### Steps
- [ ] Wait for OPS Postman collection → extract exact `input` shape for each mutation
- [ ] Update Sinchana's UI field definitions with correct field names (pair with her if she's still active)
- [ ] Add execution handlers in the `execute()` method (the 3,313-line monster at line 4859 of `OnPrintShop.node.ts`)
- [ ] For each mutation: build a small real-world test run against a sandbox OPS instance once creds arrive
- [ ] `npm run build` + `docker compose restart n8n` + verify in editor
- [ ] Commit: `feat: GraphQL execution for 7 product mutations (category/options/size/pages/attributes/prices/rules)`

### Note
Refactor opportunity: the `execute()` method is 3,313 lines. Consider extracting per-operation handlers into `nodes/handlers/*.ts` files as a follow-up. Don't block this task on the refactor — ship the mutations first.

---

### Task 12: n8n Push Workflow JSON

**Priority:** After Task 10b + Urvashi's Task 11 (markup engine) + Vidhi's Task 13 (image pipeline).
**File to create:** `api-hub/n8n-workflows/ops-push.json`

### Workflow steps
1. Manual trigger (add cron later in V1e)
2. `GET /api/customers?is_active=true` → loop
3. `GET /api/products?not_pushed_to={customer_id}` → loop
4. `GET /api/push/{customer_id}/product/{id}/payload` → markup-applied data
5. OnPrintShop node → `setProduct`, `setProductPrice`, `setProductCategory`, `setAssignOptions`, `setProductSize`, `setOrderProductImage`
6. `POST /api/push-log` → log result
7. On any error → Slack notification webhook

### Steps
- [ ] Build in n8n editor, then export JSON to `api-hub/n8n-workflows/ops-push.json`
- [ ] Document the env vars the workflow expects (`API_BASE_URL`, `SLACK_WEBHOOK`)
- [ ] Commit: `feat: n8n OPS push workflow — loops customers × products, calls markup API + OPS node`

---

## Pending — V1e (Scheduling + Delta)

### Task 18: Delta Sync Support

**Priority:** After V1a complete (need `PromoStandardsClient`).
**Files to modify:**
- `backend/modules/promostandards/client.py` — add `get_product_date_modified`
- `backend/modules/promostandards/routes.py` — accept `?delta=true` query param

### What this does
Delta syncs pull only products modified since the last sync — orders of magnitude faster than full syncs (SanMar has 5000+ products, delta typically <50).

### Steps
- [ ] Add `PromoStandardsClient.get_product_date_modified(since: datetime) -> list[str]` (calls PS `getProductDateModified`)
- [ ] In `routes.py`, when `?delta=true`, query the last completed `SyncJob.finished_at` and pass as `since`. Fall back to full sync if no prior sync exists.
- [ ] Add a `sync_mode: "full" | "delta"` flag to `SyncJob` so the dashboard can label it
- [ ] Commit: `feat: delta sync — POST /api/sync/{id}/products?delta=true`

---

## Ongoing — PR Reviews

Review every intern PR before merge:
- **Sinchana** PRs: Task 8a (S&S normalizer), Task 10a (n8n UI fields), Task 23a (Storefront Config page scaffolding)
- **Urvashi** PRs: Task 5 (sync routes), Task 7 (Alphabroder row), Task 8 (S&S REST client), Task 11 (markup engine)
- **Vidhi** PRs: Task 3 (resolver — **highest priority**, unblocks you), Task 13 (image pipeline), Task 14 (4Over HMAC), Task 15 (4Over normalizer)

---

## Chase Christian For

- [ ] **SanMar API credentials** — blocks your Task 6
- [ ] **OPS Postman collection export** — blocks your Task 10b + Sinchana's Task 10a field definitions
- [ ] **OPS API Client ID + Secret** (for n8n credential setup) — blocks end-to-end push testing
- [ ] **S&S Activewear API credentials** — unblocks Urvashi's Task 8 E2E
- [ ] **4Over sandbox credentials** — unblocks Vidhi's Task 14 E2E
- [ ] Phased SOW draft (committed in meeting)

---

## Future (not yet assigned)

- **V1e Task 17** — n8n cron workflows (inventory-30min / pricing-daily / delta-daily / full-weekly)
- **V1e Task 19b** — Sync dashboard polish (auto-refresh while running, filters by supplier/type/status)
- **V1g Task 23 backend** — `backend/modules/ops_config/` proxy + cache for OPS categories/options (pair with Sinchana's 23a frontend)

Decide owner once V1a ships and Sprint 2 capacity is clear.
