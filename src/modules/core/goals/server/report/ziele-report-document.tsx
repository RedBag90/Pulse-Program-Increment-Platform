import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";
import { GOAL_STATUS_TIER_HEX } from "@/modules/core/goals/domain/goal-status";
import type { ZieleReport } from "@/modules/core/goals/domain/ziele-report";

/**
 * **Der Ziele-Bericht auf dem Blatt.**
 *
 * Hier steht nur noch, wie es liegt — *was* daraufsteht, entscheidet
 * `domain/ziele-report.ts`. Diese Datei rechnet nichts.
 *
 * **Warum es diese Datei überhaupt gibt.** Vorher entstand ein PDF nur über
 * „Drucken → Als PDF sichern", und damit riet der Browser die Umbrüche: Zeilen
 * zerrissen, Tabellenköpfe verschwanden nach dem ersten Seitenwechsel, und
 * niemand konnte sagen, welche Seite die dritte von wie vielen war. Genau
 * diese vier Dinge sind hier ausgeschrieben statt erhofft:
 *
 * - `fixed` an Kopf und Fuss ⇒ Mandant und Titel stehen auf **jeder** Seite;
 * - `render={({ pageNumber, totalPages }) => …}` ⇒ „Seite 3 von 12";
 * - `fixed` an der Tabellenkopfzeile ⇒ der Kopf wiederholt sich nach jedem
 *   Umbruch, statt nur einmal ganz oben zu stehen;
 * - `wrap={false}` an der Zeile ⇒ ein Ziel bricht nie mitten durch.
 *
 * **Keine DOM-Komponenten.** `@react-pdf` bringt eigene Primitive mit; `View`
 * ist kein `div`. Die Datei liegt deshalb unter `server/` und darf nie im
 * Client-Bundle landen.
 *
 * **Schrift:** die eingebauten Standardschriften (Helvetica). Sie tragen
 * WinAnsi und damit Umlaute und ß — eine eigene Schriftdatei wäre eine
 * Verfeinerung, keine Voraussetzung.
 */

/** Spaltenbreiten in Punkt; die Namensspalte nimmt den Rest. */
const SPALTE = { owner: 74, status: 62, progress: 46, value: 84, timeframe: 62 } as const;

const styles = StyleSheet.create({
  page: {
    // Der Fuss steht `fixed` am unteren Rand — der Inhalt braucht darunter
    // Platz, sonst schreibt die letzte Zeile in die Seitenzahl hinein.
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1f2937",
  },

  kopf: { marginBottom: 14 },
  kopfZeile: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  mandant: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  datum: { fontSize: 9, color: "#6b7280" },
  titel: { fontSize: 10, color: "#6b7280", marginTop: 2 },
  trennlinie: { borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginTop: 8 },

  filter: { marginBottom: 12 },
  filterZeile: { flexDirection: "row", marginBottom: 1 },
  filterName: { width: 74, color: "#6b7280" },
  filterWert: { flex: 1 },

  kennzahlen: { flexDirection: "row", marginBottom: 14 },
  kennzahl: { marginRight: 26 },
  kennzahlWert: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  kennzahlName: { fontSize: 8, color: "#6b7280", marginTop: 1 },
  stufen: { flexDirection: "row", alignItems: "center" },
  stufe: { flexDirection: "row", alignItems: "center", marginRight: 12 },
  punkt: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },

  tabellenKopf: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#9ca3af",
    paddingBottom: 3,
    marginBottom: 2,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#4b5563",
  },
  zeile: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  name: { flex: 1, paddingRight: 8 },
  rechts: { textAlign: "right" },
  gedaempft: { color: "#6b7280" },

  fuss: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9ca3af",
  },

  leer: { marginTop: 24, textAlign: "center", color: "#6b7280" },
});

/** Eine Spaltenbreite als Style — `flex` bleibt der Namensspalte vorbehalten. */
const w = (breite: number) => ({ width: breite });

