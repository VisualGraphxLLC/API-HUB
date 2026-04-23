# Task 5 — Storefront Layout Skeleton

**Type:** Frontend
**Status:** Done
**Branch:** vidhi/storefront-layout-skeleton

---

## What this task does

Creates the layout wrapper for the `/storefront/vg` route so it runs completely
separate from the admin panel. Before this task, the storefront was inheriting
the root admin layout (with `SidebarNav`). Now it has its own clean shell.

---

## Files created

### `frontend/src/app/storefront/vg/layout.tsx`
Next.js route layout file. Any page inside `/storefront/vg/` automatically gets
wrapped by `StorefrontShell` instead of the admin layout. This is a Next.js App
Router convention — a `layout.tsx` file applies to all routes in its folder.

### `frontend/src/components/storefront/storefront-shell.tsx`
The actual wrapper component. Currently a bare container with the Blueprint
background color (`#f2f0ed`). Task 9 replaces this stub with the real version
that loads categories + products, computes counts, and mounts:
- `<TopBar>` (Vidhi Task 7)
- `<LeftRail>` (Sinchana Task 8)
- `<MobileFilterSheet>` (Sinchana Task 10)

---

## How to test

1. Make sure backend + frontend are running:
   ```bash
   # Terminal 1 — backend
   cd backend && source .venv/Scripts/activate && uvicorn main:app --port 8000 --reload

   # Terminal 2 — frontend
   cd frontend && npm run dev
   ```

2. Open `http://localhost:3000/storefront/vg`
   - You should see the storefront **without** the left admin sidebar
   - Background should be paper color (`#f2f0ed`)

3. Open `http://localhost:3000/suppliers`
   - Admin sidebar should still be present as normal

4. The two layouts are now completely independent of each other.

---

## Why this task comes first

Every other Vidhi task (T7, T9, T14, T15, T16, T17, T18) renders inside this
shell. Without `layout.tsx`, the storefront has no layout wrapper. This is the
foundation everything else builds on.

---

## What comes next

**Task 7 — TopBar + SearchContext**
- `search-context.tsx`: SearchProvider + useSearch hook
- `top-bar.tsx`: sticky 60px bar with brand, search input, admin link
