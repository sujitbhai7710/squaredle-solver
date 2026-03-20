import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Squaredle Solver - Find All Words",
  description: "Free online Squaredle puzzle solver. Get today's official word list, solve puzzles instantly with path highlighting.",
  keywords: ["Squaredle", "word game", "puzzle solver", "word finder", "daily puzzle", "word search"],
  authors: [{ name: "Squaredle Solver" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Squaredle Solver - Find All Words",
    description: "Free online Squaredle puzzle solver with today's official word list",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
