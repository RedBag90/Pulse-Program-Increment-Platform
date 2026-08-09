# Module: `core`

Fundament (immer verfügbare Free-Basis). Enthält Kernel + Goals/OKR + Org-Struktur (VS→ART→Team).

- **Darf importieren von:** nichts (keine anderen Module) — Core ist die unterste Schicht.
- **Wird importiert von:** work, drumbeat, budgeting, `src/app`.
- **Owns (Ziel):** Infra (`server/{auth,db,audit,events,outbox,http}`, `components`, `lib`, `i18n`),
  Initiative-Substrat, KPI, Goals, Org-Struktur (Value Stream / ART / Team).

Status: **Skelett** (Phase P1). Inhalte wandern in P2 hierher — siehe
[docs/concepts/module-migration-roadmap.md](../../../docs/concepts/module-migration-roadmap.md) und
[ADR-0013](../../../docs/adr/0013-module-layering-and-prerequisites.md).
