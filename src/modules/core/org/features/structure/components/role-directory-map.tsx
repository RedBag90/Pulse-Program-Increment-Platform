"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  HORIZON_HEX,
  HORIZON_NONE_HEX,
} from "@/modules/core/org/features/solution/components/horizon-tokens";
import { horizonShort, isHorizon } from "@/modules/core/org/domain/horizon";
import {
  Lane,
  LaneGroup,
  type LaneColumn,
} from "@/modules/core/org/features/structure/components/structure-lanes";
import { nodeHref } from "@/modules/core/org/features/structure/components/structure-routes";
import {
  RoleCell,
  type DirectoryUserOption,
  type EditableTargets,
} from "@/modules/core/org/features/structure/components/role-slot";
import {
  unfilledCount,
  type ArtDirectory,
  type SolutionDirectory,
  type ValueStreamDirectory,
} from "@/modules/core/org/domain/role-directory";

/**
 * **Die Rollenverteilung als Landkarte** — dieselbe Form wie die Organisation,
 * mit Personen statt Geld.
 *
 * Die Hierarchie ist dieselbe und wird deshalb gleich gezeichnet: je Wertstrom
 * eine Bahn, darin die ARTs als Spalten, darin die Solutions als Kacheln. Wer
 * die eine Fläche gelesen hat, liest die andere ohne Umlernen.
 *
 * **Die vier Wertstrom-Rollen stehen im Streifen**, nicht in einer Spalte: sie
 * gehören dem Wertstrom selbst und keinem ART. Als fünfte Spalte hätten sie so
 * ausgesehen, als stünden sie neben den ARTs — sie stehen aber darüber.
 */
export function RoleDirectoryMap({
  streams,
  users,
  editable,
}: {
  streams: ValueStreamDirectory[];
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  return (
    <LaneGroup>
      {streams.map((vs) => (
        <StreamLane key={vs.id} vs={vs} users={users} editable={editable} />
      ))}
    </LaneGroup>
  );
}

function StreamLane({
  vs,
  users,
  editable,
}: {
  vs: ValueStreamDirectory;
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  const t = useTranslations();
  const offen = unfilledCount(vs);

  const columns: LaneColumn[] = vs.arts.map((art) => ({
    key: art.id,
    children: <ArtColumn art={art} users={users} editable={editable} />,
  }));
  if (vs.looseSolutions.length > 0) {
    columns.push({
      key: "ohne-art",
      children: (
        <>
          <p className="text-xs font-semibold text-muted-foreground">{t("org.ui.ohneArt")}</p>
          {vs.looseSolutions.map((so) => (
            <SolutionTile key={so.id} solution={so} users={users} editable={editable} />
          ))}
        </>
      ),
    });
  }

  return (
    <Lane
      head={
        <>
          <Link
            href={nodeHref("vs", vs.id)}
            className="text-sm font-semibold tracking-tight hover:text-primary hover:underline"
          >
            {vs.name}
          </Link>
          <span className="text-label uppercase tracking-[0.1em] text-muted-foreground">
            Wertstrom · {vs.arts.length} ART{vs.arts.length === 1 ? "" : "s"}
          </span>
          {offen > 0 && (
            // Dieselbe Form wie `GapBadge` auf der Organisations-Fläche: gleiche
            // Stelle, gleiche Aufgabe, gleiche Marke.
            <span className="ml-auto shrink-0 rounded-full bg-warning-surface px-1.5 text-label font-semibold text-warning">
              {offen} offen
            </span>
          )}
        </>
      }
      strip={
        vs.entries.length > 0 ? (
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
            {vs.entries.map((e) => (
              <RoleCell key={e.key} entry={e} users={users} editable={editable} />
            ))}
          </div>
        ) : undefined
      }
      columns={columns}
      empty={<p className="p-4 text-xs text-muted-foreground">{t("org.ui.nochKeinArtIn")}</p>}
    />
  );
}

function ArtColumn({
  art,
  users,
  editable,
}: {
  art: ArtDirectory;
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  const t = useTranslations();
  const offen = [...art.entries, ...art.solutions.flatMap((so) => so.entries)].filter(
    (e) => e.userId === null,
  ).length;

  return (
    <>
      {/* Dieselbe Reihe wie drüben: Name, Typwort, rechts die Warnmarke. Das
          ART hier trägt keine Kadenz — die Rollenverteilung kennt keine PIs —,
          deshalb steht das Wort allein. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className="size-1.5 shrink-0 translate-y-[-1px] rounded-[2px] bg-emerald-600"
          aria-hidden
        />
        <Link
          href={nodeHref("art", art.id)}
          className="min-w-0 text-xs font-semibold [overflow-wrap:anywhere] hover:text-primary hover:underline"
        >
          {art.name}
        </Link>
        <span className="text-label uppercase tracking-[0.1em] text-muted-foreground">
          {t("org.page.art")}
        </span>
        {offen > 0 && (
          <span className="ml-auto shrink-0 text-meta tabular-nums text-warning">
            {offen} offen
          </span>
        )}
      </div>

      {art.entries.map((e) => (
        <RoleCell key={e.key} entry={e} users={users} editable={editable} />
      ))}

      {art.solutions.map((so) => (
        <SolutionTile key={so.id} solution={so} users={users} editable={editable} />
      ))}
    </>
  );
}

/**
 * Die Kachel ist dieselbe wie auf der Organisations-Fläche, **inklusive der
 * Farbe**: die Akzentschiene trägt den Horizont, nicht ein allgemeines Violett.
 * Dieselbe Solution sähe sonst hier anders aus als dort, und niemand erkennt,
 * dass es dasselbe Ding ist.
 *
 * Sie ist allerdings **kein Link**, anders als drüben: in ihr steht ein
 * Bedienelement, und ein Button in einem Link ist ungültiges HTML. Anklickbar
 * ist deshalb der Name.
 */
function SolutionTile({
  solution,
  users,
  editable,
}: {
  solution: SolutionDirectory;
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  const horizon = isHorizon(solution.horizon) ? solution.horizon : null;
  return (
    <div
      style={{ borderLeftColor: horizon ? HORIZON_HEX[horizon] : HORIZON_NONE_HEX }}
      className={cn("flex flex-col gap-1.5 rounded-md border-l-[3px] bg-muted/40 p-2.5")}
    >
      {/* Hier trägt das Typwort den Horizont: diese Kachel zeigt keine
          Abzeichen, die Schiene ist sonst eine Farbe ohne Namen. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Link
          href={nodeHref("solution", solution.id)}
          className="min-w-0 text-xs font-medium [overflow-wrap:anywhere] hover:text-primary hover:underline"
        >
          {solution.name}
        </Link>
        <span className="text-label uppercase tracking-[0.1em] text-muted-foreground">
          Solution{horizon ? ` · ${horizonShort(horizon)}` : ""}
        </span>
      </div>
      {solution.entries.map((e) => (
        <RoleCell key={e.key} entry={e} users={users} editable={editable} />
      ))}
    </div>
  );
}
