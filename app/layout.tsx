import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "tinget.ai",
  description: "Daglig oppsummering av Stortingets dokumenter",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <body className="antialiased">{children}</body>
    </html>
  );
}

