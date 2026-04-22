"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { ProductListItem, Supplier, Category } from "@/lib/types";
import { useSearch } from "@/components/storefront/search-context";
import { FilterButton } from "@/components/storefront/filter-button";
import { ActiveFilterChips } from "@/components/storefront/active-filter-chips";
import { StorefrontProductCard } from "@/components/storefront/storefront-product-card";
import { LeftRail } from "@/components/storefront/left-rail";
import { MobileFilterSheet } from "@/components/storefront/mobile-filter-sheet";

const VG_SLUG = "vg-ops";

export default function VGStorefrontPage() {
  const { filters } = useSearch();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const sups = await api<Supplier[]>("/api/suppliers");
        const vg = sups.find((s) => s.slug === VG_SLUG) || sups[0] || null;
        setSupplier(vg);
        if (!vg) return;

        const [prods, cats] = await Promise.all([
          api<ProductListItem[]>(`/api/products?supplier_id=${vg.id}&limit=500`),
          api<Category[]>(`/api/categories?supplier_id=${vg.id}`),
        ]);

        setProducts(prods);
        setCategories(cats);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Calculate per-category counts for the LeftRail
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      if (p.category_id) map[p.category_id] = (map[p.category_id] || 0) + 1;
    });
    return map;
  }, [products]);

  const visible = useMemo(() => {
    let rows = products;
    
    // 1. Category Filter
    if (filters.category) {
      rows = rows.filter((p) => p.category_id === filters.category);
    }
    
    // 2. Search Query
    if (filters.q) {
      const q = filters.q.toLowerCase();
      rows = rows.filter(
        (p) => p.product_name.toLowerCase().includes(q) || 
               p.supplier_sku.toLowerCase().includes(q) ||
               (p.brand ?? "").toLowerCase().includes(q),
      );
    }
    
    // 3. Stock Filter
    if (filters.stock === "in") {
      rows = rows.filter((p) => (p.total_inventory ?? 0) > 0);
    }
    
    // 4. Sorting
    const sorted = [...rows];
    switch (filters.sort) {
      case "price_asc":
        sorted.sort((a, b) => (a.price_min ?? Infinity) - (b.price_min ?? Infinity));
        break;
      case "price_desc":
        sorted.sort((a, b) => (b.price_max ?? -Infinity) - (a.price_max ?? -Infinity));
        break;
      case "newest":
        sorted.reverse();
        break;
      case "variants":
        sorted.sort((a, b) => (b.variant_count ?? 0) - (a.variant_count ?? 0));
        break;
      default:
        sorted.sort((a, b) => a.product_name.localeCompare(b.product_name));
    }
    return sorted;
  }, [products, filters]);

  return (
    <div className="flex min-h-screen bg-[#f2f0ed]">
      {/* 1. Left Rail (Desktop) */}
      <div className="hidden md:block">
        <LeftRail categories={categories} counts={counts} />
      </div>

      <div className="flex-1 flex flex-col p-5 gap-5 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="text-[13px] text-[#888894] font-mono">
            {loading ? "Loading…" : `${visible.length} / ${products.length} products`}
          </div>
          <FilterButton />
        </div>

        <ActiveFilterChips />

        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[340px] bg-[#f9f7f4] border border-[#ebe8e3] rounded-[10px] animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="border border-dashed border-[#cfccc8] rounded-[10px] p-16 text-center bg-white">
            <div className="text-[14px] font-bold text-[#1e1e24] mb-1">No matches</div>
            <div className="text-[12px] text-[#888894]">
              Try removing filters or clearing the search.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
            {visible.map((p) => (
              <StorefrontProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>

      {/* 3. Mobile Filter FAB + Sheet */}
      <MobileFilterSheet categories={categories} counts={counts} />
    </div>
  );
}
