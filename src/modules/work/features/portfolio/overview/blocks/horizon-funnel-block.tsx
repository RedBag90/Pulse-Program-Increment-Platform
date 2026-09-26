"use client";

import { useLocale, useTranslations } from "next-intl";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { formatScaledEUR } from "@/lib/formatting";
import type { Locale } from "@/i18n/routing";
import { lighten, darken } from "@/lib/color";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import {
  HORIZON_HEX,
  HORIZON_NONE_HEX,
} from "@/modules/core/org/features/solution/components/horizon-tokens";
import {
  fitFunnel,
  halfAt,
  stripRowOf,
  DEFAULT_GEOMETRY as G,
  type FunnelBand,
  type FunnelItem,
  type HorizonTargets,
  type PlacedItem,
  type Station,
} from "@/modules/work/features/portfolio/lib/horizon-funnel";

/**
 * **Der Horizont-Trichter** — über dem Kanban: welches Produkt steht in welchem
 * Horizont, und wie viel Geld bindet es dort im **laufenden Budget-Zyklus**.
 *
 * Zwei Größen, beide gemessen: der **Abstand der Kurven** ist das Geld eines
 * Horizonts, die **Größe eines Symbols** das Geld, das es bindet. Die **Breite**
 * eines Bandes sagt gar nichts — alle belegten Bänder sind gleich breit, die
 * waagerechte Achse ist eine reine Lebenszyklus-Achse. Sie zählte bis September
 * 2026 die Symbole, und damit bekam H3 mit 16 kleinen Posten 73 % der Breite,
 * während H1 mit dem meisten Geld 14 % behielt. Beide Zusicherungen sind im
 * Test festgehalten, nicht im Auge.
 *
 * Die Silhouette ist damit kein Trichter im Lehrbuchsinn: sie zeigt, was der
 * Datensatz sagt. Klumpt das Geld im Kern, wird sie zur Keule.
 *
 * Ein Klick führt auf die Fläche, auf der der Wechsel tatsächlich stattfindet —
 * die Produktseite mit ihrer Lebenszyklus-Leiter samt Beförderungs-Kriterien.
 */

/**
 * **Die Köpfe im Trichter stehen je Station, nicht je Band** — und sie tragen
 * Klarnamen statt H-Codes.
 *
 * Hier stand `{...HORIZON_KEYS, h1: "H1 · Investing & Extracting"}`: eine
 * Tabelle, die drei Schlüssel und ein Wort mischte, und die Zeichenstelle
 * rendert sie **roh**. Auf dem Bildschirm standen deshalb drei
 * `org.horizon.*` neben einem deutschen Notbehelf — den sein eigener Docblock
 * als solchen benannte.
 *
 * Der Trichter rechnet seit dem Fünf-Stationen-Umbau ohnehin in `STATIONS`
 * (`h3, h2, h1.1, h1.2, h0`), jede mit eigener Öffnung und eigenem Ziel; nur
 * die Beschriftung war je Band geblieben. Jetzt bekommt H1 zwei Köpfe, links
 * und rechts seiner Trennlinie.
 *
 * **Nur hier.** Abzeichen, Struktur-Baum und Rollenverzeichnis zeigen weiter
 * „H2 · Emerging" — die Codes tragen Spalten und Filter, die Klarnamen tragen
 * den Trichter. Zwei Vokabulare für dieselbe Sache, bewusst, und beide aus dem
 * Katalog.
 */
const STATION_TITLE_KEYS: Record<Station, string> = {
  h3: "work.funnelStation.h3",
  h2: "work.funnelStation.h2",
  // Die Stations-Ids tragen einen Punkt (`h1.1`), Katalog-Schlüssel dürfen das
  // nicht: der Paritätstest liest sie als Verschachtelung und findet dort
  // keinen Text. Die Namen sagen ohnehin mehr als die Nummern.
  "h1.1": "work.funnelStation.h1Investing",
  "h1.2": "work.funnelStation.h1Extracting",
  h0: "work.funnelStation.h0",
};

