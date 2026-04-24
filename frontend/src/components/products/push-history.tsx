"use client";

/**
 * PushHistory
 * -----------
 * Shows the full push-log history for a single product plus per-customer
 * push buttons.  Designed to drop into the product detail page.
 *
 * Props
 *   productId  — UUID of the product whose history to show
 *   customers  — list of configured customers (for push buttons)
 *   pushing    — customer_id currently being pushed (or null)
 *   onPush     — callback when user clicks "Push Now"
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface PushLogEntry {
  id: string;
  product_id: string;
  customer_id: string;
  customer_name: string | null;
  ops_product_id: string | null;
  status: string;
  error: string | null;
  pushed_at: string;
}

interface Customer {
  id: string;
  name: string;
}

interface Props {
  productId: string;
  customers: Customer[];
  pushing: string | null;
  onPush: (customerId: string) => void;
}

/* ── Status badge ───────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  if (status === "pushed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full bg-[#f0f9f4] text-[#247a52]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#247a52]" />
        Published
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full bg-[#fdf2f2] text-[#b93232]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#b93232]" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full bg-[#f9f7f4] text-[#888894]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#b4b4bc]" />
      Pending
    </span>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export function PushHistory({ productId, customers, pushing, onPush }: Props) {
  const [logs, setLogs] = useState<PushLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch global push log and filter by this product client-side.
      // Limit 200 to cover all recent activity without overloading.
      const all = await api<PushLogEntry[]>("/api/push-log?limit=200");
      const filtered = all.filter((entry) => entry.product_id === productId);
      // Sort newest first
      filtered.sort(
        (a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime()
      );
      setLogs(filtered);
    } catch (e) {
      setError("Could not load push history. Is the backend running?");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [productId]);

  // Latest status per customer (for the "current status" summary row)
  const latestPerCustomer = customers.map((customer) => {
    const customerLogs = logs.filter((l) => l.customer_id === customer.id);
    const latest = customerLogs[0] ?? null;
    return { customer, latest };
  });

  return (
    <div className="space-y-6">

      {/* ── Current status per storefront ──────────────────────────────── */}
      <div className="bg-white border border-[#cfccc8] rounded-lg shadow-[4px_6px_0_rgba(30,77,146,0.08)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#ebe8e3] border-b border-[#cfccc8]">
          <div className="text-[14px] font-bold uppercase tracking-[0.05em] text-[#1e1e24]">
            Storefront Publish Status
          </div>
          <button
            onClick={fetchLogs}
            className="text-[11px] font-semibold text-[#888894] hover:text-[#1e4d92] transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr>
                {["Storefront", "Status", "Last Pushed", "OPS Product ID", "Action"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#888894] border-b border-[#cfccc8]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {latestPerCustomer.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-5 text-center text-[#888894] text-[13px]">
                    No customers configured. Add one in the Customers page to enable pushing.
                  </td>
                </tr>
              ) : (
                latestPerCustomer.map(({ customer, latest }) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-[rgba(30,77,146,0.05)] transition-colors"
                  >
                    <td className="px-6 py-[14px] text-[14px] text-[#1e1e24] font-semibold border-b border-[#f9f7f4]">
                      {customer.name}
                    </td>
                    <td className="px-6 py-[14px] border-b border-[#f9f7f4]">
                      <StatusBadge status={latest?.status ?? "not_pushed"} />
                    </td>
                    <td className="px-6 py-[14px] font-mono text-[12px] text-[#484852] border-b border-[#f9f7f4]">
                      {latest?.pushed_at
                        ? new Date(latest.pushed_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-6 py-[14px] font-mono text-[12px] text-[#484852] border-b border-[#f9f7f4]">
                      {latest?.ops_product_id || "—"}
                    </td>
                    <td className="px-6 py-[14px] border-b border-[#f9f7f4]">
                      <button
                        onClick={() => onPush(customer.id)}
                        disabled={pushing === customer.id}
                        className="px-3 py-1 text-[11px] font-semibold bg-white border border-[#cfccc8] rounded
                                   shadow-[0_2px_0_rgba(30,77,146,0.08)] hover:border-[#1e4d92] transition-all
                                   disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {pushing === customer.id ? "..." : "Push Now"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Full push log history ───────────────────────────────────────── */}
      <div className="bg-white border border-[#cfccc8] rounded-lg shadow-[4px_6px_0_rgba(30,77,146,0.08)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#ebe8e3] border-b border-[#cfccc8]">
          <div className="text-[14px] font-bold uppercase tracking-[0.05em] text-[#1e1e24]">
            Push Log History
          </div>
          <span className="font-mono text-[11px] text-[#888894]">
            {loading ? "LOADING..." : `${logs.length} ENTRIES`}
          </span>
        </div>

        {error && (
          <div className="px-6 py-4 text-[13px] text-[#b93232] bg-[#fdf2f2] border-b border-[#cfccc8]">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr>
                {["Storefront", "Status", "When", "OPS Product ID", "Error"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#888894] border-b border-[#cfccc8]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-5 text-center text-[#888894] text-[13px] font-mono">
                    Loading push history...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-5 text-center text-[#888894] text-[13px]">
                    No push history yet. Click &quot;Push Now&quot; above to publish this product.
                  </td>
                </tr>
              ) : (
                logs.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-[rgba(30,77,146,0.05)] transition-colors"
                  >
                    <td className="px-6 py-[12px] text-[13px] text-[#1e1e24] font-semibold border-b border-[#f9f7f4]">
                      {entry.customer_name || "Unknown"}
                    </td>
                    <td className="px-6 py-[12px] border-b border-[#f9f7f4]">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-6 py-[12px] font-mono text-[12px] text-[#484852] border-b border-[#f9f7f4]">
                      {new Date(entry.pushed_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-[12px] font-mono text-[12px] text-[#484852] border-b border-[#f9f7f4]">
                      {entry.ops_product_id || "—"}
                    </td>
                    <td className="px-6 py-[12px] text-[12px] border-b border-[#f9f7f4]">
                      {entry.error ? (
                        <span
                          className="text-[#b93232] font-mono truncate block max-w-[240px]"
                          title={entry.error}
                        >
                          {entry.error.length > 60
                            ? entry.error.substring(0, 60) + "…"
                            : entry.error}
                        </span>
                      ) : (
                        <span className="text-[#b4b4bc]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
