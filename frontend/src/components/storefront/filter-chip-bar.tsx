"use client";

type Sort = "name" | "nameDesc" | "variants";

interface Props {
  inStockOnly: boolean;
  onInStockChange: (v: boolean) => void;
  sort: Sort;
  onSortChange: (v: Sort) => void;
  query: string;
}

export function FilterChipBar({ inStockOnly, onInStockChange, sort, onSortChange, query }: Props) {
  const hasFilters = inStockOnly || !!query;

  return (
    <div className="flex items-center flex-wrap gap-2 h-auto py-1">
      {query && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1e4d92] text-white text-[11px] font-semibold">
          query: {query}
        </span>
      )}
      <button
        type="button"
        onClick={() => onInStockChange(!inStockOnly)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all
          ${inStockOnly
            ? "bg-[#1e4d92] text-white"
            : "bg-white border border-[#cfccc8] text-[#1e1e24] hover:border-[#1e4d92] hover:text-[#1e4d92]"
          }`}
      >
        In stock {inStockOnly && "×"}
      </button>

      <div className="ml-auto flex items-center gap-3">
        <label className="text-[11px] font-mono text-[#484852]">Sort</label>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as Sort)}
          className="px-2 py-1 border border-[#cfccc8] rounded-md text-[12px] bg-white focus:border-[#1e4d92] outline-none"
        >
          <option value="name">Name A–Z</option>
          <option value="nameDesc">Name Z–A</option>
          <option value="variants">Most variants</option>
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => { onInStockChange(false); }}
            className="text-[11px] font-semibold text-[#888894] hover:text-[#1e4d92]"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
