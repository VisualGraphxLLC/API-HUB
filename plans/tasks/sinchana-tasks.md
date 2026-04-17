# Sinchana — Sprint Tasks

**Status:** 4/4 V1a/V1f sprint tasks shipped. Three new tasks added below for V1c + V1g.
**Branch:** `sinchana-sprint-v1` (merged) → start `sinchana-sprint-v2`

---

## ✅ Completed

- **Task 0.3** — shadcn/ui installed (`frontend/components.json` + 7 UI components present)
- **Task 20** — Terminology + sidebar rename (no `_QUERYING_`, `Vendors`, `SOAP`, `WSDL` visible in UI)
- **Task 21** — Simplified supplier form rewritten as 3-step flow (`frontend/src/components/suppliers/reveal-form.tsx`)
- **Task 2** — PS response Pydantic schemas (`backend/modules/promostandards/schemas.py` — PSProductData, PSProductPart, PSInventoryLevel, PSPricePoint, PSMediaItem)

---

## Pending Tasks

### Task 8a: S&S Activewear → PSProductData Mapping

**Priority:** Start anytime. Parallel with Urvashi's Task 8 REST client.
**File to create:** `backend/modules/rest_connector/ss_normalizer.py`
**Depends on:** V1a Task 2 (your PS schemas — already done) and Urvashi's Task 8 client (in progress)

### What this does
S&S Activewear returns JSON (not SOAP XML). Your job is the mapping layer: take S&S JSON and emit the same `PSProductData` / `PSProductPart` / `PSInventoryLevel` / `PSPricePoint` / `PSMediaItem` models you already defined in Task 2. The normalizer from V1a Task 4 (Tanishq) consumes these unchanged — no DB work here.

### S&S API response shape (reference)
`GET https://api.ssactivewear.com/V2/Products/` returns:
```json
[
  {
    "sku": "B00760001",
    "yourPrice": 3.79,
    "styleID": 39,
    "styleName": "PC61",
    "brandName": "Port & Company",
    "colorName": "Navy",
    "sizeName": "M",
    "qty": 1420,
    "warehouseAbbr": "IL",
    "colorFrontImage": "https://cdn.ssactivewear.com/..."
  }
]
```

Each row is a part-level SKU. You group by `styleID` to form `PSProductData`, and each row becomes one `PSProductPart` + `PSInventoryLevel` + `PSPricePoint` + `PSMediaItem`.

### Function signature

```python
def ss_to_ps_format(
    ss_products: list[dict],
) -> tuple[
    list[PSProductData],
    list[PSInventoryLevel],
    list[PSPricePoint],
    list[PSMediaItem],
]:
    """Group S&S part rows by styleID → emit PS-format typed models."""
```

### Steps

- [ ] **Step 1:** Create `backend/modules/rest_connector/__init__.py` (empty) if Urvashi hasn't already.
- [ ] **Step 2:** Create `ss_normalizer.py` with the mapping logic. Group by `styleID`, aggregate parts, dedupe images by URL.
- [ ] **Step 3:** Write a small inline test with 3–5 sample S&S rows that asserts the grouping produces exactly 1 `PSProductData` with correct parts.
- [ ] **Step 4:** Commit: `feat: S&S JSON → PSProductData mapping (reuses V1a schemas)`

---

### Task 10a: n8n Node — UI Field Definitions for 7 Missing Mutations

**Priority:** Unblocked — can start now.
**File:** `api-hub/n8n-nodes-onprintshop/nodes/OnPrintShop.node.ts`
**Depends on:** Nothing (field definitions are declarative)

### What this does
The OnPrintShop n8n node currently has 4 of 11 required product mutations. Your job is to add the **UI field definitions** for the remaining 7 — the dropdowns, text inputs, and parameter schemas that show up in the n8n editor. Tanishq will wire the GraphQL execution logic in Task 10b.

### Mutations needing UI fields

| Operation | Description | Key input fields |
|-----------|-------------|------------------|
| `setProductCategory` | Assign product to OPS category | `product_id`, `category_id` |
| `setAssignOptions` | Link option groups to product | `product_id`, `option_group_ids[]` |
| `setProductSize` | Set product dimensions | `product_id`, `width`, `height`, `depth`, `weight`, `unit` |
| `setProductPages` | Set page count (print products) | `product_id`, `page_count` |
| `setMasterOptionAttributes` | Define option attributes | `option_group_id`, `attributes[]` |
| `setMasterOptionAttributePrice` | Price per option attribute | `attribute_id`, `price` |
| `setProductOptionRules` | Inter-option rules | `product_id`, `rules[]` |

