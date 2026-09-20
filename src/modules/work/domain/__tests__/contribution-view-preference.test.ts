import { describe, it, expect } from "vitest";
import {
  CONTRIBUTION_SORT_KEYS,
  DEFAULT_ASC,
  DEFAULT_CONTRIBUTION_VIEW,
  parseContributionView,
} from "@/modules/work/domain/contribution-view-preference";
import { CONTRIBUTION_AXES } from "@/modules/work/domain/contribution-grouping";

/**
 * **Der Parser ist die ganze Absicherung dieser Ablage.**
 *
 * In `view_preferences` steht beliebiges JSON — der Speicher prueft den Inhalt
 * bewusst nicht, weil er jede Kachel kennen muesste. Der gespeicherte Wert
 * ueberlebt dabei Code-Aenderungen: wird eine Achse umbenannt oder ein
 * Sortierschluessel entfernt, liegt in der Datenbank ein Wert, den es nicht mehr
 * gibt. Ungeprueft durchgereicht liefert `CONTRIBUTION_AXIS_COLUMNS[axis]` dann
 * eine **leere Spaltenueberschrift**.
 *
 * Diese Datei haelt fest, dass aus jeder Eingabe eine renderbare Einstellung
 * wird — und dass dabei nur die veraltete Haelfte verloren geht, nicht die ganze.
 */
describe("parseContributionView", () => {
  it("nimmt einen vollstaendigen, gueltigen Wert unveraendert", () => {
    expect(parseContributionView({ axis: "valueStream", sortKey: "realized", asc: true })).toEqual({
      axis: "valueStream",
      sortKey: "realized",
      asc: true,
    });
  });

  it.each([null, undefined, "je Epic", 42, [], true])(
    "liefert bei %o die Vorgabe statt eines halben Objekts",
    (raw) => {
      expect(parseContributionView(raw)).toEqual(DEFAULT_CONTRIBUTION_VIEW);
    },
  );

  it("eine Achse, die es nicht mehr gibt, kostet nur die Achse", () => {
    const v = parseContributionView({ axis: "abteilung", sortKey: "deviation", asc: false });
    expect(v.axis).toBe(DEFAULT_CONTRIBUTION_VIEW.axis);
    // Die gueltige Haelfte ueberlebt — sonst verloere eine Umbenennung beide
    // Schalter, obwohl nur einer betroffen ist.
    expect(v.sortKey).toBe("deviation");
    expect(v.asc).toBe(false);
  });

  it("ein Sortierschluessel, den es nicht mehr gibt, nimmt seine Richtung mit", () => {
    const v = parseContributionView({ axis: "art", sortKey: "romi", asc: true });
    expect(v.axis).toBe("art");
    expect(v.sortKey).toBe(DEFAULT_CONTRIBUTION_VIEW.sortKey);
    // `asc: true` stand fuer „romi aufsteigend". Zu einem anderen Schluessel ist
    // das keine Information, also gilt dessen Vorzugsrichtung.
    expect(v.asc).toBe(DEFAULT_ASC[DEFAULT_CONTRIBUTION_VIEW.sortKey]);
  });

  it("ein halbes Objekt wird vollstaendig", () => {
    expect(parseContributionView({ axis: "solution" })).toEqual({
      axis: "solution",
      sortKey: DEFAULT_CONTRIBUTION_VIEW.sortKey,
      asc: DEFAULT_ASC[DEFAULT_CONTRIBUTION_VIEW.sortKey],
    });
  });

  it("eine Richtung, die kein Boolean ist, faellt auf die des Schluessels zurueck", () => {
    expect(parseContributionView({ sortKey: "deviation", asc: "ja" }).asc).toBe(
      DEFAULT_ASC.deviation,
    );
  });

  it("jede bekannte Achse und jeder Schluessel kommen unveraendert durch", () => {
    for (const axis of CONTRIBUTION_AXES) {
      expect(parseContributionView({ axis }).axis).toBe(axis);
    }
    for (const sortKey of CONTRIBUTION_SORT_KEYS) {
      expect(parseContributionView({ sortKey }).sortKey).toBe(sortKey);
    }
  });

  it("die Vorgabe ist selbst ein gueltiger Wert — sonst waere der Rueckfall keiner", () => {
    expect(parseContributionView(DEFAULT_CONTRIBUTION_VIEW)).toEqual(DEFAULT_CONTRIBUTION_VIEW);
  });
});
