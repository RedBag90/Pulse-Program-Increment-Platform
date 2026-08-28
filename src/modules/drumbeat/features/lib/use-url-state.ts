"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * **Ein** URL-State-Hook für die Drumbeat-Client-Flächen — ersetzt die zuvor in
 * ≥6 Komponenten handgerollten `useRouter`/`usePathname`/`useSearchParams` +
 * `new URLSearchParams` + `router.replace(..., { scroll: false })`-Blöcke.
 *
 * `setParam(key, null|"")` löscht den Parameter; ein nicht-leerer Wert setzt ihn.
 * `router.replace` (scroll-frei) hält die Navigation ruhig; `searchParams` wird
 * für Lese-Zugriffe durchgereicht.
 */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") next.delete(key);
        else next.set(key, value);
      }
      router.replace(`${pathname}?${next.toString()}` as never, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setParam = useCallback(
    (key: string, value: string | null | undefined) => setParams({ [key]: value }),
    [setParams],
  );

  return { searchParams, setParam, setParams };
}
