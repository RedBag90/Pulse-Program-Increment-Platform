/**
 * Active-route test shared by the sidebar (mobile) and the top nav. Strips the
 * locale prefix; `exact` requires a full match, otherwise a path prefix matches
 * (so a section stays highlighted on its sub-routes).
 */
export function isActive(pathname: string, href: string, exact: boolean): boolean {
  const path = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  return matchPath(path, hrefPath(href), exact);
}

/**
 * Query-aware variant — used by the top nav, where one route renders several
 * "sub-pages" that differ only by `?tab=…`. When `href` contains a query
 * string, we require both the path and the relevant query params to match the
 * current URL. Otherwise behaves exactly like `isActive`.
 */
export function isActiveLink(
  pathname: string,
  currentSearch: URLSearchParams | null,
  href: string,
  exact: boolean,
): boolean {
  const path = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  const { path: hrefPathOnly, query } = splitHref(href);

  if (!matchPath(path, hrefPathOnly, exact || query !== null)) return false;
  if (!query) return true;
  for (const [key, value] of query.entries()) {
    if ((currentSearch?.get(key) ?? "") !== value) return false;
  }
  return true;
}

function matchPath(path: string, hrefPath: string, exact: boolean): boolean {
  if (exact) return path === hrefPath;
  return path === hrefPath || path.startsWith(`${hrefPath}/`);
}

function hrefPath(href: string): string {
  const q = href.indexOf("?");
  return q === -1 ? href : href.slice(0, q);
}

function splitHref(href: string): { path: string; query: URLSearchParams | null } {
  const q = href.indexOf("?");
  if (q === -1) return { path: href, query: null };
  return { path: href.slice(0, q), query: new URLSearchParams(href.slice(q + 1)) };
}
