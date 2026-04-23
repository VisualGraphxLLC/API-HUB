# Task 2 — `setProductSize` OPS Node Mutation — Detail Guide

**Status:** ✅ Completed and verified on 2026-04-23  
**Branch:** `Vidhi`  
**What you can say in one sentence:** *"I added the setProductSize mutation to our custom n8n OnPrintShop node so that when we push a product to OPS, it can send size information (S, M, L, XL) for every variant."*

---

## 1. What Got Built

| File | What Changed |
|---|---|
| `n8n-nodes-onprintshop/nodes/OnPrintShop.node.ts` | 3 insertions — dropdown entry, input field, execute logic |
| `n8n-nodes-onprintshop/dist/` | Rebuilt TypeScript → JavaScript via `npm run build` |

---

## 2. Background — What Is This Task About?

### The Big Picture

This project pulls product catalogs from suppliers (like SanMar, which sells t-shirts, polos, hoodies) and pushes them into customer storefronts built on **OnPrintShop (OPS)**.

The "push to OPS" step is handled by **n8n** — a workflow automation tool running in Docker. n8n talks to OPS using **GraphQL mutations** — these are basically "action commands" you send to an API. Each mutation does one specific thing:

| Mutation | What It Does |
|---|---|
| `setProduct` | Creates or updates a product in OPS |
| `setProductPrice` | Sets the price for a product |
| `setProductSize` | Sets size variants (S, M, L, XL) — **THIS TASK** |
| `setProductCategory` | Assigns a product to a category |

### Why Was `setProductSize` Missing?

The n8n OnPrintShop node is a custom plugin we maintain in `n8n-nodes-onprintshop/`. Before this task, the node had `setProduct` and `setProductPrice` but was missing `setProductSize`. This meant:

- We could create a product in OPS ✅
- We could set its price ✅
- But we could NOT tell OPS it comes in Small, Medium, Large, XL ❌

Without sizes, a t-shirt would appear in OPS as a product with no variant options — customers couldn't select what size they want. This task fixes that gap.

---

## 3. How the n8n Node File Is Structured

The file `OnPrintShop.node.ts` is 8197 lines long and has 3 distinct sections that work together for every operation:

```
Section 1: Operations Dropdown (~line 636)
───────────────────────────────────────────
{ name: 'Set Product Size', value: 'setProductSize', ... }
         ↑ This is the label the user sees in the n8n UI dropdown

Section 2: Input Fields (~line 757)
───────────────────────────────────────────
{ name: 'setProductSize_input', type: 'json', ... }
         ↑ This defines what JSON fields the user fills in

Section 3: Execute Logic (~line 5418)
───────────────────────────────────────────
if (operation === 'setProductSize') { ... }
         ↑ This is the code that actually sends the request to OPS
```

All 3 sections must exist and match for the operation to work. If you add the dropdown but forget the execute logic, the operation appears in the UI but crashes when run.

---

## 4. Exact Code Added

### Insertion 1 — Operations Dropdown (line 639)

**Before:**
```ts
{ name: 'Set Product Price', value: 'setProductPrice', action: 'Create or update product price' },
{ name: 'Set Quote', value: 'setQuote', action: 'Create or update a quote' },
```

**After:**
```ts
{ name: 'Set Product Price', value: 'setProductPrice', action: 'Create or update product price' },
{ name: 'Set Product Size', value: 'setProductSize', action: 'Create or update product size variant' },
{ name: 'Set Quote', value: 'setQuote', action: 'Create or update a quote' },
```

**What this does:** Adds "Set Product Size" (shown as "Create or update product size variant") to the dropdown menu inside n8n. Without this, the user can never even see or select the operation.

---

### Insertion 2 — Input Field Definition (line 757)

**Added block:**
```ts
// Mutation: Set Product Size
{
  displayName: 'Input (JSON)',
  name: 'setProductSize_input',
  type: 'json',
  required: true,
  displayOptions: { show: { resource: ['mutation'], operation: ['setProductSize'] } },
  default: '{\n  "product_size_id": 0,\n  "products_id": 0,\n  "size_name": "",\n  "color_name": "",\n  "products_sku": "",\n  "visible": 1\n}',
  description: 'ProductSizeInput JSON object. Set product_size_id to 0 to create new.',
},
```

**What this does:** Defines the JSON input box that appears in the n8n UI when "Set Product Size" is selected. The `default` value is a pre-filled template so the user knows what fields to fill in:

| Field | Meaning |
|---|---|
| `product_size_id` | Set to `0` to CREATE a new size, or existing ID to UPDATE |
| `products_id` | The OPS product ID this size belongs to |
| `size_name` | e.g. `"S"`, `"M"`, `"L"`, `"XL"` |
| `color_name` | e.g. `"Navy"`, `"White"` |
| `products_sku` | The unique SKU code for this variant |
| `visible` | `1` = visible in storefront, `0` = hidden |

**The `displayOptions` field** is important — it tells n8n to only show this input field when:
- Resource is set to `mutation`
- Operation is set to `setProductSize`

