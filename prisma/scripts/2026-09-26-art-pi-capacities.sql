-- Pulse: Kapazitätszahl je ART und PI — Eingang der Formel für das
-- Job-Size-Ziel (drumbeat/domain/pi-job-size-target.ts). Plan vom 26.09.2026.
-- Erzeugt aus `prisma migrate diff`, nur die Anweisungen für diese Tabelle.
-- Einzeln ausführbar; rückgängig mit `DROP TABLE public.art_pi_capacities;`.

-- 1) Tabelle. `timestamp(3)` wie Prisma es erwartet (siehe art_graph_positions).
CREATE TABLE public.art_pi_capacities (
  id         uuid           NOT NULL,
  tenant_id  uuid           NOT NULL,
  art_id     uuid           NOT NULL,
  pi_id      uuid           NOT NULL,
  capacity   numeric(10,2)  NOT NULL,
  created_at timestamp(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by uuid           NOT NULL,
  updated_at timestamp(3)   NOT NULL,
  updated_by uuid           NOT NULL,
  CONSTRAINT art_pi_capacities_pkey PRIMARY KEY (id)
);

-- 2) Indizes.
CREATE INDEX art_pi_capacities_tenant_id_pi_id_idx
  ON public.art_pi_capacities (tenant_id, pi_id);
CREATE UNIQUE INDEX art_pi_capacities_art_id_pi_id_key
  ON public.art_pi_capacities (art_id, pi_id);

-- 3) Fremdschlüssel.
ALTER TABLE public.art_pi_capacities ADD CONSTRAINT art_pi_capacities_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public.art_pi_capacities ADD CONSTRAINT art_pi_capacities_art_id_fkey
  FOREIGN KEY (art_id) REFERENCES public.arts(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public.art_pi_capacities ADD CONSTRAINT art_pi_capacities_pi_id_fkey
  FOREIGN KEY (pi_id) REFERENCES public.program_increments(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Mandanten-Trennung wie bei allen Tabellen (prisma/sql/rls-hardening.sql).
ALTER TABLE public.art_pi_capacities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.art_pi_capacities FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.art_pi_capacities FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);
