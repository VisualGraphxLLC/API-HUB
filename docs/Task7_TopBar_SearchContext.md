# Task 7 — TopBar + SearchContext

**Type:** Frontend
**Status:** Done
**Branch:** Vidhi

---

## What this task does

Adds a sticky top navigation bar to the storefront and a React context for
search state. The TopBar replaces the old per-page header. The SearchContext
lets any component in the storefront tree read/write the search query without
prop drilling.

---

## Files created

### `frontend/src/components/storefront/search-context.tsx`
- `SearchProvider` — wraps the storefront tree (mounted in `StorefrontShell`)
- `useSearch()` — hook returning `{ query, setQuery }`
- Sinchana's grid page (`vg/page.tsx`) consumes `useSearch()` to filter products
  by name, SKU, and brand client-side

### `frontend/src/components/storefront/top-bar.tsx`
- Sticky 60px white header with `z-30` so it stays above the grid
- **Left:** VG blue mark (7×7 rounded square) + "Visual Graphics" brand link → `/storefront/vg`
- **Center:** Search input wired to `useSearch()` — typing filters the product grid in real time
- **Right:** `← Admin` link back to `/`
- Blueprint tokens only: `#cfccc8` border, `#1e4d92` focus ring, `#f9f7f4` input background

### `frontend/src/components/storefront/storefront-shell.tsx` (updated)
- Now wraps children in `<SearchProvider>` so the whole storefront has access to search state
- Mounts `<TopBar />` at the top of every storefront page
- `<main>` wraps page content below the bar

---

## How to test

1. Open `http://localhost:3000/storefront/vg`
2. You should see the white sticky top bar with:
   - VG blue square + "Visual Graphics" on the left
   - Search input in the center
   - `← Admin` link on the right
3. Click `← Admin` → should navigate to `http://localhost:3000`
4. Click "Visual Graphics" brand → should stay on `/storefront/vg`
5. Type in the search box — no error (grid filtering wired in Sinchana Task 11)

---

## Note

There are currently **two search bars** visible — the new TopBar one and the
old one leftover in `vg/page.tsx`. The old one is removed when Sinchana
rewrites the grid page in Task 11. This is expected and not a bug.

---

## What comes next

**Task 9 — StorefrontShell real composition**
- Replace the stub shell with real data loading
- Loads supplier → categories → products in parallel
- Computes category counts, passes to `<LeftRail>` (Sinchana Task 8)
- Mounts `<MobileFilterSheet>` (Sinchana Task 10)
