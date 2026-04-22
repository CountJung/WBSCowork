"use client";

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  cssVariables: true,
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
  },
});

export default theme;