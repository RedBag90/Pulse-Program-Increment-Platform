import type { DomainError } from "@/modules/core/kernel/domain/errors";
import type { Translate } from "@/i18n/translate";

/**
 * Per-action overrides for `formatDomainError`. Each field replaces the
 * default for one error shape; everything else falls through.
 *
 * **Die Felder tragen Katalog-Schlüssel, keine Sätze** (ADR-0024): eine
 * Fehlermeldung ist Oberfläche wie jede andere, nur erscheint sie an einem
 * schlechteren Tag.
 */
export interface DisplayOverrides {
  /** Ersetzt die Vorgabe bei `not_found`. */
  notFoundKey?: string;
  /** Ersetzt `e.reason` bei `conflict`. */
  conflictKey?: string;
  /** Ersetzt `e.reason` bei `forbidden`. */
  forbiddenKey?: string;
  /** Für Fehlerarten ohne eigene Vorgabe (Auffangfall). */
  fallbackKey?: string;
}

/**
 * Macht aus einem `DomainError` einen Satz für den Nutzer. Die Naht, die jede
 * Action-Fabrik früher für sich selbst erfand, liegt hier genau einmal.
 *
 * Vorgaben (ohne Overrides):
 *   - `conflict`            → `e.reason`, übersetzt
 *   - `not_found`           → `"<Ressource> nicht gefunden"`
 *   - `forbidden`           → `e.reason`, übersetzt
 *   - `tenant_mismatch`     → `errors.tenantMismatch`
 *   - `validation`          → `errors.validation` (selten — Feldfehler kommen eigens)
 *   - `hierarchy_violation` → `e.detail`, übersetzt
 *   - `pyramid_violated`    → `errors.pyramidViolated`
 *
 * **`forbidden` zeigt seinen Grund, wie `conflict` auch.** Bis Zug 5 warf
 * diese Naht `e.reason` bei `forbidden` weg und zeigte stattdessen einen
 * Einheitssatz — weshalb sich drei Actions eine eigene Verzweigung gebaut
 * hatten, nur um den Grund sichtbar zu machen. Die Sätze dort sind geschrieben,
 * nicht generiert („Nur der Sprecher darf die Verteilung einreichen."), und
 * einem Nutzer zu sagen, *warum* er nicht darf, ist die halbe Meldung.
 *
 * Eine Ausnahme trug das mit: `authorizeResource` fiel auf
 * `Principal <id> lacks permission for <action>` zurück — technisch, englisch
 * und nichts, was ein Nutzer lesen soll. Die Stelle legt seither
 * `errors.forbidden` ab; der Einheitssatz steht damit dort, wo er entsteht,
 * statt als Vorgabe einer Anzeigefunktion.
 *
 * **`reason` und `detail` tragen Schlüssel.** Die Services legen dort seit
 * Zug 5 `work.errors.…` ab statt eines deutschen Satzes; `t` löst ihn hier
 * auf. Ein Wert, den der Katalog nicht kennt, kommt unverändert zurück — das
 * ist die Eigenschaft, die den Umbau überhaupt stückweise möglich gemacht hat.
 */
/**
 * **`resourceType` wird kleingeschrieben nachgeschlagen.**
 *
 * Die Services schreiben denselben Typ in drei Fassungen — `ART`, `Art` und
 * `art`, dazu `EPIC` neben `Epic`; 45 Schreibweisen für 34 Ressourcen. Der
 * Katalog trug nur eine davon, also rendert `next-intl` bei den übrigen still
 * den Schlüssel: „errors.resource.art nicht gefunden". Solange die Services
 * uneinheitlich sind, gleicht das hier die Schreibweise an, statt die
 * Unordnung in den Katalog zu kopieren.
 */
export const resourceKey = (resourceType: string): string =>
  `errors.resource.${resourceType.toLowerCase()}`;

export function formatDomainError(
  e: DomainError,
  overrides: DisplayOverrides = {},
  t: Translate,
): string {
  const uebersetzt = (schluessel: string | undefined, vorgabe: string): string =>
    t(schluessel ?? vorgabe);

  switch (e.kind) {
    case "conflict":
      return t(overrides.conflictKey ?? e.reason, e.values);
    case "not_found":
      return overrides.notFoundKey
        ? t(overrides.notFoundKey)
        : t("errors.notFound", { resource: t(resourceKey(e.resourceType)) });
    case "forbidden":
      return t(overrides.forbiddenKey ?? e.reason, e.values);
    case "tenant_mismatch":
      return overrides.fallbackKey
        ? t(overrides.fallbackKey)
        : t("errors.tenantMismatch", e.values);
    case "validation":
      return uebersetzt(overrides.fallbackKey, "errors.validation");
    case "hierarchy_violation":
      return overrides.fallbackKey ? t(overrides.fallbackKey) : t(e.detail, e.values);
    case "pyramid_violated":
      return uebersetzt(overrides.fallbackKey, "errors.pyramidViolated");
  }
}
