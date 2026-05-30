/**
 * Active-route test shared by the sidebar (mobile) and the top nav. Strips the
 * locale prefix; `exact` requires a full match, otherwise a path prefix matches
 * (so a section stays highlighted on its sub-routes).
 */
export function isActive(pathname: string, href: string, exact: boolean): boolean {
  const path = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  if (exact) return path === href;
  return path === href || path.startsWith(`${href}/`);
}
