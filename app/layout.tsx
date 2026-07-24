import type { Metadata } from "next";
import "./globals.css";
import { ThemeInit } from "@/components/ThemeInit";
import { ClerkGate } from "@/components/ClerkGate";

export const metadata: Metadata = {
  title: "RadioAct — Radiology triage on Ontomorph",
  description:
    "A triage-assist reader for chest X-rays, limb X-rays, and CT slices. Findings land as scoped events on the patient's digital twin for clinician review.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkGate>
      <html lang="en" suppressHydrationWarning>
        <head>
          <ThemeInit />
        </head>
        <body className="min-h-screen">{children}</body>
      </html>
    </ClerkGate>
  );
}
