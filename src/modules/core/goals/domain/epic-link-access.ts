/**
 * Wer ein Epic an ein Ziel hängen darf — **als reine Regel**.
 *
 * Die Verknüpfung trägt zwei verschiedene Handlungen in einer Aktion:
 *
 *  - Das **blanke Anhängen**: „dieses Vorhaben zahlt auf jenes Ziel ein." Das
 *    ist Autorenarbeit am Epic und Teil des Vorschlags, den der VMO im ersten
 *    Review (L0 → L1) bestätigt.
 *  - Das **Binden eines bezifferten Beitrags**: eine KPI, ein Umrechnungsfaktor,
 *    eine Wirkungsart. Diese Zahl rollt in den Ziel-Trio und ist eine Zusage.
 *
 * Bis September 2026 verlangten beide `kpi.bind`. Das Standard-Bündel gibt
 * `epic.create`/`epic.update` an Portfolio-Manager, **Epic Owner** und
 * Wertstrom-Owner, `kpi.bind` aber nur an Portfolio-Manager und Tenant-Admin.
 * Ein Epic Owner konnte sein Epic also anlegen, aber nicht sagen, worauf es
 * einzahlt — die Fläche bot ihm das Feld an, und die Aktion antwortete
 * „Insufficient permissions", nachdem das Epic bereits stand.
 *
 * Rein, kein I/O.
 */

export interface EpicLinkAccessFacts {
  /** Der Aufrufer darf dieses Epic schreiben (`epic.update`). */
  mayEditEpic: boolean;
  /** Der Aufrufer darf einen bezifferten Wertbeitrag binden (`kpi.bind`). */
  mayBindKpi: boolean;
}

const NO_EDIT =
  "Nur wer das Epic bearbeiten darf, kann es einem Ziel zuordnen (Capability `epic.update`).";
const NO_BIND =
  "Einen bezifferten Wertbeitrag an ein Ziel zu binden ist dem Portfolio-Management vorbehalten (Capability `kpi.bind`).";

/**
 * `null` = erlaubt. Sonst der Grund — wie `potWindowClosedReason` und
 * `rtbManageDeniedReason`: sagen, **warum** nicht, statt nur „nein".
 *
 * `withKpiContribution` beschreibt die Handlung, nicht die Absicht: beim
 * Anhängen ist es die **gewählte** KPI, beim Lösen die, die an der bestehenden
 * Verknüpfung hängt. Eine bezifferte Verknüpfung zu lösen nimmt denselben Wert
 * wieder weg, den ihr Anlegen zugesagt hat — deshalb dieselbe Hürde.
 */
export function epicLinkDeniedReason(
  facts: EpicLinkAccessFacts,
  withKpiContribution: boolean,
): string | null {
  if (withKpiContribution) return facts.mayBindKpi ? null : NO_BIND;
  // `kpi.bind` schließt das blanke Anhängen mit ein — wer das Schwerere darf,
  // darf auch das Leichtere. Sonst verlöre das Portfolio-Management ein Recht,
  // das es heute hat.
  if (facts.mayEditEpic || facts.mayBindKpi) return null;
  return NO_EDIT;
}
