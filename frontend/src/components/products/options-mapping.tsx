"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STUB_MASTER_OPTIONS = [
  { id: "mo1", name: "Color", description: "Standard Apparel Colors" },
  { id: "mo2", name: "Size", description: "Standard S-3XL sizing" },
];

const STUB_SUPPLIER_VALUES = [
  { id: "v1", supplierValue: "Navy Blue", masterOptionId: "mo1" },
  { id: "v2", supplierValue: "True Navy", masterOptionId: "mo1" },
  { id: "v3", supplierValue: "Medium", masterOptionId: "mo2" },
  { id: "v4", supplierValue: "Midnight", masterOptionId: "" },
];

export function OptionsMapping() {
  const [mappings, setMappings] = useState<Record<string, string>>(
    STUB_SUPPLIER_VALUES.reduce((acc, v) => ({ ...acc, [v.id]: v.masterOptionId }), {})
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Attribute Normalization</div>
        <button onClick={() => alert("Mappings saved")} className="btn btn-primary" style={{ height: "32px", fontSize: "11px", padding: "0 16px" }}>
          Save Attributes
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Supplier Value (Raw)</th>
            <th style={{ textAlign: "center" }}>Current Alignment</th>
            <th>OPS Master Group</th>
          </tr>
        </thead>
        <tbody>
          {STUB_SUPPLIER_VALUES.map((v) => (
            <tr key={v.id}>
              <td className="cell-primary" style={{ color: "var(--blue)" }}>{v.supplierValue}</td>
              <td style={{ textAlign: "center" }}>
                {mappings[v.id] ? (
                  <span className="badge badge-ok" style={{ fontSize: "10px", fontWeight: 700 }}>
                    {STUB_MASTER_OPTIONS.find(mo => mo.id === mappings[v.id])?.name}
                  </span>
                ) : (
                  <span style={{ fontSize: "11px", color: "var(--ink-faint)", fontStyle: "italic" }}>Unmapped</span>
                )}
              </td>
              <td>
                <select 
                  value={mappings[v.id] || "none"}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMappings({ ...mappings, [v.id]: val === "none" ? "" : val });
                  }}
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
                  <option value="none">Choose Group...</option>
                  {STUB_MASTER_OPTIONS.map((mo) => (
                    <option key={mo.id} value={mo.id}>{mo.name}</option>
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
