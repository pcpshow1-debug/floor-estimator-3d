import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIPRO Hardwood Floors — Beautiful floors. Revealed.",
  description: "Preview a new floor or a refinish on a sample you can turn. Preliminary estimates use editable local planning benchmarks and stay subject to measurement and inspection.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{"--background":"#ffffff","--foreground":"#111111","--primary":"#111111","--primary-foreground":"#ffffff","--secondary":"#f4f4f4","--secondary-foreground":"#111111","--muted-foreground":"#6d6d6d","--border":"#e6e6e6","--input":"#e4e4e4","--ring":"#111111"} as CSSProperties}>
      <body>{children}</body>
    </html>
  );
}
