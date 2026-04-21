"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { ProductListItem, Supplier } from "@/lib/types";
import { StorefrontProductCard } from "@/components/storefront/storefront-product-card";
import { FilterChipBar } from "@/components/storefront/filter-chip-bar";
import { useSearch } from "@/components/storefront/search-context";

const VG_SLUG = "vg-ops";

export default function VGStorefrontPage() {
  const { query } = useSearch();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<"name" | "nameDesc" | "variants">("name");

  useEffect(() => {
    (async () => {
      try {
        const sups = await api<Supplier[]>("/api/suppliers");
        const vg = sups.find((s) => s.slug === VG_SLUG) ?? null;
        setSupplier(vg);
        if (!vg) return;
        const prods = await api<ProductListItem[]>(`/api/products?supplier_id=${vg.id}&limit=500`);
        setProducts(prods);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    let out = products;
    if (query) {
      const q = query.toLowerCase();
      out = out.filter(
        (p) => p.product_name.toLowerCase().includes(q) ||
               p.supplier_sku.toLowerCase().includes(q) ||
               (p.brand ?? "").toLowerCase().includes(q),
      );
    }
    if (inStockOnly) {
      out = out.filter((p) => (p.total_inventory ?? 0) > 0);
    }
    out = [...out].sort((a, b) => {
      if (sort === "nameDesc") return b.product_name.localeCompare(a.product_name);
      if (sort === "variants") return (b.variant_count ?? 0) - (a.variant_count ?? 0);
      return a.product_name.localeCompare(b.product_name);
    });
    return out;
  }, [products, query, inStockOnly, sort]);

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div>
        <div className="text-[13px] text-[#888894] font-mono">
          {supplier ? `${filtered.length} / ${products.length} products` : "…"}
        </div>
      </div>

      <FilterChipBar
        inStockOnly={inStockOnly}
        onInStockChange={setInStockOnly}
        sort={sort}
        onSortChange={setSort}
        query={query}
      />

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[340px] bg-[#f9f7f4] border border-[#ebe8e3] rounded-[10px] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-[#cfccc8] rounded-[10px] p-16 text-center bg-white">
          <div className="text-[14px] font-bold text-[#1e1e24] mb-1">No matches</div>
          <div className="text-[12px] text-[#888894]">
            Try removing filters or clearing the search.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
          {filtered.map((p) => (
            <StorefrontProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
