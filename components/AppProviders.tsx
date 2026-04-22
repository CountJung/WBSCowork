"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import theme from "@/lib/theme";

type AppProvidersProps = {
  children: ReactNode;
};

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider
        theme={theme}
        defaultMode="system"
        modeStorageKey="wbs-task-mode"
        colorSchemeStorageKey="wbs-task-color-scheme"
        disableTransitionOnChange
      >
        <CssBaseline enableColorScheme />
        <SessionProvider>{children}</SessionProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}