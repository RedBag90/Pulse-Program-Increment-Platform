import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getTenantPractices } from "@/server/services/target-model";
import { ALL_ROLES, ROLE_LABELS, type Role } from "@/modules/core/kernel/domain/roles";
import { moduleForAction, type ModuleKey } from "@/modules/core/kernel/domain/modules";
import { ALL_DUTIES, DUTY_LEVEL_LABEL } from "@/modules/core/org/domain/role-directory";
import { ROLE_PLAYBOOKS, type PlaybookClaim } from "@/modules/onboarding/domain/role-playbook";
import {
  visibleRoleSheets,
  type RoleSheet,
  type RoleSheetClaim,
} from "@/modules/wiki/domain/role-sheet";
import { RoleSheetsView } from "@/modules/wiki/features/wiki/components/role-sheets-view";
import { Page } from "@/components/layout";

/**
 * **Die Rollen** — die Nachschlage-Seite des Wikis.
 *
 * Hier werden die Rollen-Blätter zusammengesetzt, und zwar aus **zwei** Modulen,
 * die sich sonst nicht sehen dürfen: die Sätze stehen in `onboarding`
 * (`ROLE_PLAYBOOKS`), die Zuständigkeiten in `core/org` (`ALL_DUTIES`), und das
 * Wiki darf `onboarding` nicht importieren (ADR-0017, erzwungen von ESLint).
 * Der Kompositionsroot darf es — genau dasselbe Muster wie `resolveFigures()`
 * eine Ebene höher.
 *
 * Der Nutzen ist nicht die Schichtung, sondern die **Einmaligkeit**: kein Satz
 * über eine Rolle wird hier neu getextet. Wer das Playbook ändert, ändert diese
 * Seite mit; eine abgeschriebene Fassung liefe auseinander, und
 * `work/domain/epic-lifecycle-doc.ts` erzählt im eigenen Kopf, wie das ausgeht.
 *
 * Das Segment liegt unter `/wiki` und hängt damit an keinem Entitlement — eine
 * Fläche, die erklärt, darf nie fail-closed weggeleitet werden (ADR-0017).
 * Gefiltert wird je Satz: was der Mandant nicht gebucht hat, wird nicht erklärt.
 */
export default async function WikiRolesPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const practices = await getTenantPractices(db, principal.tenantId);

  const sheets = visibleRoleSheets(roleSheets(), {
    enabledModules: principal.enabledModules as ModuleKey[],
    practices,
    roles: principal.roles as Role[],
  });

  const duties = ALL_DUTIES.map((d) => ({
    key: d.key,
    duty: d.duty,
    role: d.role,
    levelLabel: DUTY_LEVEL_LABEL[d.level],
  }));

  return (
    <Page>
      <RoleSheetsView sheets={sheets} duties={duties} roles={principal.roles as Role[]} />
    </Page>
  );
}

/**
 * **Das Modul einer Aussage — abgeleitet, nicht gepflegt.**
 *
 * Ein Playbook-Satz nennt entweder sein Modul direkt oder die Capability, um die
 * es geht. Aus der Capability folgt das Modul eindeutig (`moduleForAction`), und
 * genau so soll es sein: stünde hier eine eigene Zuordnung, gäbe es eine zweite
 * Antwort auf „wozu gehört `budget.round.manage`" — und die erste steht im
 * Kernel.
 *
 * Die Capability selbst wandert **nicht** ins Blatt. Auf `/meine-rolle` filtert
 * sie, weil dort eine Aufgabe versprochen wird, die der Leser ausführen können
 * muss. Hier wird nachgeschlagen, auch über fremde Rollen — nach dem Recht des
 * Lesers zu filtern hiesse, ihm die Übergaben zu verschweigen.
 */
function toClaim(claim: PlaybookClaim): RoleSheetClaim {
  // Nicht `module` nennen: Next verbietet die Zuweisung an diesen Namen.
  const key = claim.module ?? (claim.capability ? moduleForAction(claim.capability) : null);
  return {
    text: claim.text,
    ...(key != null ? { module: key } : {}),
    ...(claim.practice != null ? { practice: claim.practice } : {}),
  };
}

/** Die acht Blätter in der Reihenfolge von `ALL_ROLES` — Plattform zuerst. */
function roleSheets(): RoleSheet[] {
  return ALL_ROLES.map((role) => {
    const playbook = ROLE_PLAYBOOKS[role];
    return {
      role,
      label: ROLE_LABELS[role],
      mission: playbook.mission,
      responsibilities: playbook.responsibilities.map(toClaim),
      handoffs: playbook.handoffs.map(toClaim),
    };
  });
}
