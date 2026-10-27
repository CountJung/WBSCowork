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
  IconButton,
  Menu,
  MenuItem,
  NoSsr,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
import { signIn, signOut, useSession } from "next-auth/react";
import { type MouseEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import type { AppThemeMode } from "@/src/shared/config/theme";
import { getUserRoleLabel } from "@/src/entities/user";
import { ScopedNavigationContext, isNavigationScopeActive, type ScopedNavigation } from "@/src/shared/ui/scoped-navigation";

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

// 슈퍼관리자 전용 메뉴 (DB 관리 + 사용자 관리 포함)
const superuserAdminNavItems: NavItem[] = [
  { href: "/admin", label: "관리 개요" },
  { href: "/admin/projects", label: "프로젝트 관리" },
  { href: "/admin/bugs", label: "버그 리뷰" },
  { href: "/admin/logs", label: "로그" },
  { href: "/admin/settings", label: "세팅" },
  { href: "/admin/users", label: "사용자 관리" },
  { href: "/admin/database", label: "DB 관리" },
];

// 일반 관리자는 배정된 프로젝트만 관리합니다. 전역 운영은 슈퍼관리자 전용입니다.
const adminRoleNavItems: NavItem[] = [
  { href: "/admin/projects", label: "프로젝트 관리" },
];

function isActivePath(currentPath: string, href: string) {
  if (href === "/") {
    return currentPath === href;
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function PrivacyGuideIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none">
      <path
        d="M12 3 5.5 5.7v5.1c0 4.3 2.7 8.2 6.5 9.7 3.8-1.5 6.5-5.4 6.5-9.7V5.7L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 10.2v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.7" r="1" fill="currentColor" />
    </svg>
  );
}

function UserGuideIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M12 5.5C8.5 3.5 5.5 3.5 3 4.5V19c2.5-1 5.5-1 9 1 3.5-2 6.5-2 9-1V4.5c-2.5-1-5.5-1-9 1Zm0 0V20" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M6 8h3M15 8h3M6 11h3M15 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

export default function AppShell({ appName, authProvidersConfigured, children }: AppShellProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { mode, setMode, systemMode } = useColorScheme();
  const [openedMenuAt, setOpenedMenuAt] = useState<string | null>(null);
  const [scopedNavigation, setScopedNavigation] = useState<(ScopedNavigation & { token: symbol }) | null>(null);
  const mobileNavOpen = openedMenuAt === pathname;
  const activeScope = scopedNavigation && isNavigationScopeActive(pathname, scopedNavigation.rootHref) ? scopedNavigation : null;
  const registerNavigation = useCallback((navigation: ScopedNavigation) => {
    const token = Symbol("navigation");
    setScopedNavigation({ ...navigation, token });
    return () => setScopedNavigation(current => current?.token === token ? null : current);
  }, []);
  const closeMobileNav = useCallback(() => setOpenedMenuAt(null), []);
  useEffect(() => {
    window.addEventListener("popstate", closeMobileNav);
    return () => window.removeEventListener("popstate", closeMobileNav);
  }, [closeMobileNav]);
  const [adminMenuAnchorEl, setAdminMenuAnchorEl] = useState<null | HTMLElement>(null);
  const navItems = [...defaultNavItems, taskNavItem, { href: "/my-work", label: "내 업무" }, {href:"/search",label:"검색"}, {href:"/notifications",label:"알림"}, {href:"/bugs",label:"버그 제보"}];
  const adminMenuOpen = Boolean(adminMenuAnchorEl);
  const isSuperuser = Boolean(session?.user?.isSuperuser);
  const isAdminRole = session?.user?.role === "admin";
  const hasAdminAccess = isSuperuser || isAdminRole;
  const currentAdminNavItems = isSuperuser ? superuserAdminNavItems : adminRoleNavItems;
  const isAdminRouteActive = hasAdminAccess && isActivePath(pathname, "/admin");
  const isPrivacyRouteActive = isActivePath(pathname, "/privacy");
  const isGuideRouteActive = isActivePath(pathname, "/guide");

  const selectedMode: AppThemeMode = mode ?? "system";
  const effectiveMode = selectedMode === "system" ? systemMode ?? "light" : selectedMode;
  const sessionChipLabel = `${session?.user?.name ?? "사용자"} · ${getUserRoleLabel(
    session?.user?.role ?? "guest",
    Boolean(session?.user?.isSuperuser),
  )}`;
  const sessionChipSx = {
    display: { xs: "none", lg: "inline-flex" },
    minWidth: 0,
    maxWidth: { lg: 240, xl: 160 },
  };

  function handleModeChange(_event: MouseEvent<HTMLElement>, value: AppThemeMode | null) {
    if (!value) {
      return;
    }

    setMode(value);
  }

  function openAdminMenu(event: MouseEvent<HTMLElement>) {
    setAdminMenuAnchorEl(event.currentTarget);
  }

  function closeAdminMenu() {
    setAdminMenuAnchorEl(null);
  }

  const authAction =
    status === "authenticated" && session?.user ? (
      <Button variant="outlined" sx={{ whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => signOut({ callbackUrl: "/" })}>
        로그아웃
      </Button>
    ) : (
      <Button
        variant="outlined"
        sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
        disabled={!authProvidersConfigured}
        onClick={() => signIn("google", { callbackUrl: "/tasks" })}
      >
        Google 로그인
      </Button>
    );

  return (
    <ScopedNavigationContext.Provider value={registerNavigation}>
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--app-shell-gradient)",
      }}
    >
      <AppBar position="sticky">
        <Container>
          <Toolbar disableGutters sx={{
            minHeight: 78,
            py: 1.5,
            gap: { xs: 1, sm: 2 },
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr) auto", xl: "minmax(0, 1fr) auto auto" },
          }}>
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: "center", minWidth: 0 }}>
              <IconButton
                onClick={() => setOpenedMenuAt(pathname)}
                aria-label="메뉴 열기"
                aria-expanded={mobileNavOpen}
                aria-controls="app-navigation"
                aria-haspopup="dialog"
                sx={{
                  display: "inline-flex",
                  minWidth: 44,
                  minHeight: 44,
                  flexShrink: 0,
                  borderRadius: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  fontSize: "1.25rem",
                  lineHeight: 1,
                }}
              >
                ☰
              </IconButton>

              <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                <Typography
                  component={Link}
                  href="/"
                  variant="h6"
                  title={appName}
                  noWrap
                  sx={{ fontWeight: 800, letterSpacing: "0.04em", maxWidth: "100%" }}
                >
                  {appName}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap sx={{ display: { xs: "none", sm: "block" } }}>
                  Task 기반 WBS 협업 시스템
                </Typography>
              </Stack>
            </Stack>

            <Stack component="nav" aria-label="주 메뉴" direction="row" spacing={1.25} sx={{
              alignItems: "center",
              justifyContent: "center",
              display: { xs: "none", md: "flex" },
              gridRow: { md: 2, xl: 1 },
              gridColumn: { md: "1 / -1", xl: 2 },
              "& .MuiButton-root": { whiteSpace: "nowrap", flexShrink: 0 },
            }}>
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

              {hasAdminAccess ? (
                <>
                  <Button
                    aria-controls={adminMenuOpen ? "admin-navigation-menu" : undefined}
                    aria-expanded={adminMenuOpen ? "true" : undefined}
                    aria-haspopup="menu"
                    color={isAdminRouteActive ? "primary" : "inherit"}
                    onClick={openAdminMenu}
                    variant={isAdminRouteActive ? "contained" : "text"}
                  >
                    관리자
                  </Button>
                  <Menu
                    anchorEl={adminMenuAnchorEl}
                    id="admin-navigation-menu"
                    onClose={closeAdminMenu}
                    open={adminMenuOpen}
                  >
                    {currentAdminNavItems.map((item) => (
                      <MenuItem
                        key={item.href}
                        component={Link}
                        href={item.href}
                        onClick={closeAdminMenu}
                        selected={isActivePath(pathname, item.href)}
                      >
                        {item.label}
                      </MenuItem>
                    ))}
                  </Menu>
                </>
              ) : null}
            </Stack>

            <Stack direction="row" spacing={1.25} sx={{
              alignItems: "center",
              justifyContent: "flex-end",
              minWidth: 0,
              gridRow: 1,
              gridColumn: { xs: 2, xl: 3 },
              "& > *": { flexShrink: 0 },
            }}>
              <Tooltip title="사용설명서">
                <IconButton component={Link} href="/guide" aria-label="사용설명서 열기" aria-current={isGuideRouteActive ? "page" : undefined} color={isGuideRouteActive ? "primary" : "inherit"} sx={{minWidth:44,minHeight:44,border:"1px solid",borderColor:isGuideRouteActive?"primary.main":"divider",backgroundColor:isGuideRouteActive?"action.selected":"transparent"}}><UserGuideIcon /></IconButton>
              </Tooltip>
              <Tooltip title="개인정보 처리지침">
                <IconButton
                  component={Link}
                  href="/privacy"
                  aria-label="개인정보 처리지침 보기"
                  aria-current={isPrivacyRouteActive ? "page" : undefined}
                  color={isPrivacyRouteActive ? "primary" : "inherit"}
                  sx={{
                    minWidth: 44,
                    minHeight: 44,
                    border: "1px solid",
                    borderColor: isPrivacyRouteActive ? "primary.main" : "divider",
                    backgroundColor: isPrivacyRouteActive ? "action.selected" : "transparent",
                  }}
                >
                  <PrivacyGuideIcon />
                </IconButton>
              </Tooltip>

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

              {session?.user?.isSuperuser ? (
                <Chip
                  label={sessionChipLabel}
                  color="primary"
                  variant="filled"
                  title={sessionChipLabel}
                  sx={sessionChipSx}
                />
              ) : session?.user?.role === "admin" ? (
                <Chip
                  label={sessionChipLabel}
                  color="secondary"
                  variant="outlined"
                  title={sessionChipLabel}
                  sx={sessionChipSx}
                />
              ) : status === "authenticated" && session?.user ? (
                <Chip
                  label={sessionChipLabel}
                  color="default"
                  variant="outlined"
                  title={sessionChipLabel}
                  sx={sessionChipSx}
                />
              ) : null}

              <Box sx={{ display: { xs: "none", md: "block" } }}>{authAction}</Box>
              <NoSsr
                fallback={<Chip label="표시 모드" variant="outlined" size="small" sx={{ display: { xs: "none", sm: "inline-flex", md: "none" } }} />}
              >
                <Chip
                  label={`표시 ${effectiveMode}`}
                  variant="outlined"
                  size="small"
                  sx={{ display: { xs: "none", sm: "inline-flex", md: "none" } }}
                />
              </NoSsr>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="top"
        keepMounted
        open={mobileNavOpen}
        onClose={closeMobileNav}
        slotProps={{ paper: { id: "app-navigation", role: "dialog", "aria-modal": true, "aria-labelledby": "app-navigation-title", sx: { width: "100%", maxWidth: "100vw", maxHeight: "88dvh", overflowY: "auto", overscrollBehavior: "contain", borderRadius: "0 0 16px 16px", backgroundColor: "background.paper", "& .MuiButton-root": { minHeight: 44, textAlign: "left", overflowWrap: "anywhere", whiteSpace: "normal", justifyContent: "flex-start" } } } }}
      >
        <Stack direction="row" spacing={1} sx={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "background.paper", p: 2, alignItems: "center", borderBottom: "1px solid", borderColor: "divider" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}><Typography id="app-navigation-title" component="h2" variant="h6" sx={{ overflowWrap: "anywhere" }}>프로젝트와 사이트 메뉴</Typography><Typography variant="caption">메뉴를 선택하거나 바깥을 누르면 닫힙니다.</Typography></Box>
          <IconButton aria-label="메뉴 닫기" onClick={closeMobileNav} sx={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}>✕</IconButton>
        </Stack>
        <Stack spacing={2} sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
          {activeScope ? <Stack component="nav" aria-label="현재 프로젝트 메뉴" spacing={1}>
            <Typography component="h3" variant="subtitle1" sx={{ overflowWrap: "anywhere", fontWeight: 700 }}>현재 프로젝트 · {activeScope.title}</Typography>
            {activeScope.links.map(item => <Button key={item.href} component={Link} prefetch={false} href={item.href} onClick={closeMobileNav} variant={pathname === item.href ? "contained" : "outlined"} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Button>)}
            <Button component={Link} prefetch={false} href="/projects" onClick={closeMobileNav} variant="text">다른 프로젝트로 전환</Button>
          </Stack> : <Button component={Link} prefetch={false} href="/projects" onClick={closeMobileNav} variant="outlined">내 프로젝트 홈</Button>}
          <Divider />
          <Stack component="nav" aria-label="사이트 메뉴" spacing={1}>
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>사이트 공통</Typography>
            {(activeScope ? navItems.filter(item => item.href !== "/tasks") : navItems).map(item => <Button key={item.href} component={Link} prefetch={false} href={item.href} onClick={closeMobileNav} variant={isActivePath(pathname, item.href) ? "contained" : "outlined"} aria-current={isActivePath(pathname, item.href) ? "page" : undefined}>{activeScope && item.href === "/" ? "사이트 홈" : item.label}</Button>)}
            <Button component={Link} prefetch={false} href="/guide" onClick={closeMobileNav} variant={isGuideRouteActive ? "contained" : "outlined"} aria-current={isGuideRouteActive ? "page" : undefined}>사용설명서</Button>
            <Button component={Link} prefetch={false} href="/privacy" onClick={closeMobileNav} variant={isPrivacyRouteActive ? "contained" : "outlined"} aria-current={isPrivacyRouteActive ? "page" : undefined}>개인정보 처리지침</Button>
          </Stack>
          {hasAdminAccess ? <><Divider /><Stack component="nav" aria-label="관리자 메뉴" spacing={1}>
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>관리자</Typography>
            {currentAdminNavItems.map(item => <Button key={item.href} component={Link} prefetch={false} href={item.href} onClick={closeMobileNav} variant={isActivePath(pathname, item.href) ? "contained" : "outlined"}>{item.label}</Button>)}
          </Stack></> : null}
          <Divider />
          <Stack spacing={1.25}><Typography variant="body2" color="text.secondary">화면 표시 모드</Typography>
            <NoSsr><ToggleButtonGroup exclusive value={selectedMode} onChange={handleModeChange} size="small" color="primary" aria-label="mobile theme mode selector" fullWidth sx={{ "& .MuiToggleButton-root": { minHeight: 44 } }}><ToggleButton value="system">System</ToggleButton><ToggleButton value="light">Light</ToggleButton><ToggleButton value="dark">Dark</ToggleButton></ToggleButtonGroup></NoSsr>
          </Stack>
          {status === "authenticated" && session?.user ? <Chip label={sessionChipLabel} title={sessionChipLabel} sx={{ maxWidth: "100%", minWidth: 0, height: "auto", "& .MuiChip-label": { whiteSpace: "normal", overflowWrap: "anywhere", py: 0.5 } }} color={session.user.isSuperuser ? "primary" : "default"} variant={session.user.isSuperuser ? "filled" : "outlined"} /> : null}
          <Box onClick={closeMobileNav} sx={{ display: "flex" }}>{authAction}</Box>
        </Stack>
      </Drawer>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</Box>
    </Box>
    </ScopedNavigationContext.Provider>
  );
}
