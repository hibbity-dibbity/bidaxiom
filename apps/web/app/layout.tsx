import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import { getSessionData } from "@/lib/auth";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const instrumentSerif = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-display" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: {
    template: "%s | BIDAXIOM",
    default: "BIDAXIOM",
  },
  description: "Construction management software for general contractors and subcontractors",
  icons: {
    icon: '/bidaxiom-favicon.svg',
    shortcut: '/bidaxiom-favicon.svg',
    apple: '/apple-touch-icon.png',
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
      <body className={`${dmSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers initialSession={initialSession}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
