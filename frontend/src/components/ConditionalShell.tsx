"use client";

import { usePathname } from "next/navigation";
import SidebarNav from "@/components/SidebarNav";

export default function ConditionalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isStorefront = pathname.startsWith("/storefront");

  if (isStorefront) {
    return <>{children}</>;
  }

  return (
    <div className="shell">
      <SidebarNav />
      <div className="main">{children}</div>
    </div>
  );
}
