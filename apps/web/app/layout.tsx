import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { getSessionData } from "@/lib/auth";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    template: "%s | BIDAXIOM",
    default: "BIDAXIOM",
  },
  description: "Construction management software for general contractors and subcontractors",
  icons: {
    icon: '/bidaxiom-icon.png',
    shortcut: '/bidaxiom-icon.png',
    apple: '/bidaxiom-icon.png',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialSession = await getSessionData();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers initialSession={initialSession}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
