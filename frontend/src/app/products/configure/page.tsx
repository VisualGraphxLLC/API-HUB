"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryAssign } from "@/components/products/category-assign";
import { OptionsMapping } from "@/components/products/options-mapping";
import { PricingPreview } from "@/components/products/pricing-preview";
import { Separator } from "@/components/ui/separator";

export default function ConfigureProductsPage() {
  const [activeTab, setActiveTab] = useState("categories");

  return (
    <div className="screen active" id="s-product-setup">
      <div className="page-header">
        <div>
          <div className="page-title">Storefront Product Setup</div>
          <div className="page-subtitle">Map warehouse data to OnPrintShop storefront configurations</div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button 
            className={`btn ${activeTab === "categories" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("categories")}
          >
            Categories
          </button>
          <button 
            className={`btn ${activeTab === "options" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("options")}
          >
            Options
          </button>
          <button 
            className={`btn ${activeTab === "pricing" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("pricing")}
          >
            Pricing Logic
          </button>
        </div>
      </div>

      <div style={{ animation: "slideUp 0.3s ease-out" }}>
        {activeTab === "categories" && <CategoryAssign />}
        {activeTab === "options" && <OptionsMapping />}
        {activeTab === "pricing" && <PricingPreview />}
      </div>

      <div style={{ 
        marginTop: "40px", 
        padding: "20px", 
        borderTop: "1px dashed var(--border)", 
        textAlign: "center",
        fontSize: "11px",
        color: "var(--ink-faint)",
        fontFamily: "var(--font-mono)"
      }}>
        TODO(ops-config): API PERSISTENCE PENDING VERIFICATION // V1.0-BETA
      </div>
    </div>
  );
}
