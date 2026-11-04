import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Nav } from "./nav";
import "./globals.css";

const body = Barlow({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600"] });
const display = Barlow_Condensed({ variable: "--font-display-face", subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "GymDesk",
  description: "Membership, check-in, and payments for small gyms",
};

export const viewport: Viewport = { themeColor: "#2f3236" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col md:h-dvh md:overflow-hidden">
        <Suspense fallback={<div className="h-14 bg-rubber" />}>
          <Nav />
        </Suspense>
        <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:min-h-0 md:p-6">{children}</main>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
