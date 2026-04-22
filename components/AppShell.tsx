"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Stack,
  Switch,
  Toolbar,
  Typography,
} from "@mui/material";
import { signIn, signOut, useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { useAppThemeMode } from "@/components/AppProviders";

type AppShellProps = {
  appName: string;
  authProvidersConfigured: boolean;
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
};

const defaultNavItems: NavItem[] = [{ href: "/", label: "홈" }];

function isActivePath(currentPath: string, href: string) {
  if (href === "/") {
    return currentPath === href;
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export default function AppShell({ appName, authProvidersConfigured, children }: AppShellProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { mode, toggleMode } = useAppThemeMode();
  const navItems = [...defaultNavItems];

  if (session?.user?.isSuperuser) {
    navItems.push(
      { href: "/admin", label: "관리자" },
      { href: "/admin/database", label: "DB 관리" },
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background:
          mode === "dark"
            ? "radial-gradient(circle at top, rgba(110, 212, 196, 0.12), transparent 36%), linear-gradient(180deg, #0d1513 0%, #101816 100%)"
            : "radial-gradient(circle at top, rgba(20, 99, 86, 0.12), transparent 34%), linear-gradient(180deg, #f7f4ea 0%, #f1ede1 100%)",
      }}
    >
      <AppBar position="sticky">
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: { xs: 96, md: 88 }, py: 1.5, gap: 2 }}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={2}
              sx={{ width: "100%", justifyContent: "space-between" }}
            >
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
                <Stack spacing={0.25}>
                  <Typography
                    component={Link}
                    href="/"
                    variant="h6"
                    sx={{ fontWeight: 800, letterSpacing: "0.04em", width: "fit-content" }}
                  >
                    {appName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Task 기반 WBS 협업 시스템
                  </Typography>
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flexWrap: "wrap" }}>
                  {navItems.map((item) => {
                    const active = isActivePath(pathname, item.href);

                    return (
                      <Button
                        key={item.href}
                        component={Link}
                        href={item.href}
                        variant={active ? "contained" : "text"}
                        color={active ? "primary" : "inherit"}
                      >
                        {item.label}
                      </Button>
                    );
                  })}
                </Stack>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" } }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    Theme
                  </Typography>
                  <Switch
                    checked={mode === "dark"}
                    onChange={toggleMode}
                    slotProps={{ input: { "aria-label": "theme mode toggle" } }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 38 }}>
                    {mode === "dark" ? "Dark" : "Light"}
                  </Typography>
                </Stack>

                {status === "authenticated" && session.user ? (
                  <>
                    <Chip
                      label={`${session.user.name ?? "사용자"} · ${session.user.isSuperuser ? "슈퍼유저" : "멤버"}`}
                      color={session.user.isSuperuser ? "primary" : "default"}
                      variant={session.user.isSuperuser ? "filled" : "outlined"}
                    />
                    <Button variant="outlined" onClick={() => signOut({ callbackUrl: "/" })}>
                      로그아웃
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outlined"
                    disabled={!authProvidersConfigured}
                    onClick={() => signIn("google", { callbackUrl: "/admin" })}
                  >
                    Google 로그인
                  </Button>
                )}
              </Stack>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</Box>
    </Box>
  );
}