"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const STUB_CATEGORIES = [
  { id: "c1", name: "T-Shirts" },
  { id: "c2", name: "Polos" },
  { id: "c3", name: "Outerwear" },
];

const STUB_PRODUCTS = [
  { id: "p1", name: "Port & Company Essential Tee", sku: "PC61", currentCategory: "c1" },
  { id: "p2", name: "Port Authority Silk Touch Polo", sku: "K500", currentCategory: "" },
];

export function CategoryAssign() {
  const [mappings, setMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial = STUB_PRODUCTS.reduce((acc, p) => {
      acc[p.id] = p.currentCategory;
      return acc;
    }, {} as Record<string, string>);
    setMappings(initial);
  }, []);

  const handleSave = () => {
    // TODO(ops-config): Hook up to POST /api/ops/{customer_id}/category-mappings
    console.log("Saving category mappings:", mappings);
    alert("Mapping saved (mock)");
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Category Assignment</div>
        <button onClick={handleSave} className="btn btn-primary" style={{ height: "32px", fontSize: "11px", padding: "0 16px" }}>
          Save Mappings
        </button>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Synced Product Name</th>
            <th>System SKU</th>
            <th>OPS Storefront Category</th>
          </tr>
        </thead>
        <tbody>
          {STUB_PRODUCTS.map((p) => (
            <tr key={p.id}>
              <td className="cell-primary">{p.name}</td>
              <td className="cell-mono">
                <span className="cell-tag">{p.sku}</span>
              </td>
              <td>
                <select
                  value={mappings[p.id] || "none"}
                  onChange={(e) => setMappings({ ...mappings, [p.id]: e.target.value })}
                  style={{
                    width: "100%",
                    height: "36px",
                    background: "var(--vellum)",
                    border: "1.5px solid var(--border)",
                    borderRadius: "6px",
                    padding: "0 12px",
                    fontSize: "13px",
                    color: "var(--ink)",
                    fontFamily: "var(--font-head)",
                    cursor: "pointer",
                    outline: "none",
                    fontWeight: 500
                  }}
                >
                  <option value="none">Unassigned</option>
                  {STUB_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
