"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";

/**
 * Encapsulates the URL-as-list-state pattern that every list shell ran
 * hand-rolled (impediments, my-tasks, epics-list, dependencies, …). Reads the
 * current search params and returns a stable patch function: each entry of the
 * patch either sets a key (`string`) or removes it (`null` / `""`). Navigation
 * uses `router.replace` with `scroll: false`, matching the prior behaviour.
 *
 * Field decoding stays in the caller because every shell has its own enum
 * / fallback / serialization rules (Sets joined as CSV, default values omitted
 * from the URL, etc.). A schema-driven decoder would couple the shells through
 * a shared vocabulary they don't actually share. The interface here owns
 * **how** params are written; **what** is read is the caller's concern.
 */
export function useUrlState(): {
  params: ReadonlyURLSearchParams;
  push: (patch: Record<string, string | null>) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const push = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
    },
    [pathname, router, params],
  );

  return { params, push };
}
