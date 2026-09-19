"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Umschalter und Suche der Struktur-Fläche.
 *
 * **Der Zustand steht in der URL**, nicht in dieser Komponente: Lesezeichen,
 * geteilte Links und der Zurück-Knopf des Browsers hängen daran. Dasselbe
 * Prinzip, nach dem der frühere Baum Suche und Filter in `?q`/`?kind` hielt —
 * und nach dem `/structure/solutions` heute auf `?view=tabelle&nach=horizont`
 * landet, statt eine eigene Seite zu sein.
 *
 * Die **Filter-Chips nach Knotenart sind entfallen**. In einer Karte, die alle
 * drei Ebenen zugleich zeigt, leerte „nur ARTs" das Bild.
 */
export function StructureToolbar({
  view,
  grouping,
}: {
  view: "karte" | "tabelle";
  grouping: "struktur" | "horizont";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);

  const pushParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
      const next = params.toString();
      router.replace(`${pathname}${next ? `?${next}` : ""}` as never, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (draft === query) return;
    const t = window.setTimeout(() => pushParam("q", draft || null), 200);
    return () => window.clearTimeout(t);
  }, [draft, query, pushParam]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label="Darstellung"
        options={[
          { value: "karte", label: "Karte" },
          { value: "tabelle", label: "Tabelle" },
        ]}
        active={view}
        // `karte` ist der Standard und braucht keinen Parameter in der URL.
        onSelect={(v) => pushParam("view", v === "karte" ? null : v)}
      />

      {view === "tabelle" && (
        <Segmented
          label="Gruppierung"
          options={[
            { value: "struktur", label: "nach Struktur" },
            { value: "horizont", label: "nach Horizont" },
          ]}
          active={grouping}
          onSelect={(v) => pushParam("nach", v === "struktur" ? null : v)}
        />
      )}

      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Suche…"
          aria-label="Struktur durchsuchen"
          className="h-8 w-44 pl-8 text-xs"
        />
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  active,
  onSelect,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  active: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onSelect(o.value)}
          aria-pressed={o.value === active}
          className={cn(
            "rounded-[0.4rem] px-3 py-1 text-xs transition-colors",
            "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            o.value === active
              ? "bg-card font-semibold text-foreground shadow-card"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