/**
 * Die Achse unter dem Trichter — **je Station**, nicht je Horizont.
 *
 * H1 zerfällt seit dem Fünf-Stationen-Umbau in Investing und Extracting, und
 * die beiden stehen nebeneinander; ein gemeinsamer Fuß „Investing · Extracting"
 * hing zwischen ihnen und gehörte keiner von beiden. Die zweite Zeile sagt, was
 * in der Station tatsächlich geschieht — das Wort allein sagt es nicht.
 */
const AXIS: Record<Station, { word: string; detail: string }> = {
  h3: { word: "Evaluating", detail: "Analysen und Research" },
  h2: { word: "Emerging", detail: "Piloten und MVPs" },
  "h1.1": { word: "Investing", detail: "Up and coming Products" },
  "h1.2": { word: "Extracting", detail: "Produkte im Regelbetrieb" },
  h0: { word: "Retiring", detail: "Currently in Phase-Out" },
};

/** Nutzbare Kartenbreite; darüber staucht die `viewBox` das ganze Bild. */
const TARGET_WIDTH = 1100;
/** Unter dieser gestauchten Schriftgröße wandern die Namen in die Legende. */
const MIN_READABLE_PX = 8;
const LABEL_PX = 12;

/**
 * Unterkante der Bänder und Oberkante des Streifens — **aus dem Layout**, nicht
 * aus `G.maxHalf`.
 *
 * Die Zeichnung rechnete ihre Höhe früher aus der Konstanten aus. Das ging,
 * solange die Öffnung nie darüber hinauswuchs; seit ein gedrängtes Band sie
 * aufweitet, muss die Höhe der tatsächlichen Ausdehnung folgen, sonst liefe der
 * Inhalt unten aus dem Bild.
 */
const footOf = (layout: { mid: number; maxHalf: number }) => layout.mid + layout.maxHalf + 58;

/**
 * Der Streifen, in Zeilen statt in geratenen Abständen.
 *
 * Vorher standen Beschreibung und Symbole **nebeneinander**: der Text bei
 * `x0 + 16`, die Symbole bei einem festen `+300`. Der Satz ist bei 11 px rund
 * 440 px breit, also lief er in die ersten Symbole hinein. Eine bessere
 * Schätzung hätte die Fehlerklasse behalten — eine Umformulierung des Satzes
 * hätte sie jederzeit zurückgeholt. Deshalb liegen die Symbole jetzt in einer
 * **eigenen Zeile** unter beiden Textzeilen und laufen über die volle Breite.
 */
const STRIP_PAD = 16;
const STRIP_TITLE_Y = 21;
const STRIP_NOTE_Y = 38;
/** Oberkante der Symbolzeile, relativ zum Streifen. */
const STRIP_ROW_Y = 46;
/** Mindesthöhe der Symbolzeile; größere Symbole machen sie höher (`stripRowOf`). */
const STRIP_ROW_H = 44;
/** Abstand zwischen Bandfuß und Streifen. */
const STRIP_GAP = 34;

/**
 * **Die Zeichnung misst ihre Breite, statt sie zu raten.**
 *
 * Zwei Fassungen davor scheiterten an derselben Ursache. Ließ man die `viewBox`
 * per `w-full` auf die Kartenbreite dehnen, wuchs jede Schrift mit — seit die
 * Bänder gleich breit sind, misst die Zeichnung nämlich **immer genau**
 * `TARGET_WIDTH`, also skaliert sie auf jeder breiteren Karte hoch. Deckelte
 * man die Breite dagegen, blieb rechts Weißraum, und der Trichter stand
 * schmaler da als das Kanban darunter.
 *
 * Serverseitig ist die Breite nicht zu wissen: `<main>` im Dashboard ist fluide,
 * ohne `max-w`. Jede feste Zielbreite ist auf der einen Fenstergröße zu schmal
 * und auf der anderen zu breit. Deshalb misst der Block seinen Container —
 * `fitFunnel` ist rein und läuft im Browser genauso.
 *
 * `useLayoutEffect` statt `useEffect`, damit die Messung **vor** dem ersten
 * Anstrich greift und das Bild nach der Hydration nicht sichtbar springt.
 */
