"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STUB_PRODUCTS = [
  { id: "p1", name: "Port & Company Essential Tee", basePrice: 3.79, category: "Apparel" },
  { id: "p2", name: "Port Authority Silk Touch Polo", basePrice: 12.50, category: "Apparel" },
  { id: "p3", name: "Alternative Eco-Jersey Crew", basePrice: 8.95, category: "Sustainable" },
];

export function PricingPreview() {
  const [selectedId, setSelectedId] = useState(STUB_PRODUCTS[0].id);
  const product = STUB_PRODUCTS.find(p => p.id === selectedId)!;

  // Mocking the calculation that Tanishq will eventually wire to the real pricing engine
  const markupMultiplier = 1.4; // 40% markup example
  const markupPrice = product.basePrice * markupMultiplier;
  const roundingAdjustment = 0.05; // Example rounding to nearest .99 or .95
  const finalPrice = Math.ceil(markupPrice * 1) - 0.01;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Pricing Engine Preview</div>
        </div>
        <div style={{ padding: "24px", display: "flex", alignItems: "center", gap: "16px", background: "var(--vellum)" }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Select Product to Preview</label>
            <select 
              value={selectedId} 
              onChange={(e) => setSelectedId(e.target.value)}
              style={{
                width: "100%",
                height: "42px",
                background: "white",
                border: "1.5px solid var(--border)",
                borderRadius: "6px",
                padding: "0 12px",
                fontSize: "15px",
                color: "var(--ink)",
                fontFamily: "var(--font-head)",
                cursor: "pointer",
                outline: "none",
                fontWeight: 600
              }}
            >
              {STUB_PRODUCTS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="badge badge-ok">
              <span className="badge-dot"></span> Standard Apparel Rule (40%)
            </span>
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Supplier Cost</div>
          <div className="stat-value" style={{ color: "var(--ink-muted)" }}>${product.basePrice.toFixed(2)}</div>
          <div className="stat-note" style={{ color: "var(--ink-faint)" }}>Wholesale Baseline</div>
        </div>
        
        <div className="stat-card" style={{ borderColor: "var(--blue)" }}>
          <div className="stat-label">Calculated Markup</div>
          <div className="stat-value">${markupPrice.toFixed(2)}</div>
          <div className="stat-note" style={{ color: "var(--blue)" }}>+40% Margin Applied</div>
        </div>

        <div className="stat-card" style={{ borderColor: "var(--green)", background: "var(--green-pale)" }}>
          <div className="stat-label">Storefront Price</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>${finalPrice.toFixed(2)}</div>
          <div className="stat-note">
            <span className="badge badge-ok">Ready to Sync</span>
          </div>
        </div>
      </div>

      <div className="panel" style={{ borderColor: "var(--orange)", background: "rgba(199, 125, 46, 0.05)" }}>
        <div style={{ padding: "16px 24px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
          <div style={{ 
            width: "32px", 
            height: "32px", 
            borderRadius: "4px", 
            background: "var(--orange)", 
            color: "white", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            fontWeight: "bold",
            flexShrink: 0
          }}>!</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--orange)", textTransform: "uppercase", marginBottom: "4px" }}>System Note</div>
            <div style={{ fontSize: "13px", color: "var(--ink-light)" }}>
              This is a real-time preview of the OnPrintShop push pipeline. To adjust global markups, edit the <strong>Pricing Rules</strong> configuration.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
