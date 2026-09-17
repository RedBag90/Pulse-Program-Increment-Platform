import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/ui/section-label";
import { ROAM_LABELS, ROAM_DOT, type RoamStatus } from "@/modules/core/kernel/domain/roam";
import {
  groupRisksByRoam,
  type PortfolioOverview,
  type OverviewRisk,
  type OverviewRiskBand,
} from "@/modules/work/server/views/portfolio-overview";

/** Exposure-Band → Badge-Klassen. Lokale Map, da `risks/.../labels.ts` für das
 *  `work`-Modul gesperrt ist (ADR-0013) — bewusst kleine Duplikation. */
const BAND_BADGE: Record<OverviewRiskBand, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  critical: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

/**
 * Wie viele Einträge eine **bearbeitete** Disposition zeigt, bevor sie
 * aufklappt. „Offen" bekommt bewusst keine Grenze: das ist die Menge, über die
 * noch zu entscheiden ist, und eine halbe Entscheidungsliste ist keine.
 */
const COLLAPSED_LIMIT = 5;

const BAND_LABEL: Record<OverviewRiskBand, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  critical: "Kritisch",
};

/**
 * **Die Risiken als ROAM-Board** — eine Kachel je Disposition statt einer Rolle
 * aus allem.
 *
 * Vorher stand hier **eine** Liste über alle Zustände, nach Exposure sortiert,
 * in einem 384-px-Fenster. Bei 119 Einträgen wirkte sie endlos, und weil ROAM
 * beim Ranking keine Rolle spielt, füllten geminderte Risiken den sichtbaren
 * Kopf — erledigte Arbeit verdrängte das, worüber noch zu entscheiden ist.
 *
 * Die Aufteilung löst beides: jede Kachel trägt genau einen Zustand, und die
 * Exposure-Ordnung darin ist deshalb die richtige.
 *
 * Server-only; Daten kommen als `data.risks` aus dem DTO (der Risks-Adapter
 * formt sie, Work rechnet nicht an `risks`).
 */
export function RisksBlock({ data }: { data: PortfolioOverview }) {
  const byRoam = groupRisksByRoam(data.risks);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Risiken</SectionLabel>
        {data.risks.length > 0 && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {data.risks.length}
          </span>
        )}
      </div>

      {/* Drei Spalten: „Offen" steht allein, weil es die Frage ist, über die zu
          entscheiden ist. Die vier bearbeiteten Zustände teilen sich die beiden
          übrigen Spalten zu zweit. */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* **Die Offen-Spalte nimmt die Zeilenhöhe, statt sie zu setzen.**

            Ab `lg` ist die Karte absolut positioniert und damit aus dem Fluss:
            der Wrapper hat nichts, was ihn hoch macht, also kommt die
            Zeilenhöhe allein aus den Spalten 2 und 3. `align-items: stretch`
            zieht den Wrapper auf diese Höhe, `inset-0` füllt die Karte ihn aus.

            Ohne das war „Offen" mit 27 Zeilen die höchste Kachel und gab die
            Zeilenhöhe vor. Ein fester Deckel wäre keine Lösung: die
            Nachbarspalten wachsen selbst, sobald jemand dort ein `<details>`
            aufklappt — und die Offen-Liste wächst nun mit.

            `lg:row-span-2` trägt hier nicht: ein zeilenübergreifendes Element
            verteilt seine `max-content`-Höhe auf die überspannten Spuren, und
            `auto`-Spuren wachsen darauf mit. */}
        <div className="lg:relative">
          <RoamCard status="open" risks={byRoam.open} className="lg:absolute lg:inset-0" />
        </div>
        <div className="flex h-full flex-col gap-4">
          <RoamCard status="owned" risks={byRoam.owned} limit={COLLAPSED_LIMIT} />
          <RoamCard status="resolved" risks={byRoam.resolved} limit={COLLAPSED_LIMIT} />
        </div>
        <div className="flex h-full flex-col gap-4">
          <RoamCard status="accepted" risks={byRoam.accepted} limit={COLLAPSED_LIMIT} />
          <RoamCard status="mitigated" risks={byRoam.mitigated} limit={COLLAPSED_LIMIT} />
        </div>
      </div>
    </section>
  );
}