function useMeasuredWidth(): [React.RefObject<HTMLDivElement | null>, number | null] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el == null) return;
    const apply = (w: number) =>
      setWidth((prev) => (prev != null && Math.abs(prev - w) < 1 ? prev : w));
    apply(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w != null && w > 0) apply(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/**
 * Unter dieser Breite wird nicht weiter umgebrochen, sondern wieder gestaucht.
 *
 * Ohne die Grenze stünde auf einem Telefon jedes Band einspaltig, und die
 * Zeichnung würde absurd hoch. Mit ihr bekommt die Lesbarkeitsschwelle
 * (`MIN_READABLE_PX`) ihren Sinn zurück: sie war unerreichbar, seit die Breite
 * immer der Zielbreite entsprach.
 */
const MIN_LAYOUT_WIDTH = 720;

/** Isometrischer Würfel; der dunkle Sockel ist der Betriebsanteil. */
function Cube({ item }: { item: PlacedItem }) {
  const z = item.size;
  const { cx, cy } = item;
  const base = item.horizon ? HORIZON_HEX[item.horizon] : HORIZON_NONE_HEX;
  const runShare = item.total > 0 ? item.run / item.total : 0;
  const pts = {
    top: `${cx},${cy - z} ${cx + z},${cy - z / 2} ${cx},${cy} ${cx - z},${cy - z / 2}`,
    left: `${cx - z},${cy - z / 2} ${cx},${cy} ${cx},${cy + z} ${cx - z},${cy + z / 2}`,
    right: `${cx + z},${cy - z / 2} ${cx},${cy} ${cx},${cy + z} ${cx + z},${cy + z / 2}`,
  };
  if (item.total === 0) {
    return (
      <g>
        {Object.values(pts).map((p, i) => (
          <polygon
            key={i}
            points={p}
            fill="none"
            stroke={base}
            strokeWidth={1.6}
            strokeDasharray="3 2"
          />
        ))}
      </g>
    );
  }
  const socle = (side: "l" | "r") => {
    const sx = side === "l" ? cx - z : cx + z;
    return `${sx},${cy + z / 2 - z * runShare} ${cx},${cy + z - 2 * z * runShare} ${cx},${cy + z} ${sx},${cy + z / 2}`;
  };
  // **Drei Tönungen desselben Tons, keine Deckkraft.** Über Weiß wäscht eine
  // 0,55-Fläche aus, statt beleuchtet zu wirken; und der Betriebssockel lag als
  // reines Schwarz darüber, was eine Farbe schmutzig macht statt dunkler.
  return (
    <g>
      <polygon points={pts.top} fill={lighten(base, 0.38)} />
      <polygon points={pts.left} fill={lighten(base, 0.14)} />
      <polygon points={pts.right} fill={base} />
      {runShare > 0 && (
        <>
          <polygon points={socle("l")} fill={darken(base, 0.28)} />
          <polygon points={socle("r")} fill={darken(base, 0.38)} />
        </>
      )}
    </g>
  );
}

/**
 * Ein Betrag, wie ihn diese Fläche schreibt.
 *
 * **Die Null bekommt Worte.** Ein Produkt, das im Zyklus nichts bindet, und ein
 * Betriebsposten über 49.000 € lasen sich beide als „0,0 Mio €" — die Einheit
 * war fest, und unterhalb ihrer Auflösung sagte das Bild dasselbe über zwei
 * verschiedene Sachverhalte. `formatScaledEUR` löst die Einheit, dieser Helfer
 * die Null: „kein Geld" ist dieselbe Sprache, die die Bandbeschriftung schon
 * spricht (`kein Geld · Mindestöffnung`).
 */
/** Der Klick führt dorthin, wo das Symbol seine Heimat hat. */
const hrefOf = (item: PlacedItem): string => {
  if (item.kind === "solution") return `/structure/solution/${item.id}`;
  // Betrieb ohne Produkt gehört dem Wertstrom — dort wird er gepflegt.
  if (item.kind === "run") return `/budgeting/value-streams/${item.id.replace(/^run:/, "")}`;
  return `/portfolio/epics/${item.id}`;
};

/**
 * **Was ein Symbol beziffert** — je nach Modus Geld oder laufende Epics.
 *
 * Ohne Budget-Modul darf hier kein Betrag mehr stehen: die Zahl wäre überall
 * null, und die Karte behauptete eine Aussage, die sie nicht hat.
 *
 * Als Hook, weil jede dieser Wendungen übersetzt wird und jeder Betrag die
 * Sprache braucht — bis September 2026 standen sie als deutsche Literale in
 * Modul-Konstanten, die kein Übersetzer erreichte.
 */
function useFunnelWords() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const amountOf = (n: number) =>
    n === 0 ? t("work.overview.funnelKeinGeld") : formatScaledEUR(n, locale);
  const countOf = (n: number) =>
    n === 1 ? t("work.overview.funnelEinEpic") : t("work.overview.funnelEpicsAnzahl", { count: n });
  const moneyOf = (item: PlacedItem) =>
    item.run > 0
      ? t("work.overview.funnelDavonBetrieb", {
          total: amountOf(item.total),
          run: amountOf(item.run),
        })
      : amountOf(item.total);
  const measureOf = (item: PlacedItem, budgetingEnabled: boolean) =>
    budgetingEnabled ? moneyOf(item) : countOf(item.count);
  const bandMeasureOf = (value: number, minimal: boolean, budgetingEnabled: boolean) =>
    budgetingEnabled
      ? minimal
        ? t("work.overview.funnelBandKeinGeld")
        : formatScaledEUR(value, locale)
      : minimal
        ? t("work.overview.funnelLegendNothingInProgress")
        : countOf(value);
  /**
   * Die Bandzeile: Ist, dahinter das Ziel laut Guardrail, wo es eines gibt.
   * Ein Schlüssel je Variante — die Zeile wird nicht aus Stücken gebaut.
   */
  const bandLineOf = (b: FunnelBand, budgetingEnabled: boolean) => {
    const measure = bandMeasureOf(b.money, b.minimal, budgetingEnabled);
    const dense = b.enlarged && !b.minimal;
    if (budgetingEnabled && b.targetMoney != null) {
      const target = formatScaledEUR(b.targetMoney, locale);
      return dense
        ? t("work.overview.funnelBandDenseMitZiel", { measure, target })
        : t("work.overview.funnelBandMitZiel", { measure, target });
    }
    return dense ? t("work.overview.funnelBandDense", { measure }) : measure;
  };
  return { amountOf, countOf, measureOf, bandLineOf };
}

