import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import AppProviders from "@/components/AppProviders";
import AppShell from "@/components/AppShell";
import { getRuntimeEnv } from "@/lib/env";
import "../node_modules/frappe-gantt/dist/frappe-gantt.css";
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
    <html lang="ko" className={roboto.variable} suppressHydrationWarning>
      <body>
        <AppProviders>
          <AppShell appName={runtimeEnv.appName} authProvidersConfigured={runtimeEnv.auth.googleProviderConfigured}>
            {children}
          </AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
