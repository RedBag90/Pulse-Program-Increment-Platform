# Module: `drumbeat`

Detailliertes Planen/Ausführen: Cockpit, PI-Planung, Dependencies, Roadmap, Kapazität. Benötigt `work`.

- **Darf importieren von:** work, core.
- **Darf NICHT importieren von:** budgeting (Schwester-Schicht — `drumbeat ⊥ budgeting`).
- **Wird importiert von:** `src/app`.
- **Konsumiert:** Work-Read-Ports + Core-Org; Schreib-Seiteneffekte auf Work via Domain-Events.

Status: **Skelett** (Phase P1). Inhalte wandern in P5 hierher.