function Symbol({
  item,
  withLabel,
  budgetingEnabled,
}: {
  item: PlacedItem;
  withLabel: boolean;
  budgetingEnabled: boolean;
}) {
  const base = item.horizon ? HORIZON_HEX[item.horizon] : HORIZON_NONE_HEX;
  const { amountOf, countOf, measureOf } = useFunnelWords();
  return (
    <Link href={hrefOf(item)} aria-label={`${item.name}: ${measureOf(item, budgetingEnabled)}`}>
      <g className="cursor-pointer [&:hover>g]:opacity-80">
        <title>{`${item.name} — ${measureOf(item, budgetingEnabled)}`}</title>
        {item.kind !== "epic" ? (
          <Cube item={item} />
        ) : (
          <g>
            {/* Kontur in einer dunkleren Tönung des eigenen Tons: die schwarze
                Kontur kämpfte gegen die Füllung, statt sie zu fassen. */}
            <circle cx={item.cx} cy={item.cy} r={item.size * 0.85} fill={base} />
            <circle
              cx={item.cx}
              cy={item.cy}
              r={item.size * 0.85}
              fill="none"
              stroke={darken(base, 0.3)}
              strokeWidth={1.4}
            />
          </g>
        )}
        {withLabel && (
          <>
            <text
              x={item.cx}
              y={item.box.y + item.box.h - 13}
              textAnchor="middle"
              fontSize={LABEL_PX}
              fontWeight={700}
              className="fill-foreground"
            >
              {item.label}
            </text>
            <text
              x={item.cx}
              y={item.box.y + item.box.h - 2}
              textAnchor="middle"
              fontSize={10}
              className="fill-muted-foreground"
            >
              {budgetingEnabled ? amountOf(item.total) : countOf(item.count)}
            </text>
          </>
        )}
      </g>
    </Link>
  );
}

