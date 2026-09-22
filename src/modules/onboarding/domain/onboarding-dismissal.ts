import type { DismissedSteps } from "@/modules/onboarding/domain/role-tour";

/**
 * **„Diesen Hinweis brauche ich nicht mehr."**
 *
 * Bis September 2026 gab es dafür keinen Ort. „Nicht jetzt" setzte lokalen
 * React-State — der Hinweis kam nach jedem Seitenaufbau wieder, und der Code
 * sagte das auch so (`role-onboarding-mount.tsx`: „weggeklickt wird nur im
 * Arbeitsspeicher gemerkt"). Es fehlte nicht die Umsetzung, sondern die
 * Möglichkeit, überhaupt nein zu sagen.
 *
 * **Gemerkt werden Schritte, nicht Rollen.** Das erhält genau die Eigenschaft,
 * für die `RoleOnboarding.seenStepKeys` eine Menge ist: wird später ein Modul
 * freigeschaltet, sind dessen Tour-Schritte neu und dürfen wieder angeboten
 * werden. Eine Sperre je Rolle verschlänge sie stumm.
 *
 * **Nicht in `seenStepKeys`.** Der billige Weg wäre, abgelehnte Schritte als
 * „gesehen" wegzuschreiben — vorhandene Action, kein neues Konstrukt. Er wäre
 * aber eine Lüge, und „Tour erneut starten" könnte die zwei danach nicht mehr
 * auseinanderhalten.
 *
 * **Ablage:** `ViewPreference` (`key` + JSON-`value`, tenant- und
 * nutzergebunden). Die Tabelle ist ausdrücklich als Sammelstelle für solche
 * Merker angelegt, bringt Service, Action, RLS, Teardown und ein für alle
 * Rollen gültiges Recht mit — und kostet damit keine Schema-Änderung.
 */
export const ONBOARDING_DISMISSED_KEY = "onboarding.dismissedSteps";

/** Der Merker, wenn noch nie etwas abgelehnt wurde. */
export const NO_DISMISSED_STEPS: DismissedSteps = {};

/**
 * Aus dem, was in der Datenbank steht, wird ein Merker, mit dem die
 * Entscheidung rechnen kann — **immer**. Kein Wurf, kein `null`.
 *
 * Ein gespeicherter Wert überlebt Code-Änderungen: eine Rolle kann
 * verschwinden, ein Schritt umbenannt werden. Beides ist unkritisch, weil hier
 * nur gefiltert wird — ein Schlüssel, den es nicht mehr gibt, filtert nichts.
 * Geprüft wird darum nur die **Form**, nicht das Vokabular.
 */
export function parseDismissedSteps(raw: unknown): DismissedSteps {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return NO_DISMISSED_STEPS;
  const out: Record<string, string[]> = {};
  for (const [role, keys] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(keys)) continue;
    const sauber = keys.filter((k): k is string => typeof k === "string");
    if (sauber.length > 0) out[role] = sauber;
  }
  return out;
}

/**
 * Schritte einer Rolle als abgelehnt vermerken — additiv und doppelfrei.
 *
 * Additiv, weil zwei Ablehnungen nacheinander beide gelten sollen: wer heute
 * die eine Hälfte einer Tour abbricht und morgen die andere wegklickt, hat
 * beides abgelehnt, nicht nur das Letzte.
 */
export function withDismissed(
  current: DismissedSteps,
  role: string,
  stepKeys: readonly string[],
): DismissedSteps {
  if (stepKeys.length === 0) return current;
  return { ...current, [role]: [...new Set([...(current[role] ?? []), ...stepKeys])] };
}

/**
 * Die Ablehnungen einer Rolle verwerfen — der Gegenzug zu „Tour erneut
 * starten".
 *
 * Ohne ihn wäre eine Ablehnung unumkehrbar, und der Knopf auf `/meine-rolle`
 * eine leere Zusage: er leerte `seenStepKeys`, während der Merker die Schritte
 * weiter verschluckte.
 */
export function withoutRole(current: DismissedSteps, role: string): DismissedSteps {
  if (!(role in current)) return current;
  const { [role]: _weg, ...rest } = current;
  return rest;
}
