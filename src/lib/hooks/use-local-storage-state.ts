"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Kleiner localStorage-gestützter State-Hook für **reine Ansichtspräferenzen**
 * (z. B. der eingeklappte Ziel-Baum), die über einen Reload überleben sollen,
 * aber weder geteilt noch bookmarkbar sein müssen — anders als der URL-State
 * (`use-url-state.ts`), der die kanonische Liste teilbarer Filter trägt.
 *
 * SSR-sicher: der Initialwert wird beim ersten Render server- **und** client-
 * seitig identisch gerendert (kein Hydration-Mismatch); der persistierte Wert
 * wird erst nach dem Mount nachgeladen. Nur JSON-serialisierbare Werte.
 */
export function useLocalStorageState<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);

  // Nach dem Mount den gespeicherten Wert nachladen (client-only).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      // ignore (privater Modus / gesperrter Storage / kaputtes JSON)
    }
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // ignore
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, set];
}
