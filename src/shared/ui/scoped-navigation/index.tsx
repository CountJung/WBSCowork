"use client";

import { createContext, useContext, useEffect } from "react";
export type NavigationLink = { href: string; label: string };
export type ScopedNavigation = { rootHref: string; title: string; links: NavigationLink[] };
export type RegisterScopedNavigation = (navigation: ScopedNavigation) => () => void;
export const ScopedNavigationContext = createContext<RegisterScopedNavigation | null>(null);

/** The page supplies already-authorized navigation; this never grants server access. */
export function useScopedNavigation(navigation: ScopedNavigation) {
  const register = useContext(ScopedNavigationContext);
  useEffect(() => register?.(navigation), [register, navigation]);
}

export function isNavigationScopeActive(pathname: string, rootHref: string) {
  return pathname === rootHref || pathname.startsWith(`${rootHref}/`);
}