interface FunnelProps {
  items: FunnelItem[];
  /** `null` = es gilt gerade kein Budget-Rahmen (`appliedPeriod`). */
  cycleKey: string | null;
  /** Soll-Verteilung (Guardrail) — `null` = keine Vergleichslinie. */
  horizonTargets: HorizonTargets | null;
  /**
   * Budgettopf des Halbjahres — Basis der Zielbeträge (abzüglich der Kosten
   * ohne Produkt-Zuordnung). `null` = keine Zielbeträge, nur die Silhouette.
   */
  pool: number | null;
  /**
   * Budget-Modul an? Aus ⇒ es gibt kein Geld zu messen. Dann misst die
   * Zeichnung die **laufenden Epics** (L3.2–L4.2), und jede Beschriftung, die
   * von Geld spricht, muss schweigen — sonst behauptet die Karte etwas, das
   * sie nicht zeigt.
   */
  budgetingEnabled: boolean;
}

/**
 * Der leere Zustand steht **vor** der Zeichnung, damit die Hooks darin
 * unbedingt laufen: ein früher Rücksprung mitten zwischen Hooks wäre ein
 * Regelbruch, kein Stilfehler.
 */
export function HorizonFunnelBlock({
  items,
  cycleKey,
  horizonTargets,
  pool,
  budgetingEnabled,
}: FunnelProps) {
  const t = useTranslations();
  if (items.length === 0) {
    return (
      <Card className="space-y-2 p-4">
        <SectionLabel>{t("work.overview.produkteImInvestitionshorizont")}</SectionLabel>
        <p className="text-sm text-muted-foreground">
          {t("work.overview.nochKeineProdukteAngelegt")}
        </p>
      </Card>
    );
  }
  return (
    <FunnelCard
      items={items}
      cycleKey={cycleKey}
      horizonTargets={horizonTargets}
      pool={pool}
      budgetingEnabled={budgetingEnabled}
    />
  );
}

