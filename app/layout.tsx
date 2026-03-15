import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KnuckleAIGroup - Daily Football Picks",
  description: "Daily football match picks with transparent rule-based scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
