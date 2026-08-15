"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { ALL_ROLES, type Role } from "@/modules/core/kernel/domain/roles";
import {
  acknowledgeRole,
  markStepsSeen,
  restartTour,
} from "@/modules/onboarding/server/services/role-onboarding";

/**
 * Selbstbedienung auf der eigenen Onboarding-Zeile. Alle drei Actions laufen
 * über dieselbe Capability `role.onboarding.manage`, die jede Rolle inklusive
 * `viewer` hat — der Service schreibt ohnehin nur auf `principal.id`, und die
 * RLS-Policy isoliert die Zeilen zusätzlich auf Tenant **und** Nutzer.
 */

const roleSchema = z.custom<Role>(
  (v) => typeof v === "string" && (ALL_ROLES as readonly string[]).includes(v),
  { message: "Unbekannte Rolle" },
);

/**
 * Rolle annehmen. Revalidiert nur `/meine-rolle`: das Willkommensfenster hängt
 * am Dashboard-Layout und wird nach dem Annehmen clientseitig geschlossen —
 * beim nächsten Seitenaufbau ist die Quittung ohnehin gesetzt.
 */
export const acknowledgeRoleAction = createServerAction({
  schema: z.object({ role: roleSchema }),
  action: "role.onboarding.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ role: fields(fd).string("role") }),
  service: (ctx, input) => acknowledgeRole(ctx, input),
  revalidate: "roleOnboarding",
  mapError: () => "Die Rolle konnte nicht bestätigt werden",
});

/**
 * Gesehene Schritte melden — bewusst **ohne** `revalidate`. Der Client hält den
 * Tour-Zustand lokal; ein Server-Re-Render pro Schrittwechsel wäre reine
 * Verschwendung und würde die laufende Tour sichtbar ruckeln lassen.
 */
export const markStepsSeenAction = createServerAction({
  schema: z.object({
    role: roleSchema,
    stepKeys: z.array(z.string().min(1).max(120)).min(1).max(50),
  }),
  action: "role.onboarding.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    role: fields(fd).string("role"),
    stepKeys: fd.getAll("stepKeys").map(String),
  }),
  service: (ctx, input) => markStepsSeen(ctx, input),
  mapError: () => "Der Tour-Fortschritt konnte nicht gespeichert werden",
});

/** Tour zurücksetzen (Wiedereinstieg über `/meine-rolle`). */
export const restartTourAction = createServerAction({
  schema: z.object({ role: roleSchema }),
  action: "role.onboarding.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ role: fields(fd).string("role") }),
  service: (ctx, input) => restartTour(ctx, input),
  revalidate: "roleOnboarding",
  mapError: () => "Die Tour konnte nicht zurückgesetzt werden",
});
