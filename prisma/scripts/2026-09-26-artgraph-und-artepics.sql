-- Pulse: zwei Anweisungen aus dem Plan vom 26.09.2026.
-- Einzeln ausführbar, beide umkehrbar.

-- 1) ART-Epics starten künftig eingeschaltet (F1).
--    Bestehende Zielbilder bleiben unberührt; der Default gilt nur für neue.
ALTER TABLE target_operating_models ALTER COLUMN art_epics SET DEFAULT true;

-- 2) Gespeicherte Netzplan-Positionen im Umsetzungsmodul (A2).
--    Spiegelt `initiative_graph_positions`: keine DB-Defaults (Prisma erzeugt
--    `id` und `updated_at` clientseitig), keine RLS.
CREATE TABLE public.art_graph_positions (
  id            uuid                        NOT NULL,
  tenant_id     uuid                        NOT NULL,
  art_id        uuid                        NOT NULL,
  initiative_id uuid                        NOT NULL,
  x             double precision            NOT NULL,
  y             double precision            NOT NULL,
  -- `timestamp(3)`, nicht der Postgres-Standard `timestamp(6)`: Prismas
  -- `DateTime` ohne `@db.`-Angabe bildet auf Millisekunden ab, und die
  -- Schwestertabelle `initiative_graph_positions` steht genauso da. Ohne die
  -- Angabe meldet `prisma migrate diff` eine Abweichung.
  updated_at    timestamp(3) without time zone NOT NULL,
  updated_by    uuid                        NOT NULL,
  CONSTRAINT art_graph_positions_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX art_graph_positions_art_id_initiative_id_key
  ON public.art_graph_positions (art_id, initiative_id);
CREATE INDEX art_graph_positions_tenant_id_art_id_idx
  ON public.art_graph_positions (tenant_id, art_id);
