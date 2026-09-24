"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";

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
  const t = useTranslations();
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
        label={t("org.ui.darstellung")}
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
          label={t("org.ui.gruppierung")}
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
          placeholder={t("org.ui.suche")}
          aria-label={t("org.ui.strukturDurchsuchen")}
          className="h-8 w-44 pl-8 text-xs"
        />
      </div>
    </div>
  );
}
