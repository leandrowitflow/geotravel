import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LegalSiteFooter } from "@/components/legal-site-footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Geotravel — Reservation agent",
  description: "Reservation enrichment and admin operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scheme-light dark:scheme-dark`}
    >
      <body className="flex min-h-full flex-col bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <LegalSiteFooter />
      </body>
    </html>
  );
}
