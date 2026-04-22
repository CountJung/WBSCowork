import { createTheme, type PaletteMode } from "@mui/material/styles";

export type AppThemeMode = PaletteMode;

export function createAppTheme(mode: AppThemeMode) {
  const isDark = mode === "dark";

  return createTheme({
    cssVariables: true,
    palette: {
      mode,
      primary: {
        main: isDark ? "#6ed4c4" : "#146356",
      },
      secondary: {
        main: isDark ? "#f0bf7c" : "#b7791f",
      },
      background: {
        default: isDark ? "#0d1513" : "#f6f4ec",
        paper: isDark ? "#16211d" : "#fffdf7",
      },
      text: {
        primary: isDark ? "#eef7f4" : "#1b2b25",
        secondary: isDark ? "rgba(238, 247, 244, 0.72)" : "#53615c",
      },
      divider: isDark ? "rgba(110, 212, 196, 0.18)" : "rgba(20, 99, 86, 0.12)",
    },
    shape: {
      borderRadius: 20,
    },
    typography: {
      fontFamily: "var(--font-roboto), system-ui, sans-serif",
      h2: {
        fontWeight: 700,
        lineHeight: 1.1,
      },
      h5: {
        fontWeight: 700,
      },
      button: {
        fontWeight: 600,
        textTransform: "none",
      },
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            color: isDark ? "#eef7f4" : "#1b2b25",
            background: isDark ? "rgba(13, 21, 19, 0.84)" : "rgba(255, 253, 247, 0.82)",
            backdropFilter: "blur(18px)",
            boxShadow: "none",
            borderBottom: `1px solid ${isDark ? "rgba(110, 212, 196, 0.16)" : "rgba(20, 99, 86, 0.12)"}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
          },
        },
      },
    },
  });
}

const theme = createAppTheme("light");

export default theme;