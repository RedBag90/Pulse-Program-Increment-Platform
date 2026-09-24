"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { filterDirectory, directoryStats } from "@/modules/core/org/domain/role-directory";
import type { ValueStreamDirectory } from "@/modules/core/org/domain/role-directory";
import { RoleDirectoryFilterBar } from "@/modules/core/org/features/structure/components/role-directory-filter-bar";
import { RoleDirectoryMap } from "@/modules/core/org/features/structure/components/role-directory-map";
import { RoleDirectoryTable } from "@/modules/core/org/features/structure/components/role-directory-table";

export type {
  DirectoryUserOption,
  EditableTargets,
} from "@/modules/core/org/features/structure/components/role-slot";
import type {
  DirectoryUserOption,
  EditableTargets,
} from "@/modules/core/org/features/structure/components/role-slot";

/**
 * **Die Rollenverteilung — eine Fläche, zwei Darstellungen.**
 *
 * Sie zeigt dieselbe Hierarchie wie die Organisation und zeigt sie seit
 * September 2026 auch so: die **Karte** (Bahn je Wertstrom, Spalte je ART,
 * Kachel je Solution) beantwortet „wie sind die Benennungen über die
 * Organisation verteilt, und wo fehlt jemand"; die **Tabelle** beantwortet „wo
 * überall steht Anna". Zwei Fragen, ein Modell.
 *
 * Diese Komponente hält nur den Rahmen: Zustand aus der URL, Filterung,
 * Leerzustände, Umschalter. Gezeichnet wird nebenan.
 *
 * **Gefiltert wird im Client** — anders als bei der Organisation, wo der Server
 * filtert. Der Grund ist die Kopfleiste: ihre Zahlen beschreiben den **ganzen**
 * Bestand („1 Platz offen"), nicht die Auswahl. Sie rechnet deshalb auf den
 * ungefilterten Strömen, während die Fläche darunter die gefilterten zeigt.
 */
export function RoleDirectoryView({
  streams,
  users,
  editable,
}: {
  streams: ValueStreamDirectory[];
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  const t = useTranslations();
  const { params, push } = useUrlState();
  const query = params.get("q") ?? "";
  const onlyUnfilled = params.get("offen") === "1";
  const view = params.get("view") === "tabelle" ? "tabelle" : "karte";

  const stats = directoryStats(streams);
  const shown = filterDirectory(streams, { query, onlyUnfilled });

  if (streams.length === 0) {
    return (
      <EmptyState title={t("org.ui.nochKeinWertstrom")} body={t("org.ui.ohneStrukturGibtEs")} />
    );
  }

  return (
    <div className="space-y-3">
      <RoleDirectoryFilterBar
        view={view}
        // `karte` ist der Standard und braucht keinen Parameter in der URL.
        onViewChange={(next) => push({ view: next === "karte" ? null : next })}
        query={query}
        onQueryChange={(next) => push({ q: next || null })}
        onlyUnfilled={onlyUnfilled}
        onOnlyUnfilledChange={(next) => push({ offen: next ? "1" : null })}
        unfilledCount={stats.unfilled}
      />

      {shown.length === 0 ? (
        <EmptyState
          title={t("org.ui.nichtsGefunden")}
          body={
            onlyUnfilled && query
              ? "Zu dieser Suche gibt es keinen offenen Platz. Nimm den Filter heraus oder suche anders."
              : onlyUnfilled
                ? "Alle Zuständigkeiten sind benannt."
                : "Kein Platz passt zu dieser Suche — sie trifft Person, Rolle und Anliegen."
          }
        />
      ) : view === "karte" ? (
        <RoleDirectoryMap streams={shown} users={users} editable={editable} />
      ) : (
        <RoleDirectoryTable streams={shown} users={users} editable={editable} />
      )}
    </div>
  );
}
