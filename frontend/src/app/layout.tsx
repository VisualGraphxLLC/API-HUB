import type { Metadata } from "next";
import "./globals.css";
import CursorTrail from "@/components/CursorTrail";
import ConditionalShell from "@/components/ConditionalShell";

export const metadata: Metadata = {
  title: "API-HUB",
  description: "Universal Connector",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ConditionalShell>{children}</ConditionalShell>
        <CursorTrail />
      </body>
    </html>
  );
}
