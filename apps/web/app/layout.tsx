import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { getSessionData } from "@/lib/auth";
import { StandaloneCommandPalette } from "@/components/search/command-palette";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "ConstructionSaaS",
  description: "Construction management platform for GCs and subcontractors",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialSession = await getSessionData();
  console.log("[DEBUG ORG-FLOW] 7. RootLayout getSessionData - userId:", initialSession.userId, "orgId:", initialSession.orgId, "orgName:", initialSession.orgName);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers initialSession={initialSession}>
          {children}
          <StandaloneCommandPalette />
        </Providers>
      </body>
    </html>
  );
}
