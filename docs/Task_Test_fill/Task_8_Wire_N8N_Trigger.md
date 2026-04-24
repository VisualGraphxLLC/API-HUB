# Task 8 — Wire Real n8n Trigger — Detail Guide

**Status:** ✅ Completed on 2026-04-24
**Branch:** `Vidhi`
**What you can say in one sentence:** *"I replaced the fake push button (which wrote a random ID directly to the database) with a real connection to the n8n workflow — so clicking Push Now actually starts the OPS automation pipeline."*

---

## 1. What Got Built

| File | What Changed |
|---|---|
| `backend/modules/push_log/schemas.py` | Added `PushTriggerRequest` and `PushTriggerResponse` models |
| `backend/modules/push_log/routes.py` | Added `POST /api/push-trigger` endpoint |
| `n8n-workflows/ops-push.json` | Updated Parse Params node to support `product_id` param (single-product push) |
| `frontend/src/components/products/push-history.tsx` | Added `refreshTrigger` prop so parent can force a log refresh |
| `frontend/src/app/(admin)/products/[id]/page.tsx` | Replaced mock `handlePush` with real `/api/push-trigger` call |
| `.env` | Added `N8N_BASE_URL` and `N8N_WEBHOOK_BASE` variables |

---

## 2. Background — What Is This Task About?

### Task Type
**Full-stack integration** — Backend (Python/FastAPI) + n8n workflow (JSON) + Frontend (TypeScript/React). No database changes.

### What Was Wrong Before This Task?

The "Push Now" button was **fake**. It didn't actually push anything to OPS. It just:
1. Wrote a fake push-log entry directly to the database
2. Made up a random `ops-prod-XXXX` ID (like `ops-prod-5234`)
3. Marked status as "pushed" even though nothing happened

```tsx
// BEFORE — mock (fake)
await api("/api/push-log", {
  method: "POST",
  body: JSON.stringify({
    product_id: product.id,
    customer_id: targetId,
    status: "pushed",
    ops_product_id: `ops-prod-${Math.floor(Math.random() * 9000) + 1000}`,  // ← fake!
  }),
});
```

This was intentional during early development — it let the UI be tested before the n8n workflow was ready. Task 6 fixed the n8n workflow. Task 8 wires them together.

---

## 3. How the Real Push Flow Works Now

```
User clicks "Push Now"
    ↓
Frontend calls POST /api/push-trigger
  { product_id: "abc-123", customer_id: "xyz-456" }
    ↓
FastAPI backend calls n8n webhook
  GET http://localhost:5678/webhook/ops-push
     ?customer_id=xyz-456&product_id=abc-123&limit=1
    ↓
n8n workflow runs (ops-push.json):
  Parse Params → Get Product → Build OPS Inputs
  → Set Category → Set Product → Set Sizes + Set Price
  → Write push-log entry (status: pushed or failed)
    ↓
n8n responds to backend (success or error)
    ↓
Backend returns 202 Accepted to frontend
    ↓
Frontend increments refreshTrigger
    ↓
PushHistory component re-fetches /api/push-log
    ↓
User sees real result in the history table
```

---

## 4. The Three New Pieces — Explained

### Piece 1 — POST /api/push-trigger (Backend)

New FastAPI endpoint. It's the bridge between the frontend and n8n.

```python
@router.post("/api/push-trigger", status_code=202)
async def trigger_push(body: PushTriggerRequest):
    webhook_base = os.getenv("N8N_WEBHOOK_BASE", "http://localhost:5678")
    url = f"{webhook_base}/webhook/ops-push"
    params = {
        "customer_id": str(body.customer_id),
        "product_id": str(body.product_id),
        "limit": "1",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return PushTriggerResponse(triggered=True, message="Push triggered — n8n workflow started.")
```

**Error handling:**
| Error | What Happens | HTTP Code |
|---|---|---|
| Docker not running | Returns "n8n is not reachable" | 503 |
| n8n takes too long | Returns "n8n did not respond in time" | 504 |
| n8n returns error | Returns "n8n returned an error: HTTP XXX" | 502 |
| Anything else | Returns "Unexpected error: ..." | 500 |

**Why status 202?** Because n8n runs asynchronously. We've accepted the job, not necessarily completed it. HTTP 202 = "Accepted, work in progress."

---

### Piece 2 — n8n Workflow: product_id Support

Before Task 8, the n8n workflow could only push **all products** for a customer at once. You couldn't say "just push this one product."

The Parse Params node was updated:

```js
// BEFORE — only list endpoint
const url = new URL(`${api_base}/api/products`);
url.searchParams.set('limit', String(limit));
products_url = url.toString();
// → fetches ALL products, processes them all

// AFTER — single product when product_id is given
if (product_id) {
  products_url = `${api_base}/api/products/${product_id}`;
  // → fetches ONE product, n8n processes it
} else {
  // original bulk behaviour unchanged
}
```

The `Explode Products` node already handled single objects (it checks `if (Array.isArray(j))` first, then falls back to `[j]` for single objects), so no change was needed there.

---

### Piece 3 — refreshTrigger Prop (Frontend)

**The problem:** After clicking Push Now, n8n writes the real push-log entry. But the PushHistory component only re-fetches when `productId` changes. If we navigate away and back, it refreshes. But not on the same page after a push.

**The fix:** Added `refreshTrigger?: number` prop to PushHistory. When the parent increments it, the component re-fetches.

```tsx
// In push-history.tsx:
useEffect(() => {
  fetchLogs();
}, [productId, refreshTrigger]);  // ← re-runs when refreshTrigger changes

// In the parent page:
const [pushRefresh, setPushRefresh] = useState(0);

const handlePush = async (...) => {
  await api("/api/push-trigger", { ... });
  setPushRefresh((n) => n + 1);  // ← increments after push completes
};

<PushHistory refreshTrigger={pushRefresh} ... />
```

This is a clean pattern — the parent controls when to refresh without needing to know PushHistory's internal implementation.

---

## 5. Environment Variables Added

Added to `.env` (root):

```
N8N_BASE_URL=http://localhost:5678
N8N_WEBHOOK_BASE=http://localhost:5678
```

**Why two variables?**
- `N8N_BASE_URL` — for the n8n REST API (management: list workflows, executions)
- `N8N_WEBHOOK_BASE` — for webhook triggers (different path in some deployments)

In development both point to the same place. In production, you might expose webhooks on a different domain.

---

## 6. Build Verification

Ran `npm run build` after the changes:

- ✅ TypeScript compiled successfully — no errors in our changed files
- ✅ No ESLint errors in `push-history.tsx` or `products/[id]/page.tsx`
- ⚠️ Pre-existing error in `/storefront/vg/page.tsx` (useSearchParams without Suspense) — pre-existing, confirmed in Task 7
- Warnings about `<img>` tags are pre-existing across the codebase

---

## 7. What Comes Next

| Next Task | What It Adds | Blocked? |
|---|---|---|
| **Task 5** — n8n smoke test | Manually test the full end-to-end push with real OPS credentials | 🔴 Yes — needs credentials from Christian |
| **Customers page** | UI to add/edit/delete customer storefronts | ❌ No |
| **Workflows page** | UI to view n8n workflow status and trigger pushes | ❌ No |
