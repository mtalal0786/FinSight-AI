import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FinSight AI — Financial Intelligence Platform",
  description: "AI-powered financial research and analysis platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/*
        suppressHydrationWarning prevents the mismatch warning caused by
        browser extensions (Grammarly, etc.) injecting attributes like
        cz-shortcut-listen="true" onto <body> after SSR.
      */}
      <body
        className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}
        suppressHydrationWarning
      >
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1f2937",
              color: "#f9fafb",
              border: "1px solid #374151",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#10b981", secondary: "#f9fafb" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#f9fafb" } },
          }}
        />
      </body>
    </html>
  );
}