"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { SessionProvider } from "next-auth/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { createAppTheme, type AppThemeMode } from "@/lib/theme";

type AppProvidersProps = {
  children: ReactNode;
};

type ThemeModeContextValue = {
  mode: AppThemeMode;
  toggleMode: () => void;
};

const themeStorageKey = "wbs-task-theme-mode";

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

export function useAppThemeMode() {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error("useAppThemeMode must be used within AppProviders.");
  }

  return context;
}

export default function AppProviders({ children }: AppProvidersProps) {
  const [mode, setMode] = useState<AppThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const storedMode = window.localStorage.getItem(themeStorageKey);

    if (storedMode === "dark" || storedMode === "light") {
      return storedMode;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    window.localStorage.setItem(themeStorageKey, mode);
  }, [mode]);

  const theme = createAppTheme(mode);

  return (
    <AppRouterCacheProvider>
      <ThemeModeContext.Provider
        value={{
          mode,
          toggleMode: () => {
            setMode((currentMode) => (currentMode === "light" ? "dark" : "light"));
          },
        }}
      >
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </ThemeModeContext.Provider>
    </AppRouterCacheProvider>
  );
}