"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Drawer,
  NoSsr,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography,
} from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
import { signIn, signOut, useSession } from "next-auth/react";
import { type MouseEvent, type ReactNode, useState } from "react";
import type { AppThemeMode } from "@/lib/theme";
import { getUserRoleLabel } from "@/models/user";

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

const taskNavItem: NavItem = { href: "/tasks", label: "작업" };

function isActivePath(currentPath: string, href: string) {
  if (href === "/") {
    return currentPath === href;
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export default function AppShell({ appName, authProvidersConfigured, children }: AppShellProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { mode, setMode, systemMode } = useColorScheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navItems = [...defaultNavItems, taskNavItem];

  if (session?.user?.isSuperuser) {
    navItems.push(
      { href: "/admin", label: "관리자" },
      { href: "/admin/settings", label: "세팅" },
      { href: "/admin/users", label: "사용자 관리" },
      { href: "/admin/database", label: "DB 관리" },
    );
  }

  const selectedMode: AppThemeMode = mode ?? "system";
  const effectiveMode = selectedMode === "system" ? systemMode ?? "light" : selectedMode;
  const sessionChipLabel = `${session?.user?.name ?? "사용자"} · ${getUserRoleLabel(
    session?.user?.role ?? "guest",
    Boolean(session?.user?.isSuperuser),
  )}`;

  function handleModeChange(_event: MouseEvent<HTMLElement>, value: AppThemeMode | null) {
    if (!value) {
      return;
    }

    setMode(value);
  }

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  const authAction =
    status === "authenticated" && session?.user ? (
      <Button variant="outlined" onClick={() => signOut({ callbackUrl: "/" })}>
        로그아웃
      </Button>
    ) : (
      <Button
        variant="outlined"
        disabled={!authProvidersConfigured}
        onClick={() => signIn("google", { callbackUrl: "/tasks" })}
      >
        Google 로그인
      </Button>
    );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--app-shell-gradient)",
      }}
    >
      <AppBar position="sticky">
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: 78, py: 1.5, gap: 2, justifyContent: "space-between" }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
              <Button
                variant="text"
                onClick={() => setMobileNavOpen(true)}
                sx={{ display: { xs: "inline-flex", md: "none" }, minWidth: 0, px: 1.25 }}
              >
                메뉴
              </Button>

              <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                <Typography
                  component={Link}
                  href="/"
                  variant="h6"
                  sx={{ fontWeight: 800, letterSpacing: "0.04em", width: "fit-content" }}
                >
                  {appName}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                  Task 기반 WBS 협업 시스템
                </Typography>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", display: { xs: "none", md: "flex" } }}>
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

            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", justifyContent: "flex-end" }}>
              <NoSsr fallback={<Box sx={{ display: { xs: "none", md: "block" }, width: 212, height: 36 }} />}>
                <ToggleButtonGroup
                  exclusive
                  value={selectedMode}
                  onChange={handleModeChange}
                  size="small"
                  color="primary"
                  aria-label="theme mode selector"
                  sx={{ display: { xs: "none", md: "inline-flex" } }}
                >
                  <ToggleButton value="system">System</ToggleButton>
                  <ToggleButton value="light">Light</ToggleButton>
                  <ToggleButton value="dark">Dark</ToggleButton>
                </ToggleButtonGroup>
              </NoSsr>

              {status === "authenticated" && session?.user ? (
                <Chip
                  label={sessionChipLabel}
                  color={session.user.isSuperuser ? "primary" : "default"}
                  variant={session.user.isSuperuser ? "filled" : "outlined"}
                  sx={{ display: { xs: "none", lg: "inline-flex" } }}
                />
              ) : null}

              <Box sx={{ display: { xs: "none", md: "block" } }}>{authAction}</Box>
              <NoSsr
                fallback={<Chip label="표시 모드" variant="outlined" size="small" sx={{ display: { xs: "inline-flex", md: "none" } }} />}
              >
                <Chip
                  label={`표시 ${effectiveMode}`}
                  variant="outlined"
                  size="small"
                  sx={{ display: { xs: "inline-flex", md: "none" } }}
                />
              </NoSsr>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="left"
        open={mobileNavOpen}
        onClose={closeMobileNav}
        slotProps={{
          paper: {
            sx: {
              width: 320,
              maxWidth: "86vw",
              backgroundColor: "background.paper",
            },
          },
        }}
      >
        <Stack spacing={2} sx={{ p: 2.5 }}>
          <Stack spacing={0.5}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {appName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              모바일과 데스크탑에서 모두 동작하는 공통 내비게이션입니다.
            </Typography>
          </Stack>

          <Divider />

          <Stack spacing={1}>
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  variant={active ? "contained" : "outlined"}
                  onClick={closeMobileNav}
                  sx={{ justifyContent: "flex-start" }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>

          <Divider />

          <Stack spacing={1.25}>
            <Typography variant="body2" color="text.secondary">
              Theme mode
            </Typography>
            <NoSsr>
              <ToggleButtonGroup
                exclusive
                value={selectedMode}
                onChange={handleModeChange}
                size="small"
                color="primary"
                aria-label="mobile theme mode selector"
                fullWidth
              >
                <ToggleButton value="system">System</ToggleButton>
                <ToggleButton value="light">Light</ToggleButton>
                <ToggleButton value="dark">Dark</ToggleButton>
              </ToggleButtonGroup>
            </NoSsr>
            <NoSsr fallback={<Typography variant="body2" color="text.secondary">현재 표시 테마: system</Typography>}>
              <Typography variant="body2" color="text.secondary">
                현재 표시 테마: {effectiveMode}
              </Typography>
            </NoSsr>
          </Stack>

          <Divider />

          {status === "authenticated" && session?.user ? (
            <Chip
              label={sessionChipLabel}
              color={session.user.isSuperuser ? "primary" : "default"}
              variant={session.user.isSuperuser ? "filled" : "outlined"}
            />
          ) : null}

          <Box onClick={closeMobileNav} sx={{ display: "flex" }}>
            {authAction}
          </Box>
        </Stack>
      </Drawer>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</Box>
    </Box>
  );
}