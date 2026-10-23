"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import type {Session} from "next-auth";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import theme from "@/src/shared/config/theme";

type AppProvidersProps = {
  children: ReactNode;
  session:Session|null;
};

export default function AppProviders({ children,session }: AppProvidersProps) {
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
        <SessionProvider session={session}>{children}</SessionProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
