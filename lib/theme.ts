import { createTheme, type PaletteMode } from "@mui/material/styles";

export type AppThemeMode = "system" | PaletteMode;

const theme = createTheme({
  cssVariables: true,
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: "#146356",
        },
        secondary: {
          main: "#b7791f",
        },
        background: {
          default: "#f6f4ec",
          paper: "#fffdf7",
        },
        text: {
          primary: "#1b2b25",
          secondary: "#53615c",
        },
        divider: "rgba(20, 99, 86, 0.12)",
      },
    },
    dark: {
      palette: {
        primary: {
          main: "#6ed4c4",
        },
        secondary: {
          main: "#f0bf7c",
        },
        background: {
          default: "#0d1513",
          paper: "#16211d",
        },
        text: {
          primary: "#eef7f4",
          secondary: "rgba(238, 247, 244, 0.72)",
        },
        divider: "rgba(110, 212, 196, 0.18)",
      },
    },
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
          color: "var(--mui-palette-text-primary)",
          backgroundColor: "var(--mui-palette-background-paper)",
          backdropFilter: "blur(18px)",
          boxShadow: "none",
          borderBottom: "1px solid var(--mui-palette-divider)",
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

export default theme;