function FunnelCard({ items, cycleKey, horizonTargets, pool, budgetingEnabled }: FunnelProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { amountOf, countOf, bandLineOf } = useFunnelWords();
  const [wrapRef, measured] = useMeasuredWidth();

  const layout = useMemo(
    () =>
      fitFunnel(
        items,
        Math.max(MIN_LAYOUT_WIDTH, measured ?? TARGET_WIDTH),
        undefined,
        undefined,
        horizonTargets,
        { sizing: budgetingEnabled ? "money" : "count", pool },
      ),
    [items, measured, horizonTargets, budgetingEnabled, pool],
  );
  const { bands, profile } = layout;
  const split = layout.h1;
  // Die beiden Beschriftungen hängen an der **schmaleren** der beiden
  // Öffnungen, nicht an der Kurvenhöhe auf der Trennlinie selbst. Dort steht
  // die Kurve mitten in ihrer Rampe und damit über dem Plateau der ärmeren
  // Hälfte — deren Beschriftung landete auf der Kurve und wurde von ihr
  // durchgestrichen. Das flachere Plateau ist die Höhe, unter der beide frei
  // liegen, und es hält die beiden Beschriftungen zugleich auf einer Grundlinie.
  const h1Stations = bands.find((b) => b.horizon === "h1")?.stations ?? [];
  const splitTopY =
    split == null
      ? 0
      : layout.mid -
        (h1Stations.length > 0
          ? Math.min(...h1Stations.map((z) => z.half))
          : halfAt(profile, split.splitX));
  // Solange die Karte breiter ist als die Untergrenze, ist die Zeichnung genau
  // so breit wie sie — der Faktor ist dann exakt 1 und die `fontSize`-Werte
  // kommen an, wie sie dastehen.
  const zoom = Math.min(1, (measured ?? TARGET_WIDTH) / layout.width);
  const withLabels = LABEL_PX * zoom >= MIN_READABLE_PX;
  const total = items.reduce((n, i) => n + i.invest + i.run, 0);
  const productCount = items.filter((i) => i.kind === "solution").length;
  const first = bands[0]!;
  const last = bands[bands.length - 1]!;

  // Die Kurve als Streckenzug: alle 4 px abgetastet, damit die S-Übergänge in
  // den Lücken weich aussehen, ohne Bézier-Kontrollpunkte von Hand zu setzen.
  const curveOf = (p: readonly [number, number][], from: number, to: number, sign: 1 | -1) => {
    const pts: string[] = [];
    for (let x = from; x <= to; x += 4)
      pts.push(`${x},${(layout.mid + sign * halfAt(p, x)).toFixed(1)}`);
    pts.push(`${to},${(layout.mid + sign * halfAt(p, to)).toFixed(1)}`);
    return `M${pts.join(" L")}`;
  };
  const curve = (from: number, to: number, sign: 1 | -1) => curveOf(profile, from, to, sign);
  // H0 gestrichelt, solange seine Öffnung gesetzt und nicht gemessen ist.
  const cut = last.minimal ? last.x0 : last.x1;
  const FOOT = footOf(layout);
  const STRIP_Y = FOOT + STRIP_GAP;
  // Die Zeile wächst mit dem größten Symbol darin, statt es hinausragen zu lassen.
  const stripRow = stripRowOf(layout.homeless, STRIP_ROW_H);
  const STRIP_H = STRIP_ROW_Y + stripRow.rowH + 6;
  const height = layout.homeless.length > 0 ? STRIP_Y + STRIP_H + 12 : FOOT + 34;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionLabel>{t("work.overview.produkteImInvestitionshorizont")}</SectionLabel>
        <p className="text-xs text-muted-foreground">
          {!budgetingEnabled
            ? t("work.overview.funnelSubtitleNoBudget", { count: productCount })
            : cycleKey
              ? t("work.overview.funnelSubtitleBudgetCycle", {
                  count: productCount,
                  amount: formatScaledEUR(total, locale),
                  cycle: halfYearLabel(cycleKey),
                })
              : t("work.overview.funnelSubtitleBudget", {
                  count: productCount,
                  amount: formatScaledEUR(total, locale),
                })}
        </p>
      </div>

      {/* Die Basis der Zielbeträge, einmal genannt: ohne sie wäre „Ziel 25 T€"
          eine Zahl, die niemand nachrechnen kann. */}
      {budgetingEnabled && horizonTargets != null && layout.targetBasis != null && (
        <p className="text-xs text-muted-foreground">
          {t("work.overview.funnelZielBasis", {
            base: formatScaledEUR(layout.targetBasis.base, locale),
            pool: formatScaledEUR(layout.targetBasis.pool, locale),
            homeless: formatScaledEUR(layout.targetBasis.homeless, locale),
          })}
        </p>
      )}

      {!budgetingEnabled ? null : cycleKey == null ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t("work.overview.esGiltGeradeKein")}
        </p>
      ) : (
        total === 0 && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {t("work.overview.funnelNoBudgetInCycle", { cycle: halfYearLabel(cycleKey) })}
          </p>
        )
      )}

      {layout.dropped.length > 0 && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {t("work.overview.funnelNotDrawn", {
            names: layout.dropped.map((d) => d.name).join(", "),
          })}
        </p>
      )}
      {layout.collisions.length > 0 && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {t("work.overview.funnelOverlap", { names: layout.collisions.join(", ") })}
        </p>
      )}

      <div ref={wrapRef}>
        <svg
          viewBox={`0 0 ${layout.width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Horizont-Trichter: Produkte nach Investitionshorizont, Größe nach ${
            budgetingEnabled ? "gebundenem Geld" : "Epics in Umsetzung"
          }`}
        >
          {bands.map((b) => (
            <g key={b.horizon}>
              <rect
                x={b.x0}
                y={8}
                width={b.x1 - b.x0}
                height={FOOT - 20}
                // Über `transparent` gemischt statt mit fester Deckkraft über
                // Weiß: so bleibt der Hauch theme-fest, statt einen hellen Wert
                // einzubrennen, der im dunklen Thema als Fleck stehen bliebe.
                fill={`color-mix(in srgb, ${HORIZON_HEX[b.horizon]} 7%, transparent)`}
              />
              {b.stations.map((st) => (
                <text
                  key={st.station}
                  x={(st.x0 + st.x1) / 2}
                  y={26}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill={HORIZON_HEX[b.horizon]}
                >
                  {t(STATION_TITLE_KEYS[st.station])}
                </text>
              ))}
              <text
                x={(b.x0 + b.x1) / 2}
                y={42}
                textAnchor="middle"
                fontSize={10.5}
                className="fill-muted-foreground"
              >
                {bandLineOf(b, budgetingEnabled)}
              </text>
              {/* Je Station ein Fuss, mittig unter ihrem **Plateau**. Die
                  Zeichnung fuehrt die Stationen selbst — nachgerechnet aus der
                  Bandbreite saessen die Fuesse seit der Stationsluecke um 6 px
                  versetzt. Traegt H1 nichts, fuehrt das Band nur eine Station:
                  dann steht dort **ein** Fuss statt zweier gequetschter. */}
              {b.stations.map((z) => {
                const st = z.station;
                const cx = (z.x0 + z.x1) / 2;
                return (
                  <g key={st}>
                    <text
                      x={cx}
                      y={FOOT}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={600}
                      className="fill-muted-foreground"
                    >
                      {AXIS[st].word}
                    </text>
                    <text
                      x={cx}
                      y={FOOT + 13}
                      textAnchor="middle"
                      fontSize={10}
                      className="fill-muted-foreground/70"
                    >
                      {AXIS[st].detail}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}

          {/* Die **Soll-Verteilung** (Guardrail „Investment by Horizon") als
              zweite, dünne Silhouette: wo die Kurve verliefe, wenn das Budget
              den Zielanteilen folgte. Sie liegt unter der Ist-Kurve, damit
              diese im Vordergrund bleibt. */}
          {layout.targetProfile != null &&
            ([1, -1] as const).map((sign) => (
              <path
                key={`target-${sign}`}
                d={curveOf(layout.targetProfile!, first.x0, last.x1, sign)}
                fill="none"
                className="stroke-muted-foreground"
                strokeWidth={1.2}
                strokeDasharray="5 4"
                opacity={0.65}
              />
            ))}

          {/* Die Silhouette. */}
          {([1, -1] as const).map((sign) => (
            <g key={sign}>
              <path
                d={curve(first.x0, cut, sign)}
                fill="none"
                className="stroke-foreground"
                strokeWidth={4.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {cut < last.x1 && (
                <path
                  d={curve(cut, last.x1, sign)}
                  fill="none"
                  className="stroke-foreground"
                  strokeWidth={4.5}
                  strokeLinecap="round"
                  strokeDasharray="9 8"
                  opacity={0.5}
                />
              )}
            </g>
          ))}

          {/* Die Tore: in der Lücke zwischen zwei Plateaus, dort wo die Kurve
            wandert — und dort wird auch entschieden. */}
          {bands.slice(0, -1).map((b, i) => {
            const x = (b.x1 + bands[i + 1]!.x0) / 2;
            return (
              <line
                key={`gate-${b.horizon}`}
                x1={x}
                y1={layout.mid - halfAt(profile, x)}
                x2={x}
                y2={layout.mid + halfAt(profile, x)}
                className="stroke-border"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            );
          })}

          {/* H1.1 | H1.2 — dieselbe Trennung wie auf der Lebenszyklus-Leiter.
            Sie steht dauerhaft, sobald H1 überhaupt etwas trägt: eine leere
            Hälfte ist die Auskunft („nichts wird investiert"), nicht der Grund,
            die Linie wegzulassen. Und weil beide Hälften ihr Geld nennen,
            beantwortet das Bild die Frage, für die es die Teilung gibt. */}
          {split != null && (
            <>
              <line
                x1={split.splitX}
                y1={layout.mid - halfAt(profile, split.splitX)}
                x2={split.splitX}
                y2={layout.mid + halfAt(profile, split.splitX)}
                stroke={HORIZON_HEX.h1}
                strokeWidth={1.4}
                strokeDasharray="5 5"
                opacity={0.85}
              />
              {[
                ["H1.1 · Investing", split.investing, "end", -8] as const,
                ["H1.2 · Extracting", split.extracting, "start", 8] as const,
              ].map(([label, money, anchor, dx]) => (
                <g key={label}>
                  <text
                    x={split.splitX + dx}
                    y={splitTopY + 15}
                    textAnchor={anchor}
                    fontSize={10}
                    fontWeight={700}
                    fill={HORIZON_HEX.h1}
                  >
                    {label}
                  </text>
                  <text
                    x={split.splitX + dx}
                    y={splitTopY + 28}
                    textAnchor={anchor}
                    fontSize={10}
                    className="fill-muted-foreground"
                  >
                    {budgetingEnabled ? amountOf(money) : countOf(money)}
                  </text>
                </g>
              ))}
            </>
          )}

          {layout.items.map((i) => (
            <Symbol
              key={i.id}
              item={i}
              withLabel={withLabels}
              budgetingEnabled={budgetingEnabled}
            />
          ))}

          {/* Der Streifen: was keinen Horizont hat, zählt in keinem Band mit. */}
          {layout.homeless.length > 0 && (
            <g>
              <rect
                x={first.x0}
                y={STRIP_Y}
                width={last.x1 - first.x0}
                height={STRIP_H}
                rx={10}
                fill="none"
                className="stroke-border"
                strokeWidth={1.4}
                strokeDasharray="6 5"
              />
              <text
                x={first.x0 + 16}
                y={STRIP_Y + STRIP_TITLE_Y}
                fontSize={11}
                fontWeight={700}
                className="fill-muted-foreground"
              >
                {t("work.overview.ohneProduktZuordnung")}
              </text>
              <text
                x={first.x0 + 16}
                y={STRIP_Y + STRIP_NOTE_Y}
                fontSize={11}
                className="fill-muted-foreground"
              >
                {t("work.overview.epicsOhneProduktUnd")}
              </text>
              {layout.homeless.map((i) => (
                <Symbol
                  key={i.id}
                  item={{
                    ...i,
                    // Die Packung legt die Symbole ab `G.padding` ab; hier zählt
                    // der linke Rand des Streifens, nicht der der Zeichnung.
                    cx: i.cx - G.padding + first.x0 + STRIP_PAD,
                    cy: STRIP_Y + STRIP_ROW_Y + stripRow.cyOffset,
                    box: {
                      ...i.box,
                      x: i.box.x - G.padding + first.x0 + STRIP_PAD,
                      y: STRIP_Y + STRIP_ROW_Y,
                      h: stripRow.rowH,
                    },
                  }}
                  withLabel={withLabels}
                  budgetingEnabled={budgetingEnabled}
                />
              ))}
            </g>
          )}
        </svg>
      </div>

      {/* Die Zeichnung trägt sechs Bedeutungen, und keine erklärt sich von
          selbst. Die Legende nennt **nur, was man nicht raten kann** — was in
          der Kopfzeile steht (Zyklus, Grundlage der Größe), wiederholt sie
          nicht. Die Guardrail-Linie steht darin, weil sie sonst als
          Zeichenfehler durchginge. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-label text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-2 rotate-45 bg-muted-foreground/70" />
          {t("work.overview.produkt")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-muted-foreground/70" />
          {t("work.overview.epicOhneProdukt")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full border border-dashed border-muted-foreground/70" />
          {budgetingEnabled
            ? t("work.overview.funnelLegendNoMoney")
            : t("work.overview.funnelLegendNothingInProgress")}
        </li>
        {budgetingEnabled ? (
          <>
            <li>{t("work.overview.funnelLegendSizeMoney")}</li>
            <li>{t("work.overview.funnelLegendRunBase")}</li>
            <li>{t("work.overview.funnelLegendCurveMoney")}</li>
          </>
        ) : (
          <>
            {/* Der Sockel entfällt von selbst: ohne Budget-Modul gibt es keinen
                Betrieb, den er zeigen könnte. */}
            <li>{t("work.overview.funnelLegendSizeEpics")}</li>
            <li>{t("work.overview.funnelLegendDotEpic")}</li>
            <li>{t("work.overview.funnelLegendCurveEpics")}</li>
          </>
        )}
        {layout.targetProfile != null && (
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-px w-4 border-t border-dashed border-muted-foreground" />
            {t("work.overview.guardrailZiel")}
          </li>
        )}
      </ul>

      {/* Zu eng für Beschriftungen am Symbol: die Namen wandern nach unten.
          Position und Größe — die beiden echten Aussagen — bleiben im Bild. */}
      {!withLabels && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {[...layout.items, ...layout.homeless].map((i) => (
            <li key={i.id}>
              <Link href={hrefOf(i)} className="hover:text-foreground hover:underline">
                <span className="font-medium text-foreground">{i.name}</span>{" "}
                {budgetingEnabled ? amountOf(i.total) : countOf(i.count)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
