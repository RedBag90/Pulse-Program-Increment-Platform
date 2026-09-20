"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { saveViewPreference } from "@/modules/core/kernel/server/view-preference";

/**
 * Die eigene Ansicht einer Flaeche merken.
 *
 * Selbstbedienung wie das Rollen-Onboarding: `view_preference.manage` hat jede
 * Rolle inklusive `viewer`, der Dienst schreibt ohnehin nur auf `principal.id`,
 * und die RLS-Politik isoliert die Zeilen zusaetzlich auf Mandant **und**
 * Nutzer. Der Schluessel kommt vom Aufrufer; eine Liste erlaubter Schluessel
 * gibt es bewusst nicht — sie muesste jede Kachel kennen, und ein erfundener
 * Schluessel schreibt nur eine Zeile, die niemand liest.
 *
 * **Bewusst ohne `revalidate`.** Ein Sortierklick darf keine Seite neu laden;
 * die gespeicherte Wahl wirkt beim **naechsten** Oeffnen, und dort kommt sie aus
 * dem Loader. Die Flaeche haelt ihren eigenen Zustand waehrend der Sitzung.
 */
/**
 * Der Wert reist als **JSON-Text**, nicht als Objekt: eine Server-Action bekommt
 * `FormData`, und darin gibt es nur Strings. Er wird hier geparst statt im
 * Dienst, damit ein kaputter Text als Eingabefehler zurueckkommt und nicht als
 * Ausnahme.
 *
 * Was *innerhalb* des JSON gueltig ist, prueft das Schema bewusst **nicht** —
 * das weiss nur die Flaeche, die es schreibt, und jeder Leser prueft es ohnehin
 * gegen sein eigenes Vokabular (`parseContributionView`). Ein zentrales Schema
 * muesste jede Kachel kennen, also genau die Kopplung, die dieser Speicher
 * vermeidet.
 */
const jsonText = z
  .string()
  .max(4000)
  .superRefine((raw, ctx) => {
    try {
      JSON.parse(raw);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Kein gueltiges JSON" });
    }
  });

export const saveViewPreferenceAction = createServerAction({
  schema: z.object({ key: z.string().min(1).max(200), value: jsonText }),
  action: "view_preference.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ key: fields(fd).string("key"), value: fields(fd).string("value") }),
  service: (ctx, input) =>
    saveViewPreference(ctx, { key: input.key, value: JSON.parse(input.value) as unknown }),
  mapError: () => "Die Ansicht konnte nicht gespeichert werden",
});
