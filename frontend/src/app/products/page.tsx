"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ProductListItem } from "@/lib/types";

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    api<ProductListItem[]>(`/api/products${params}`)
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="screen active" id="s-products">
      <div className="page-header">
        <div>
          <div className="page-title">Product Catalog</div>
          <div className="page-subtitle">
            Browse and search synced supplier products
          </div>
        </div>
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => { setLoading(true); setSearch(e.target.value); }}
          style={{
            padding: "10px 16px",
            borderRadius: "5px",
            border: "1.5px solid var(--border)",
            fontFamily: "var(--font-head)",
            fontSize: "13px",
            background: "white",
            width: "240px",
          }}
        />
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Products</div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--ink-muted)",
            }}
          >
            {products.length} results
          </div>
        </div>

        {loading && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-muted)" }}>
            Loading...
          </div>
        )}

        {error && (
          <div style={{ padding: "24px", color: "var(--red)" }}>
            Error: {error}
          </div>
        )}

        {!loading && !error && (
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Brand</th>
                <th>Type</th>
                <th>Variants</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--ink-muted)", padding: "48px" }}>
                    No products found.
                  </td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p.id} style={{ cursor: "pointer" }}>
                  <td className="cell-primary">{p.product_name}</td>
                  <td className="cell-mono">{p.supplier_sku}</td>
                  <td>{p.brand ?? "—"}</td>
                  <td>
                    <span className="cell-tag">{p.product_type}</span>
                  </td>
                  <td className="cell-mono">{p.variant_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
