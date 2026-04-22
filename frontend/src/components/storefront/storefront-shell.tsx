// Bare container stub — Task 9 replaces this with real composition:
// loads categories + products, computes counts, mounts TopBar + LeftRail + MobileFilterSheet.
// function LeftRail() { return null; }         // replaced by Sinchana 8
// function MobileFilterSheet() { return null; } // replaced by Sinchana 10

export default function StorefrontShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f2f0ed] text-[#1e1e24]">
      {children}
    </div>
  );
}
