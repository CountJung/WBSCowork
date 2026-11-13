/** Root landing pages are exact; feature links own their nested detail routes. */
export function isActiveNavigationPath(currentPath: string, href: string): boolean {
  if (href === "/" || href === "/admin") return currentPath === href;
  return currentPath === href || currentPath.startsWith(`${href}/`);
}