**Exact `input` field shapes come from the OPS Postman collection** (blocker: Tanishq is chasing Christian). Until that arrives, scaffold with best-guess field names and `placeholder: "TBD — see Postman collection"` in descriptions.

### Steps

- [ ] **Step 1:** Read how the existing `setProduct` and `setProductPrice` UI fields are defined in `OnPrintShop.node.ts` (search for `displayOptions` and `resource: 'product'`). Follow that pattern.
- [ ] **Step 2:** Add option entries to the `operation` dropdown for each of the 7 new mutations. Place them under `resource: 'product'`.
- [ ] **Step 3:** For each operation, add the parameter field definitions with `displayOptions.show.operation` set to the matching operation name.
- [ ] **Step 4:** Run `npm run build` in `n8n-nodes-onprintshop/` — must compile cleanly.
- [ ] **Step 5:** Restart n8n (`docker compose restart n8n`) and verify each new operation appears in the OnPrintShop node's dropdown.
- [ ] **Step 6:** Commit: `feat: scaffold UI fields for 7 missing OPS product mutations (execution logic pending)`

---

### Task 23a: Scaffold OPS Storefront Config Page (Frontend)

**Priority:** Start after Task 10a or in parallel.
**Files to create:**
- `frontend/src/app/products/configure/page.tsx`
- `frontend/src/components/products/category-assign.tsx`
- `frontend/src/components/products/options-mapping.tsx`
- `frontend/src/components/products/pricing-preview.tsx`

### What this does
Build the frontend shell for V1g Task 23 — the page where users map synced products to OPS categories, options, and pricing rules. Three sections (Categories / Options / Pricing) with mocked data for now. The backend module (`ops_config`) is blocked on OPS credentials, so you're building the UI against stub data that Tanishq will wire later.

### Page layout
```
┌─────────────────────────────────────────┐
│ Storefront Product Setup                │
│ ─────────────────────────────────────   │
│ [Tab: Categories] [Options] [Pricing]   │
│                                         │
│ <TabContent for active tab>             │
└─────────────────────────────────────────┘
```

Use shadcn `<Tabs>`. Each tab hosts one of the three components.

### Components

**`category-assign.tsx`**
- Fetches (stubbed) `GET /api/ops/{customer_id}/categories` — use hardcoded sample until backend exists: `[{id: "c1", name: "T-Shirts"}, {id: "c2", name: "Polos"}]`
- Table of synced products with a category dropdown per row
- "Save Mapping" button (no-op for now — logs to console)

**`options-mapping.tsx`**
- Stubbed OPS master options: Color, Size, Material
- Side-by-side list: supplier option values (left) ↔ OPS option attributes (right)
- Drag-or-dropdown mapping UI (use shadcn `<Select>` per row for simplicity)

**`pricing-preview.tsx`**
- Product picker (dropdown of synced products)
- Shows: base price → markup applied → rounded → final display price
- Read-only preview — changes happen on the existing Pricing Rules page

### Steps
- [ ] **Step 1:** Add "Product Setup" link to sidebar (edit `components/Sidebar.tsx` — place under "Configuration" section, route `/products/configure`).
- [ ] **Step 2:** Scaffold `page.tsx` with shadcn Tabs + three empty component imports.
- [ ] **Step 3:** Build each of the three components with stub data. Include empty states and loading skeletons.
- [ ] **Step 4:** Verify `npm run dev` renders the page cleanly at `/products/configure`.
- [ ] **Step 5:** Commit: `feat: scaffold Storefront Product Setup page (Categories / Options / Pricing tabs with stub data)`

### Notes
- Do NOT hit any OPS API or `/api/ops/*` endpoint yet. Those endpoints don't exist.
- Use `TODO(ops-config)` comments wherever you stub data so Tanishq can grep for them later.
- Keep the visual design consistent with existing Blueprint design tokens (Outfit font, blueprint blue `#1e4d92`, paper `#f2f0ed`).
