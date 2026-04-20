"""REST protocol adapter — S&S Activewear and other JSON-over-HTTP suppliers.

Mirrors the role of PromoStandardsClient but for REST APIs. The base URL and
credentials come from the Supplier row (supplier.base_url, supplier.auth_config);
nothing is hardcoded, so adding another REST supplier is a config change.

S&S uses HTTP Basic Auth with (account_number, api_key) — those keys must be
present in supplier.auth_config. Sinchana's normalizer (Task 8a, `ss_normalizer.py`)
maps the raw JSON into PSProductData so the canonical `upsert_products()` path
works unchanged.
"""

import httpx


class RESTConnectorClient:
    """Supplier-agnostic REST client for JSON-over-HTTP catalog APIs."""

    def __init__(self, base_url: str, auth_config: dict):
        if not base_url:
            raise ValueError("base_url is required")
        self.base_url = base_url.rstrip("/")

        try:
            self.auth = (auth_config["account_number"], auth_config["api_key"])
        except KeyError as missing:
            raise ValueError(
                f"auth_config missing required key {missing}; "
                "expected 'account_number' and 'api_key'"
            ) from None

    async def _get(self, path: str) -> list[dict]:
        async with httpx.AsyncClient(auth=self.auth, timeout=60.0) as client:
            resp = await client.get(f"{self.base_url}{path}")
            resp.raise_for_status()
            return resp.json()

    async def get_products(self) -> list[dict]:
        """Full product catalog. S&S: GET /Products/ → JSON array."""
        return await self._get("/Products/")

    async def get_styles(self) -> list[dict]:
        """Styles with color/size variants. S&S: GET /Styles/."""
        return await self._get("/Styles/")

    async def get_categories(self) -> list[dict]:
        """Category hierarchy. S&S: GET /Categories/."""
        return await self._get("/Categories/")
