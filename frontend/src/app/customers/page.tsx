"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Customer } from "@/lib/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function validateForm(f: { name: string; ops_base_url: string; ops_api_key: string }) {
  const err: Partial<typeof f> = {};
  if (!f.name.trim()) err.name = "Required";
  if (!f.ops_base_url.trim()) {
    err.ops_base_url = "Required";
  } else {
    try { new URL(f.ops_base_url); } catch { err.ops_base_url = "Must be a valid URL"; }
  }
  if (!f.ops_api_key.trim()) err.ops_api_key = "Required";
  return err;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      {[140, 220, 100, 70, 60, 120].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 rounded animate-pulse" style={{ width: w, background: "var(--paper-dark)" }} />
        </td>
      ))}
    </tr>
  );
}

function MaskedKey({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  if (!value) return <span style={{ color: "var(--ink-muted)" }}>—</span>;
  return (
    <button
      onClick={() => setShow((s) => !s)}
      title={show ? "Hide" : "Reveal"}
      className="font-mono text-xs px-2 py-0.5 rounded transition-colors"
      style={{ background: "var(--paper-dark)", color: "var(--ink-muted)", letterSpacing: show ? 0 : 3 }}
    >
      {show ? value : `••••${value.slice(-4)}`}
    </button>
  );
}

const TEST_LABEL: Record<string, string> = { idle: "Test", testing: "Testing…", ok: "Connected ✓", fail: "Failed ✗" };
const TEST_COLOR: Record<string, string> = {
  idle: "var(--ink-muted)", testing: "var(--blueprint)", ok: "var(--green)", fail: "var(--red)",
};

// ─── page ────────────────────────────────────────────────────────────────────

type FormState = { name: string; ops_base_url: string; ops_api_key: string };
const EMPTY_FORM: FormState = { name: "", ops_base_url: "", ops_api_key: "" };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // add form
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<FormState>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // per-row state
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [testState, setTestState] = useState<Record<string, "idle" | "testing" | "ok" | "fail">>({});

  useEffect(() => {
    api<Customer[]>("/api/customers")
      .then(setCustomers)
      .catch((e: Error) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── add ──────────────────────────────────────────────────────────────────

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setSaveError(null);
    setShowAdd(true);
  }

  async function handleSave() {
    const errs = validateForm(form);
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const c = await api<Customer>("/api/customers", { method: "POST", body: JSON.stringify(form) });
      setCustomers((prev) => [c, ...prev]);
      setShowAdd(false);
    } catch (e: any) {
      setSaveError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── edit ─────────────────────────────────────────────────────────────────

  function startEdit(c: Customer) {
    setEditId(c.id);
    setEditForm({ name: c.name, ops_base_url: c.ops_base_url, ops_api_key: c.ops_api_key });
  }

  async function handleEditSave() {
    if (!editId) return;
    setEditSaving(true);
    try {
      const updated = await api<Customer>(`/api/customers/${editId}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      setCustomers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditId(null);
    } catch (e: any) {
      alert(e.message ?? "Edit failed");
    } finally {
      setEditSaving(false);
    }
  }

  // ── delete ───────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("Delete this customer? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await api(`/api/customers/${id}`, { method: "DELETE" });
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    } catch (e: any) {
      alert(e.message ?? "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  // ── toggle active ────────────────────────────────────────────────────────

  async function handleToggle(c: Customer) {
    setToggling(c.id);
    try {
      const updated = await api<Customer>(`/api/customers/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !c.is_active }),
      });
      setCustomers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      alert(e.message ?? "Toggle failed");
    } finally {
      setToggling(null);
    }
  }

  // ── test connection ──────────────────────────────────────────────────────

  async function handleTest(id: string) {
    setTestState((t) => ({ ...t, [id]: "testing" }));
    try {
      await api(`/api/customers/${id}/test`, { method: "POST" });
      setTestState((t) => ({ ...t, [id]: "ok" }));
    } catch {
      setTestState((t) => ({ ...t, [id]: "fail" }));
    } finally {
      setTimeout(() => setTestState((t) => ({ ...t, [id]: "idle" })), 3500);
    }
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>Customers</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--ink-muted)" }}>
            OnPrintShop storefronts — {customers.length} configured
          </p>
        </div>
        {!showAdd && (
          <button
            onClick={openAdd}
            className="px-4 py-2 rounded-md text-sm font-semibold"
            style={{ background: "var(--blueprint)", color: "white" }}
          >
            + Add Customer
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-lg border p-6 mb-6" style={{ borderColor: "var(--border)", background: "white" }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
            New Customer
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            {([
              { key: "name" as const, label: "Store Name", type: "text", placeholder: "Acme Print Co." },
              { key: "ops_base_url" as const, label: "OPS Base URL", type: "url", placeholder: "https://store.example.com" },
              { key: "ops_api_key" as const, label: "API Key", type: "password", placeholder: "••••••••" },
            ]).map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="text-xs mb-1 block" style={{ color: "var(--ink-muted)" }}>{label}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => {
                    setForm({ ...form, [key]: e.target.value });
                    setFormErrors({ ...formErrors, [key]: undefined });
                  }}
                  className="w-full px-3 py-2 rounded-md text-sm outline-none"
                  style={{
                    border: `1px solid ${formErrors[key] ? "var(--red)" : "var(--border)"}`,
                    background: "var(--paper)",
                  }}
                />
                {formErrors[key] && (
                  <p className="text-xs mt-1" style={{ color: "var(--red)" }}>{formErrors[key]}</p>
                )}
              </div>
            ))}
          </div>

          {saveError && (
            <div className="text-xs mb-3 px-3 py-2 rounded"
              style={{ background: "rgba(185,50,50,0.08)", color: "var(--red)", fontFamily: "var(--font-mono)" }}>
              {saveError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-md text-sm font-semibold"
              style={{ background: "var(--blueprint)", color: "white", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : "Save Customer"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="text-sm px-4 py-2"
              style={{ color: "var(--ink-muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Fetch error banner */}
      {fetchError && (
        <div className="rounded-lg border px-4 py-3 mb-5 text-sm"
          style={{ borderColor: "var(--red)", color: "var(--red)", background: "rgba(185,50,50,0.06)" }}>
          Failed to load customers: {fetchError}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "white" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Store Name", "OPS URL", "API Key", "Added", "Status", "Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Loading skeletons */}
            {loading && [1, 2, 3].map((i) => <SkeletonRow key={i} />)}

            {/* Rows */}
            {!loading && customers.map((c) =>
              editId === c.id ? (
                // ── inline edit row ──────────────────────────────────────
                <tr key={c.id} style={{ borderTop: "1px solid var(--border)", background: "var(--bp-pale)" }}>
                  <td className="px-3 py-2">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-2 py-1 rounded text-sm outline-none"
                      style={{ border: "1px solid var(--border)", background: "white" }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={editForm.ops_base_url}
                      onChange={(e) => setEditForm({ ...editForm, ops_base_url: e.target.value })}
                      className="w-full px-2 py-1 rounded text-sm font-mono outline-none"
                      style={{ border: "1px solid var(--border)", background: "white" }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="password"
                      placeholder="Leave blank to keep current"
                      value={editForm.ops_api_key}
                      onChange={(e) => setEditForm({ ...editForm, ops_api_key: e.target.value })}
                      className="w-full px-2 py-1 rounded text-sm outline-none"
                      style={{ border: "1px solid var(--border)", background: "white" }}
                    />
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={handleEditSave}
                        disabled={editSaving}
                        className="text-xs px-3 py-1 rounded font-semibold"
                        style={{ background: "var(--blueprint)", color: "white", opacity: editSaving ? 0.6 : 1 }}
                      >
                        {editSaving ? "…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="text-xs px-2 py-1"
                        style={{ color: "var(--ink-muted)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                // ── normal row ───────────────────────────────────────────
                <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3">
                    <a
                      href={c.ops_base_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs hover:underline"
                      style={{ color: "var(--blueprint)" }}
                    >
                      {c.ops_base_url}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <MaskedKey value={c.ops_api_key} />
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
                    {fmt(c.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(c)}
                      disabled={toggling === c.id}
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{
                        color: c.is_active ? "var(--green)" : "var(--ink-muted)",
                        background: c.is_active ? "rgba(36,122,82,0.1)" : "var(--paper-dark)",
                        fontFamily: "var(--font-mono)",
                        opacity: toggling === c.id ? 0.5 : 1,
                        cursor: toggling === c.id ? "default" : "pointer",
                      }}
                    >
                      {toggling === c.id ? "…" : c.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 items-center">
                      <button
                        onClick={() => handleTest(c.id)}
                        disabled={testState[c.id] === "testing"}
                        className="text-xs font-semibold"
                        style={{ color: TEST_COLOR[testState[c.id] ?? "idle"], fontFamily: "var(--font-mono)" }}
                      >
                        {TEST_LABEL[testState[c.id] ?? "idle"]}
                      </button>
                      <span style={{ color: "var(--border)" }}>·</span>
                      <button
                        onClick={() => startEdit(c)}
                        className="text-xs"
                        style={{ color: "var(--ink-muted)" }}
                      >
                        Edit
                      </button>
                      <span style={{ color: "var(--border)" }}>·</span>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deleting === c.id}
                        className="text-xs"
                        style={{ color: "var(--red)", opacity: deleting === c.id ? 0.5 : 1 }}
                      >
                        {deleting === c.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}

            {/* Empty state */}
            {!loading && customers.length === 0 && !fetchError && (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <div className="text-3xl mb-3">🏪</div>
                  <div className="text-sm font-semibold mb-1" style={{ color: "var(--ink)" }}>
                    No customers configured
                  </div>
                  <div className="text-xs" style={{ color: "var(--ink-muted)" }}>
                    Add an OnPrintShop storefront above to start pushing products.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
