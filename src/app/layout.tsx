import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CSV Bulk Message Automation Agent",
  description: "Deterministic CSV Bulk Message Automation Agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#0a191e] text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
