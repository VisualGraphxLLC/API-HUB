"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Customer } from "@/lib/types";

// shadcn UI components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

// ─── helpers ─────────────────────────────────────────────────────────────────

function validateForm(f: FormState) {
  const err: Partial<Record<keyof FormState, string>> = {};
  if (!f.name.trim())            err.name            = "Required";
  if (!f.ops_base_url.trim())    err.ops_base_url    = "Required";
  else { try { new URL(f.ops_base_url); } catch { err.ops_base_url = "Must be a valid URL"; } }
  if (!f.ops_token_url.trim())   err.ops_token_url   = "Required";
  else { try { new URL(f.ops_token_url); } catch { err.ops_token_url = "Must be a valid URL"; } }
  if (!f.ops_client_id.trim())   err.ops_client_id   = "Required";
  if (!f.ops_client_secret.trim()) err.ops_client_secret = "Required";
  return err;
}

function hostname(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <TableRow>
      {[160, 180, 70, 80, 90, 70].map((w, i) => (
        <TableCell key={i}>
          <div className="h-4 rounded animate-pulse bg-muted" style={{ width: w }} />
        </TableCell>
      ))}
    </TableRow>
  );
}

function Field({
  label, field, type = "text", placeholder, value, onChange, error,
}: {
  label: string;
  field: keyof FormState;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </label>
      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${error ? "border-red-500 focus-visible:ring-red-500" : ""} ${type === "password" ? "font-mono" : ""}`}
      />
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}

// ─── types ───────────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  ops_base_url: string;
  ops_token_url: string;
  ops_client_id: string;
  ops_client_secret: string;
};

const EMPTY_FORM: FormState = {
  name: "", ops_base_url: "", ops_token_url: "", ops_client_id: "", ops_client_secret: "",
};

// ─── page ────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);

  const [toggling, setToggling]     = useState<string | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);

  useEffect(() => {
    api<Customer[]>("/api/customers")
      .then(setCustomers)
      .catch((e: Error) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function setField(key: keyof FormState) {
    return (v: string) => {
      setForm((f) => ({ ...f, [key]: v }));
      setFormErrors((e) => ({ ...e, [key]: undefined }));
    };
  }

  async function handleSave() {
    const errs = validateForm(form);
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true); setSaveError(null);
    try {
      const c = await api<Customer>("/api/customers", { method: "POST", body: JSON.stringify(form) });
      setCustomers((prev) => [c, ...prev]);
      setShowAdd(false);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      setSaveError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(c: Customer) {
    setToggling(c.id);
    try {
      const updated = await api<Customer>(`/api/customers/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !c.is_active }),
      });
      setCustomers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) { alert(e.message ?? "Failed"); }
    finally { setToggling(null); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this storefront?")) return;
    setDeleting(id);
    try {
      await api(`/api/customers/${id}`, { method: "DELETE" });
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    } catch (e: any) { alert(e.message ?? "Delete failed"); }
    finally { setDeleting(null); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Storefronts</h1>
          <p className="text-sm text-muted-foreground mt-1">OnPrintShop storefront configurations</p>
        </div>
        {!showAdd && (
          <Button onClick={() => { setShowAdd(true); setSaveError(null); setFormErrors({}); }}>
            + Add Storefront
          </Button>
        )}
      </div>

      <Separator />

      {/* Add form */}
      {showAdd && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">New Storefront</CardTitle>
            <CardDescription>Connect a new OnPrintShop instance via OAuth2</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Store Name" field="name" placeholder="Acme Corp Store" value={form.name} onChange={setField("name")} error={formErrors.name} />
              <Field label="OPS GraphQL URL" field="ops_base_url" placeholder="https://acme.onprintshop.com/graphql" value={form.ops_base_url} onChange={setField("ops_base_url")} error={formErrors.ops_base_url} type="url" />
              <Field label="OAuth Token URL" field="ops_token_url" placeholder="https://acme.onprintshop.com/oauth/token" value={form.ops_token_url} onChange={setField("ops_token_url")} error={formErrors.ops_token_url} type="url" />
              <Field label="Client ID" field="ops_client_id" placeholder="client_id" value={form.ops_client_id} onChange={setField("ops_client_id")} error={formErrors.ops_client_id} />
              <Field label="Client Secret" field="ops_client_secret" placeholder="••••••••" value={form.ops_client_secret} onChange={setField("ops_client_secret")} error={formErrors.ops_client_secret} type="password" />
            </div>

            <p className="text-xs text-muted-foreground">
              You can find these credentials in your OnPrintShop admin panel under Settings &gt; API.
            </p>

            {saveError && (
              <div className="text-sm text-red-500 font-medium p-3 bg-red-50 dark:bg-red-950/50 rounded-md">
                {saveError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Storefront"}
              </Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="text-sm text-red-500 font-medium p-4 border border-red-200 bg-red-50 rounded-lg">
          Failed to load storefronts: {fetchError}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store Name</TableHead>
              <TableHead>OPS URL</TableHead>
              <TableHead>Auth</TableHead>
              <TableHead>Products Published</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[150px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && [1, 2, 3].map((i) => <SkeletonRow key={i} />)}

            {!loading && customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.name}
                </TableCell>
                <TableCell>
                  <a href={c.ops_base_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {hostname(c.ops_base_url)}
                  </a>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono text-xs">OAuth2</Badge>
                </TableCell>
                <TableCell className="font-mono">
                  {c.products_pushed.toLocaleString()}
                </TableCell>
                <TableCell>
                  {c.is_active ? (
                    <Badge variant="default" className="bg-green-600 hover:bg-green-700">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleToggle(c)}
                      disabled={toggling === c.id}
                      className={c.is_active ? "text-muted-foreground" : "text-blue-600"}
                    >
                      {toggling === c.id ? "…" : c.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(c.id)}
                      disabled={deleting === c.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {deleting === c.id ? "…" : "Delete"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {!loading && customers.length === 0 && !fetchError && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <p className="text-sm text-muted-foreground">
                    No storefronts added. Add your OnPrintShop storefront to start publishing products.
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
