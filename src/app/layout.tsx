import type { Metadata } from "next";
import "./globals.css";

import { ThemeProvider } from "../components/ThemeProvider";
import { UILanguageProvider } from "../contexts/UILanguageContext";
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Lumina.ai — Active Validation Sandbox",
  description:
    "Transform any YouTube video into an active validation sandbox with contextual checkpoints, code tasks, and verified learning outputs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <UILanguageProvider>
            <Navigation />
            <main className="min-h-screen w-full pt-24">
              {children}
            </main>
            <Footer />
            <Toaster richColors position="top-right" />
          </UILanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