export function ZieleReportDocument({ report }: { report: ZieleReport }) {
  const { filters, summary, rows } = report;

  return (
    <Document
      title={`Ziele-Bericht ${report.tenantName}`}
      author="Pulse"
      language="de"
      // Ohne das erbt das PDF den Standardtitel des Erzeugers — in der
      // Dateiverwaltung des Lesers steht dann „Untitled".
    >
      <Page size="A4" style={styles.page}>
        {/* Kopf und Fuss stehen auf jeder Seite: wer Seite 7 ausgedruckt in die
            Hand bekommt, soll sehen, wessen Bericht das ist. */}
        <View style={styles.kopf} fixed>
          <View style={styles.kopfZeile}>
            <Text style={styles.mandant}>{report.tenantName}</Text>
            <Text style={styles.datum}>Stand {report.generatedAt}</Text>
          </View>
          <Text style={styles.titel}>Ziele — Übersicht</Text>
          <View style={styles.trennlinie} />
        </View>

        {/* Das Filter-Echo. Ein Bericht zeigt einen Ausschnitt; verschweigt er
            das, behauptet er etwas Falsches. */}
        <View style={styles.filter}>
          <Filterzeile name="Zeitraum" wert={filters.periods} />
          <Filterzeile name="Wertstrom" wert={filters.valueStreams} />
          <Filterzeile name="ART" wert={filters.arts} />
          <Filterzeile name="Status" wert={filters.statuses} />
        </View>

        <View style={styles.kennzahlen}>
          <View style={styles.kennzahl}>
            <Text style={styles.kennzahlWert}>{summary.averageProgress}</Text>
            <Text style={styles.kennzahlName}>Ø Fortschritt</Text>
          </View>
          <View style={styles.kennzahl}>
            <Text style={styles.kennzahlWert}>{summary.goalCount}</Text>
            <Text style={styles.kennzahlName}>Ziele im Ausschnitt</Text>
          </View>
          <View>
            <View style={styles.stufen}>
              {summary.tiers.map((t) => (
                <View key={t.tier} style={styles.stufe}>
                  <View style={[styles.punkt, { backgroundColor: GOAL_STATUS_TIER_HEX[t.tier] }]} />
                  <Text>
                    {t.count} {t.label}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.kennzahlName}>Top-Ziele nach Status</Text>
          </View>
        </View>

        {rows.length === 0 ? (
          <Text style={styles.leer}>Keine Ziele in diesem Ausschnitt.</Text>
        ) : (
          <>
            {/* `fixed` wiederholt den Kopf nach jedem Umbruch. Ohne ihn stehen
                ab Seite zwei nur noch Zahlen ohne Spaltennamen. */}
            <View style={styles.tabellenKopf} fixed>
              <Text style={styles.name}>Ziel</Text>
              <Text style={w(SPALTE.owner)}>Owner</Text>
              <Text style={w(SPALTE.status)}>Status</Text>
              <Text style={[w(SPALTE.progress), styles.rechts]}>Fortschritt</Text>
              <Text style={[w(SPALTE.value), styles.rechts]}>Wert</Text>
              <Text style={[w(SPALTE.timeframe), styles.rechts]}>Zeitraum</Text>
            </View>

            {rows.map((row) => (
              // `wrap={false}`: lieber die Zeile auf die nächste Seite schieben,
              // als sie in der Mitte durchschneiden.
              <View key={row.id} style={styles.zeile} wrap={false}>
                <Text style={[styles.name, { paddingLeft: row.depth * 12 }]}>{row.title}</Text>
                <Text style={[w(SPALTE.owner), styles.gedaempft]}>{row.owner}</Text>
                <Text style={w(SPALTE.status)}>{row.status}</Text>
                <Text style={[w(SPALTE.progress), styles.rechts]}>{row.progress}</Text>
                <Text style={[w(SPALTE.value), styles.rechts, styles.gedaempft]}>{row.value}</Text>
                <Text style={[w(SPALTE.timeframe), styles.rechts, styles.gedaempft]}>
                  {row.timeframe}
                </Text>
              </View>
            ))}
          </>
        )}

        <View style={styles.fuss} fixed>
          <Text>Pulse · Ziele-Bericht</Text>
          <Text render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function Filterzeile({ name, wert }: { name: string; wert: string }) {
  return (
    <View style={styles.filterZeile}>
      <Text style={styles.filterName}>{name}</Text>
      <Text style={styles.filterWert}>{wert}</Text>
    </View>
  );
}

/**
 * Der Bericht als PDF-Puffer — die einzige Eintrittstelle nach draussen.
 *
 * Sie hält den Cast, den `renderToBuffer` verlangt: es typt sein Argument als
 * `ReactElement<DocumentProps>`, während die Komponente ihre eigenen Props
 * trägt. Das ist eine Eigenheit der Bibliothek, kein Zweifel am Element — und
 * sie gehört an **eine** Stelle statt an jede Aufrufstelle.
 *
 * Nebenbei hält sie React aus der Route heraus: die weiss nur noch, dass sie
 * einen Puffer bekommt.
 */
export function renderZieleReport(report: ZieleReport): Promise<Buffer> {
  const element = (<ZieleReportDocument report={report} />) as React.ReactElement<DocumentProps>;
  return renderToBuffer(element);
}
