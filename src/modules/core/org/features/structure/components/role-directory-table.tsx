"use client";

import type { ReactNode } from "react";
import {
  RoleRow,
  type DirectoryUserOption,
  type EditableTargets,
} from "@/modules/core/org/features/structure/components/role-slot";
import {
  unfilledCount,
  type ArtDirectory,
  type SolutionDirectory,
  type ValueStreamDirectory,
} from "@/modules/core/org/domain/role-directory";

/**
 * **Die Rollenverteilung als Liste** — zum Suchen nach einer Person.
 *
 * Die Karte zeigt, wie die Benennungen über die Organisation verteilt sind;
 * diese Sicht beantwortet „wo überall steht Anna". Dafür sind Zeilen besser als
 * Spalten: das Auge läuft eine Kante entlang statt über eine Fläche.
 *
 * Eine Karte je Wertstrom, darin die Zuständigkeiten als **Zeilen mit festem
 * Raster**: links die Rolle samt Anliegen, in der Mitte die Person, rechts die
 * Tore. Das Raster ist in jeder Karte dasselbe, und die Rollen stehen überall in
 * derselben Reihenfolge — so lernt das Auge die Position und vergleicht
 * Wertströme untereinander, statt jede Karte neu zu lesen.
 *
 * **Die Solution steht unter ihrem ART.** Bis September 2026 standen erst alle
 * ARTs und dann alle Solutions untereinander — dieselbe flache Liste, die auch
 * das Modell führte. Jetzt folgt die Einrückung der Zugehörigkeit.
 */
export function RoleDirectoryTable({
  streams,
  users,
  editable,
}: {
  streams: ValueStreamDirectory[];
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  return (
    <div className="space-y-3">
      {streams.map((vs) => (
        <StreamCard key={vs.id} vs={vs} users={users} editable={editable} />
      ))}
    </div>
  );
}

function StreamCard({
  vs,
  users,
  editable,
}: {
  vs: ValueStreamDirectory;
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  const offen = unfilledCount(vs);
  return (
    <section className="rounded-lg bg-card p-4 shadow-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 pb-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight">{vs.name}</h2>
        {offen > 0 && (
          <span className="rounded-full bg-warning-surface px-2 py-0.5 text-meta text-warning">
            {offen} offen
          </span>
        )}
      </header>

      <div className="divide-y">
        {vs.entries.map((e) => (
          <RoleRow key={e.key} entry={e} users={users} editable={editable} />
        ))}
      </div>

      {vs.arts.map((art) => (
        <ArtBlock key={art.id} art={art} users={users} editable={editable} />
      ))}

      {vs.looseSolutions.map((so) => (
        <SolutionBlock key={so.id} solution={so} users={users} editable={editable} />
      ))}
    </section>
  );
}

/**
 * Die Stammlinie ist ein Pseudoelement statt eines Rahmens: sie gehört zum
 * Inhalt („das hängt hier drunter"), nicht zur Kante eines Kastens (ADR-0021).
 */
function Branch({ label, name, children }: { label: string; name: string; children: ReactNode }) {
  return (
    <div className="relative mt-3 pl-4 before:absolute before:bottom-1 before:left-0 before:top-1 before:w-px before:bg-border before:content-['']">
      <p className="pb-1 text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label} <span className="text-foreground">{name}</span>
      </p>
      {children}
    </div>
  );
}

function ArtBlock({
  art,
  users,
  editable,
}: {
  art: ArtDirectory;
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  return (
    <Branch label="ART" name={art.name}>
      <div className="divide-y">
        {art.entries.map((e) => (
          <RoleRow key={e.key} entry={e} users={users} editable={editable} />
        ))}
      </div>
      {art.solutions.map((so) => (
        <SolutionBlock key={so.id} solution={so} users={users} editable={editable} />
      ))}
    </Branch>
  );
}

function SolutionBlock({
  solution,
  users,
  editable,
}: {
  solution: SolutionDirectory;
  users: DirectoryUserOption[];
  editable: EditableTargets;
}) {
  return (
    <Branch label="Solution" name={solution.name}>
      <div className="divide-y">
        {solution.entries.map((e) => (
          <RoleRow key={e.key} entry={e} users={users} editable={editable} />
        ))}
      </div>
    </Branch>
  );
}