This prevents the input field from showing up on unrelated operations.

---

### Insertion 3 — Execute Logic (line 5418)

**Added block:**
```ts
if (operation === 'setProductSize') {
  const input = JSON.parse(this.getNodeParameter('setProductSize_input', i) as string);
  const mutation = `mutation setProductSize ($input: ProductSizeInput!) { setProductSize (input: $input) { result message product_size_id } }`;
  const responseData = await this.helpers.request({
    method: 'POST',
    url: `${baseUrl}/api/`,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: { query: mutation, variables: { input } },
    json: true
  });
  if (responseData && responseData.data && responseData.data.setProductSize)
    returnData.push(responseData.data.setProductSize);
  else if (responseData && responseData.errors)
    throw new NodeOperationError(this.getNode(), `GraphQL Error: ${JSON.stringify(responseData.errors)}`);
}
```

**What this does — step by step:**

1. **Reads the JSON** the user filled in the input box
2. **Builds the GraphQL mutation string** — this is the exact command sent to OPS
3. **Sends a POST request** to the OPS API endpoint with:
   - `Authorization: Bearer {token}` — proves we're authenticated
   - `Content-Type: application/json` — tells OPS we're sending JSON
   - The mutation + variables as the request body
4. **Handles the response:**
   - On success → pushes `{ result, message, product_size_id }` to n8n's output
   - On GraphQL error → throws a readable error message
5. **Returns `product_size_id`** — the ID OPS assigned to this size, which we need later when setting the price per size

---

## 5. What Is GraphQL?

GraphQL is an alternative to REST APIs. Instead of calling different URLs for different actions (`POST /products/size`), everything goes to ONE endpoint (`POST /api/`) and the "mutation string" inside the request body tells the server what to do.

**Analogy:** REST is like having a separate phone number for every department. GraphQL is like one receptionist — you call one number and say "I need to add a size variant for product 42" and they route it internally.

The mutation string we send looks like:
```graphql
mutation setProductSize ($input: ProductSizeInput!) {
  setProductSize (input: $input) {
    result
    message
    product_size_id
  }
}
```

- `mutation` → tells GraphQL this is a write operation (not a read)
- `setProductSize` → the name of the action
- `($input: ProductSizeInput!)` → typed parameter — OPS validates this shape
- `{ result message product_size_id }` → fields we want back in the response

---

## 6. Build + Deploy Commands

After making the 3 code changes, the TypeScript must be compiled to JavaScript (n8n runs JS, not TS) and n8n must be restarted to load the new build:

```bash
# Step 1 — Compile TypeScript → JavaScript
# Run from: D:/company/API-HUB/n8n-nodes-onprintshop/
npm run build
# Output: dist/nodes/OnPrintShop.node.js (updated)

# Step 2 — Restart n8n to pick up the new build
# Run from: D:/company/API-HUB/
docker compose restart n8n
```

The `npm run build` command runs two things in sequence (defined in `package.json`):
1. `tsc` — TypeScript compiler, converts `.ts` → `.js`
2. `gulp build:icons` — copies the node icon into the dist folder

The `docker-compose.yml` is configured to mount our local `n8n-nodes-onprintshop/dist/` into the container, so restarting n8n is enough — no need to rebuild the Docker image.

---

## 7. Verification

**How to verify in n8n UI:**

1. Open **http://localhost:5678**
2. Click **Create workflow**
3. Add a node → search **"OnPrintShop"**
4. Set **Resource** → `Mutation`
5. Open the **Operation** dropdown
6. Look for **"Create or update product size variant"**

**Result on 2026-04-23:** ✅ Verified — "Create or update product size variant" appeared in the operation dropdown.

---

## 8. Issues Encountered + How They Were Fixed

| Issue | Cause | Fix |
|---|---|---|
| `tsc is not recognized` | `node_modules/` was never installed in `n8n-nodes-onprintshop/` | Ran `npm install` first — installed 407 packages |
| n8n showing "ERR_EMPTY_RESPONSE" | n8n container still starting after restart | Waited ~30 seconds and refreshed |
| n8n reset to "Set up owner account" | "Last session crashed" log — SQLite DB reset after container restart | Created new account, re-imported workflows via `docker cp` + `n8n import:workflow` |
| `docker cp` path error with `/tmp/` | Windows Git Bash converts `/tmp/` → `C:/Users/.../AppData/Temp/` | Used PowerShell `docker cp` which doesn't convert paths |
| Workflow import BOM error | PowerShell piped strings with UTF-16 BOM | Used PowerShell `docker cp` instead of piping strings |

---

## 9. What Comes Next

| Next Task | What It Adds |
|---|---|
| **Task 3** — `setProductCategory` | Assigns OPS category to a product (same 3-insertion pattern) |
| **Task 4** — Update gap analysis doc | Marks setProduct, setProductPrice, setProductSize, setProductCategory as implemented |
| **Task 5** — n8n smoke test | Manually chains Set Product Category → Set Product → Set Product Size → Set Product Price in n8n and executes with test data |
