import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import AppProviders from "@/components/AppProviders";
import AppShell from "@/components/AppShell";
import { authProvidersConfigured } from "@/lib/auth";
import { getRuntimeEnv } from "@/lib/env";
import "./globals.css";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: {
    default: "WBS Task",
    template: "%s | WBS Task",
  },
  description: "Task-based WBS collaboration system for weekly planning, deliverables, and review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const runtimeEnv = getRuntimeEnv();

  return (
    <html lang="ko" className={roboto.variable}>
      <body>
        <AppProviders>
          <AppShell appName={runtimeEnv.appName} authProvidersConfigured={authProvidersConfigured}>
            {children}
          </AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