/**
 * Eine Disposition mit ihren Risiken.
 *
 * **Drei Klassen an der Liste, und sie gehören zusammen:**
 * `flex-1 min-h-0 max-h-96 lg:max-h-none`.
 *
 * `Card` ist `flex flex-col`, und ab `lg` dehnt das Raster die Karten auf die
 * Zeilenhöhe. `flex-1 min-h-0` lässt die Liste diese Höhe füllen — sonst bleibt
 * sie bei 384 px stehen, während die Karte darunter leer weiterläuft: eine
 * abgeschnittene Liste mit Platz direkt darunter.
 *
 * Der Deckel gilt **nur unterhalb von `lg`**, wo die Karten untereinander
 * stehen und ihre Höhe aus dem Inhalt ziehen; ohne ihn wäre die Offen-Kachel
 * dort ein Turm aus 27 Zeilen.
 *
 * Genau daran ist der Zug davor gescheitert: `max-h-96` stand ohne Breakpoint
 * da. **`max-height` gewinnt gegen Flex-Wachstum**, also hob der Deckel das
 * `flex-1` auf, und bei `lg` änderte sich gar nichts. Die Absicht stand im
 * Kommentar, nicht im Code. Wer den Breakpoint wieder entfernt, baut denselben
 * Fehler ein Drittes Mal.
 *
 * `limit` kappt die sichtbare Liste; der Rest steht in einem `<details>`.
 * Bewusst **kein** `useState`-Knopf: der machte die Datei zur
 * Client-Komponente und zöge das ganze Risiko-DTO in den Browser. `<details>`
 * ist ausserdem das Muster, das im Haus schon vier Mal steht.
 */
function RoamCard({
  status,
  risks,
  limit,
  className,
}: {
  status: RoamStatus;
  risks: readonly OverviewRisk[];
  limit?: number;
  /** Positionierung von aussen — die Offen-Spalte nimmt sich damit aus dem Fluss. */
  className?: string;
}) {
  const shown = limit != null ? risks.slice(0, limit) : risks;
  const rest = limit != null ? risks.slice(limit) : [];
  return (
    <Card className={cn("flex min-h-0 flex-1 flex-col gap-3 p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${ROAM_DOT[status]}`} />
          <SectionLabel>{ROAM_LABELS[status]}</SectionLabel>
        </span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{risks.length}</span>
      </div>

      {risks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Risiken in diesem Zustand.</p>
      ) : (
        /* Beide Listen teilen sich **einen** Scrollkasten: aufgeklappt wächst
           die Liste innerhalb der Karte, nicht die Seite — sonst spränge das
           Drei-Spalten-Raster bei jedem Klick. */
        <div className="min-h-0 max-h-96 flex-1 space-y-2 overflow-y-auto lg:max-h-none">
          <ul className="space-y-2">
            {shown.map((r) => (
              <RiskRow key={r.id} risk={r} />
            ))}
          </ul>
          {rest.length > 0 && (
            <details className="text-label text-muted-foreground">
              <summary className="cursor-pointer select-none hover:text-foreground">
                {rest.length} weitere
              </summary>
              <ul className="mt-2 space-y-2">
                {rest.map((r) => (
                  <RiskRow key={r.id} risk={r} />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Eine Risiko-Zeile: Exposure-Badge, Titel, verknüpftes Epic.
 *
 * Der ROAM-Punkt stand hier früher mit drin. Er steht jetzt im Kartenkopf; ihn
 * je Zeile zu wiederholen wäre Rauschen, und der gewonnene Platz geht an den
 * Titel, der vorher abbrach.
 */
function RiskRow({ risk: r }: { risk: OverviewRisk }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={`mt-0.5 shrink-0 rounded-sm px-1.5 py-0.5 text-label font-medium uppercase tracking-[0.1em] ${
          r.band ? BAND_BADGE[r.band] : "bg-muted text-muted-foreground"
        }`}
        title={r.band ? `Exposure: ${BAND_LABEL[r.band]} (${r.score})` : "Ungescored"}
      >
        {r.band ? BAND_LABEL[r.band] : "—"}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href="/risks"
          className="block truncate text-xs font-medium hover:text-primary hover:underline"
          title={r.title}
        >
          {r.title}
        </Link>
        {r.epic && (
          <p className="truncate text-label text-muted-foreground">
            Epic:{" "}
            <Link
              href={`/portfolio/epics/${r.epic.id}`}
              className="hover:text-primary hover:underline"
            >
              {r.epic.title}
            </Link>
          </p>
        )}
      </div>
    </li>
  );
}
