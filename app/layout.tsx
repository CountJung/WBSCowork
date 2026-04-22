import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import AppProviders from "@/components/AppProviders";
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
  return (
    <html lang="ko" className={roboto.variable}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
