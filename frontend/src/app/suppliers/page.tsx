"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Supplier } from "@/lib/types";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Supplier[]>("/api/suppliers")
      .then(setSuppliers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="screen active" id="s-suppliers">
      <div className="page-header">
        <div>
          <div className="page-title">Suppliers</div>
          <div className="page-subtitle">
            Manage PromoStandards supplier connections
          </div>
        </div>
        <button className="btn btn-primary">+ Add Supplier</button>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Registered Suppliers</div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--ink-muted)",
            }}
          >
            {suppliers.length} total
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
                <th>Name</th>
                <th>Slug</th>
                <th>Protocol</th>
                <th>PS Code</th>
                <th>Products</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--ink-muted)", padding: "48px" }}>
                    No suppliers yet. Add one to get started.
                  </td>
                </tr>
              )}
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="cell-primary">{s.name}</td>
                  <td className="cell-mono">{s.slug}</td>
                  <td>
                    <span className="cell-tag">{s.protocol}</span>
                  </td>
                  <td className="cell-mono">{s.promostandards_code ?? "—"}</td>
                  <td className="cell-mono">{s.product_count}</td>
                  <td>
                    {s.is_active ? (
                      <span className="badge badge-ok">
                        <span className="badge-dot"></span> Active
                      </span>
                    ) : (
                      <span className="badge badge-err">
                        <span className="badge-dot"></span> Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
