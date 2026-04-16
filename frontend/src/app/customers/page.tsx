"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Customer } from "@/lib/types";

interface CustomerWithCounts extends Customer {
  markup_rule_count: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Add customer form state ── */
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formTokenUrl, setFormTokenUrl] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [formClientSecret, setFormClientSecret] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    try {
      const data = await api<Customer[]>("/api/customers");
      // Fetch markup rule counts for each customer in parallel
      const withCounts = await Promise.all(
        data.map(async (c) => {
          try {
            const rules = await api<{ id: string }[]>(`/api/markup-rules/${c.id}`);
            return { ...c, markup_rule_count: rules.length };
          } catch {
            return { ...c, markup_rule_count: 0 };
          }
        })
      );
      setCustomers(withCounts);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormBaseUrl("");
    setFormTokenUrl("");
    setFormClientId("");
    setFormClientSecret("");
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSaving(true);
    setFormError(null);
    try {
      await api("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          name: formName,
          ops_base_url: formBaseUrl,
          ops_token_url: formTokenUrl,
          ops_client_id: formClientId,
          ops_client_secret: formClientSecret,
        }),
      });
      setShowForm(false);
      resetForm();
      setLoading(true);
      fetchCustomers();
    } catch {
      setFormError("Failed to save customer. Check your inputs and try again.");
    } finally {
      setFormSaving(false);
    }
  };

  // Extract just the hostname from a URL for display
  const hostname = (url: string) => {
    try { return new URL(url).hostname; } catch { return url; }
  };

  return (
    <div className="screen active" id="s-customers">
      <div className="page-header">
        <div>
          <div className="page-title">Customers</div>
          <div className="page-subtitle">OPS storefront configurations</div>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm((v) => !v); }}>
          + Add Customer
        </button>
      </div>

      {/* Inline Add Customer form */}
      {showForm && (
        <div style={{ marginBottom: "20px" }}>
          <div className="panel" style={{ borderColor: "var(--blue)", boxShadow: "0 0 0 3px rgba(30,77,146,0.07)" }}>
            <div className="panel-header">
              <div className="panel-title">New Customer — OPS OAuth2 Credentials</div>
              <span style={{ fontSize: "11px", color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
                Credentials are encrypted at rest (Fernet)
              </span>
            </div>
            <form onSubmit={handleSave} style={{ padding: "20px 24px", display: "grid", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label className="field-label">Store Name</label>
                  <input required type="text" className="input-control" placeholder="e.g. Acme Corp"
                    value={formName} onChange={(e) => setFormName(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">OPS Base URL</label>
                  <input required type="text" className="input-control"
                    placeholder="https://acme.onprintshop.com"
                    style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                    value={formBaseUrl} onChange={(e) => setFormBaseUrl(e.target.value)} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label className="field-label">OAuth2 Token URL</label>
                  <input required type="text" className="input-control"
                    placeholder="https://acme.onprintshop.com/oauth/token"
                    style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                    value={formTokenUrl} onChange={(e) => setFormTokenUrl(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Client ID</label>
                  <input required type="text" className="input-control"
                    placeholder="Client ID from OPS API settings"
                    style={{ fontFamily: "var(--font-mono)" }}
                    value={formClientId} onChange={(e) => setFormClientId(e.target.value)} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label className="field-label">
                    Client Secret{" "}
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--green)", background: "rgba(36,122,82,0.1)", padding: "2px 7px", borderRadius: "3px", marginLeft: "4px" }}>
                      encrypted
                    </span>
                  </label>
                  <input required type="password" className="input-control"
                    placeholder="Client Secret from OPS API settings"
                    style={{ fontFamily: "var(--font-mono)" }}
                    value={formClientSecret} onChange={(e) => setFormClientSecret(e.target.value)} />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", paddingBottom: "1px" }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={formSaving}>
                    {formSaving ? "Saving…" : "Save Customer"}
                  </button>
                  <button type="button" className="btn" onClick={() => setShowForm(false)}
                    style={{ border: "1.5px solid var(--border)" }}>
                    Cancel
                  </button>
                </div>
              </div>
              <div style={{ padding: "10px 14px", background: "var(--blue-pale)", border: "1px solid rgba(30,77,146,0.15)", borderRadius: "6px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "12px", color: "var(--blue)" }}>
                  These credentials are used by the <strong>n8n-nodes-onprintshop</strong> node to authenticate with each customer's OPS storefront during the push workflow.
                </span>
              </div>
              {formError && (
                <div style={{ fontSize: "13px", color: "var(--red)" }}>{formError}</div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Customers table */}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>OPS Base URL</th>
              <th>Auth</th>
              <th>Products Pushed</th>
              <th>Markup Rules</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--ink-muted)", padding: "48px" }}>
                  Loading…
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={6} style={{ padding: "24px", color: "var(--red)" }}>
                  Error: {error}
                </td>
              </tr>
            )}
            {!loading && !error && customers.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--ink-muted)", padding: "48px" }}>
                  No customers yet. Add a storefront to get started.
                </td>
              </tr>
            )}
            {!loading && !error && customers.map((c) => (
              <tr key={c.id}>
                <td className="cell-primary">{c.name}</td>
                <td className="cell-mono" style={{ fontSize: "11px" }}>{hostname(c.ops_base_url)}</td>
                <td>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--blue)", background: "var(--blue-pale)", padding: "2px 7px", borderRadius: "3px", fontFamily: "var(--font-mono)" }}>
                    OAuth2
                  </span>
                </td>
                <td className="cell-mono">—</td>
                <td className="cell-mono">
                  {c.markup_rule_count} {c.markup_rule_count === 1 ? "rule" : "rules"}
                </td>
                <td>
                  {c.is_active ? (
                    <span className="badge badge-ok"><span className="badge-dot"></span> Active</span>
                  ) : (
                    <span className="badge badge-err"><span className="badge-dot"></span> Inactive</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
