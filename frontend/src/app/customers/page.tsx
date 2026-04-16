"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", ops_base_url: "", ops_api_key: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Customer[]>("/api/customers").then(setCustomers).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const c = await api<Customer>("/api/customers", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setCustomers([c, ...customers]);
      setShowAdd(false);
      setForm({ name: "", ops_base_url: "", ops_api_key: "" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>Customers</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--ink-muted)" }}>OnPrintShop storefronts</p>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-md text-sm font-semibold"
            style={{ background: "var(--blueprint)", color: "white" }}
          >
            + Add Customer
          </button>
        )}
      </div>

      {showAdd && (
        <div className="rounded-lg border p-6 mb-6" style={{ borderColor: "var(--border)", background: "white" }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
            New Customer
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { key: "name", label: "Store Name", type: "text" },
              { key: "ops_base_url", label: "OPS Base URL", type: "url" },
              { key: "ops_api_key", label: "API Key", type: "password" },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="text-xs mb-1 block" style={{ color: "var(--ink-muted)" }}>{label}</label>
                <input
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full px-3 py-2 rounded-md text-sm outline-none"
                  style={{ border: "1px solid var(--border)", background: "var(--paper)" }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-md text-sm font-semibold"
              style={{ background: "var(--blueprint)", color: "white", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setShowAdd(false)} className="text-sm px-4 py-2" style={{ color: "var(--ink-muted)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "white" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Name", "OPS URL", "Status"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-4 py-3 font-semibold">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--blueprint)" }}>{c.ops_base_url}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-semibold" style={{ color: c.is_active ? "var(--green)" : "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
                    {c.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
                  No customers configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
