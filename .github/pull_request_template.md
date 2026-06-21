## Was

<!-- 1–3 Saetze: was aendert dieser PR, welches Problem loest er. -->

## Warum

<!-- Kontext, Bug-Ticket, ADR-Referenz, betroffene Stakeholder. -->

## Wie testen

<!-- Konkrete Klick-Pfade in der App, ggf. mit Test-Tenant + Account. -->

## Definition of Done

- [ ] `pnpm tsc --noEmit` gruen
- [ ] `pnpm test` gruen (oder Begruendung warum nicht)
- [ ] Browser-Smoke des betroffenen Flows
- [ ] Keine offensichtlichen N+1-Queries (im Dev mit `PRISMA_DEBUG=1 pnpm dev` gegengeprueft)
- [ ] Server-Action-Latenz lokal < 600 ms (mit `SERVER_ACTION_TIMING=1 pnpm dev` gegengeprueft, falls neue Action)
- [ ] Bundle-Diff < +30 kB pro Route (mit `ANALYZE=1 pnpm build` gegengeprueft, falls neue Client-Component oder Lib)
- [ ] CONTEXT.md aktualisiert, falls neuer Begriff im Domain-Modell

## Risiken / Rollback

<!-- Was kann brechen? Wie rollback (revert + redeploy reicht oder Daten-Migration noetig)? -->

## Screenshots / Recordings

<!-- Bei UI-Aenderungen: vorher/nachher. Bei Performance: Lighthouse-Score oder Web-Vitals-Konsole. -->
