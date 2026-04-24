"""Proxy endpoints for n8n — lets the Next.js frontend browse + trigger
workflows without exposing the n8n API key to the browser.

All routes authenticate upstream via `N8N_API_KEY` and return condensed
JSON shapes suitable for UI consumption.
"""
import os
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/n8n", tags=["n8n-proxy"])


def _key() -> str:
    value = os.getenv("N8N_API_KEY")
    if not value:
        raise HTTPException(500, "N8N_API_KEY not configured")
    return value


def _base() -> str:
    return os.getenv("N8N_BASE_URL", "http://localhost:5678").rstrip("/")


def _webhook_base() -> str:
    return os.getenv("N8N_WEBHOOK_BASE", _base()).rstrip("/")


async def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=_base(),
        headers={"X-N8N-API-KEY": _key()},
        timeout=15.0,
    )


@router.get("/workflows")
async def list_workflows():
    async with await _client() as c:
        r = await c.get("/api/v1/workflows", params={"limit": 50})
        r.raise_for_status()
        body = r.json()

    out = []
    for w in body.get("data", []):
        nodes = w.get("nodes", [])
        webhook_nodes = [n for n in nodes if n.get("type") == "n8n-nodes-base.webhook"]
        webhook_paths = [
            n.get("parameters", {}).get("path") for n in webhook_nodes
        ]
        webhook_paths = [p for p in webhook_paths if p]
        trigger_names = [
            n.get("name") for n in nodes
            if "trigger" in n.get("type", "").lower()
               or n.get("type") == "n8n-nodes-base.webhook"
        ]
        out.append({
            "id": w["id"],
            "name": w.get("name"),
            "active": w.get("active", False),
            "updatedAt": w.get("updatedAt"),
            "triggers": trigger_names,
            "webhook_url": f"{_webhook_base()}/webhook/{webhook_paths[0]}" if webhook_paths else None,
            "node_count": len(nodes),
        })
    return out


@router.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str):
    async with await _client() as c:
        r = await c.get(f"/api/v1/workflows/{workflow_id}")
        if r.status_code == 404:
            raise HTTPException(404, "Workflow not found")
        r.raise_for_status()
        return r.json()


@router.get("/executions")
async def list_executions(workflow_id: Optional[str] = None, limit: int = 20):
    params: dict = {"limit": limit}
    if workflow_id:
        params["workflowId"] = workflow_id
    async with await _client() as c:
        r = await c.get("/api/v1/executions", params=params)
        r.raise_for_status()
        body = r.json()

    return [
        {
            "id": e.get("id"),
            "workflowId": e.get("workflowId"),
            "status": e.get("status"),
            "startedAt": e.get("startedAt"),
            "stoppedAt": e.get("stoppedAt"),
            "finished": e.get("finished"),
            "mode": e.get("mode"),
        }
        for e in body.get("data", [])
    ]


@router.post("/workflows/{workflow_id}/trigger")
async def trigger_workflow(workflow_id: str, body: Optional[dict] = None):
    """Trigger workflow via its first webhook path.

    n8n public API has no sync "run"; workflow must have an active webhook
    trigger. We look it up and GET it.

    Optional JSON body is forwarded as webhook query params. Example:
        POST /api/n8n/workflows/ops-push-001/trigger
        { "product_id": "abc", "customer_id": "xyz" }
    becomes:
        GET /webhook/ops-push?product_id=abc&customer_id=xyz
    """
    async with await _client() as c:
        r = await c.get(f"/api/v1/workflows/{workflow_id}")
        if r.status_code == 404:
            raise HTTPException(404, "Workflow not found")
        r.raise_for_status()
        w = r.json()

    if not w.get("active"):
        raise HTTPException(409, f"Workflow '{w.get('name')}' is not active")

    webhook_path = None
    for n in w.get("nodes", []):
        if n.get("type") == "n8n-nodes-base.webhook":
            webhook_path = n.get("parameters", {}).get("path")
            break

    if not webhook_path:
        raise HTTPException(
            409, f"Workflow '{w.get('name')}' has no webhook trigger"
        )

    trigger_url = f"{_webhook_base()}/webhook/{webhook_path}"
    # Forward body fields as query params so the webhook's Parse Params node can read them
    params = {k: str(v) for k, v in (body or {}).items() if v is not None}

    try:
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.get(trigger_url, params=params)
            r.raise_for_status()
            try:
                response_data = r.json()
            except ValueError:
                response_data = r.text
            return {"triggered": True, "url": trigger_url, "response": response_data}
    except httpx.ConnectError:
        raise HTTPException(
            503,
            "n8n webhook is not reachable. Make sure Docker is running and n8n is up on port 5678.",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            504, "n8n webhook timed out. The workflow may still be running."
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            502, f"n8n returned an error: HTTP {exc.response.status_code}"
        )
