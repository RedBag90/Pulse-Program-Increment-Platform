import { Link } from "@/i18n/navigation";
import { anchorId } from "@/modules/wiki/domain/anchor";
import type { RoleSheet, RoleSheetClaim } from "@/modules/wiki/domain/role-sheet";
import { inline } from "@/modules/wiki/features/wiki/components/inline";
import type { Role } from "@/modules/core/kernel/domain/roles";

/**
 * **Die Rollen an einem Stueck** — die Nachschlage-Flaeche des Wikis.
 *
 * Zwei Teile, weil es zwei verschiedene Dinge sind, und ihre Verwechslung ist
 * die haeufigste Frage im Haus: eine **Rolle** sagt, was jemand darf; eine
 * **Zustaendigkeit** sagt, wen man fragt. Wer beides „Rolle" nennt, sucht den
 * Finance Approver in der Rechteverwaltung und findet ihn nie.
 *
 * Gleiche Bauart wie `guide-view.tsx`: Sprungleiste links, Artikel rechts, reine
 * Anker-Links und **kein** Client-JS. Nichts ist eingeklappt, damit Strg+F die
 * ganze Seite findet — bei einer Nachschlage-Flaeche ist das nicht Beiwerk,
 * sondern die Hauptbedienung.
 *
 * Serverkomponente. Die eigene Rolle wird **markiert, nicht vorselektiert**: die
 * Uebergaben stehen zwischen den Rollen, und wer nur seine eigene sieht, liest
 * genau die Haelfte, die ihn nichts angeht — und versteht die andere nicht.
 */
export interface DutyRow {
  key: string;
  /** Die Frage, mit der jemand herkommt. */
  duty: string;
  /** Wie die Rolle im Haus heisst. */
  role: string;
  /** „Wertstrom" · „ART" · „Solution" — wo der Platz besetzt wird. */
  levelLabel: string;
}

export function RoleSheetsView({
  sheets,
  duties,
  roles,
}: {
  sheets: readonly RoleSheet[];
  duties: readonly DutyRow[];
  roles: readonly Role[];
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start">
      <RoleToc sheets={sheets} roles={roles} />

      <article className="space-y-8">
        <header className="space-y-3">
          <p className="font-mono text-meta uppercase tracking-[0.14em] text-muted-foreground">
            <Link href="/wiki" className="hover:text-foreground">
              Wiki
            </Link>
            <span className="px-1.5" aria-hidden>
              /
            </span>
            Nachschlagen
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Wer was verantwortet
          </h1>
          <p className="max-w-[var(--reading-max-w)] text-prose-lede leading-relaxed text-muted-foreground">
            {inline(
              "Die acht Rollen mit ihrem Auftrag, ihrer Verantwortung und ihren Übergaben — und darunter die sieben Zuständigkeiten, die **je Wertstrom** besetzt werden. Eine Rolle sagt, was jemand darf; eine Benennung sagt, wen man fragt.",
            )}
          </p>
        </header>

        <section id="rollen" className="scroll-mt-24 space-y-8">
          <div className="space-y-2 border-t pt-6">
            <h2 className="font-heading text-xl font-semibold tracking-tight">
              Die Rollen — überall dieselben
            </h2>
            <p className="max-w-[var(--reading-max-w)] text-prose text-muted-foreground">
              Sie werden zugewiesen, tragen Rechte und heissen in jedem Mandanten gleich. Das
              Rollenmodell kennt <strong className="text-foreground">keine Vererbung</strong> — eine
              höhere Rolle enthält die niedrigere nicht.
            </p>
          </div>

          {sheets.map((sheet, i) => (
            <RoleCard
              key={sheet.role}
              sheet={sheet}
              index={i + 1}
              own={roles.includes(sheet.role)}
            />
          ))}
        </section>

        <DutiesSection duties={duties} />
        <SeeAlso />
      </article>
    </div>
  );
}

function RoleCard({ sheet, index, own }: { sheet: RoleSheet; index: number; own: boolean }) {
  return (
    <section id={anchorId("r", sheet.label)} className="scroll-mt-24 space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h3 className="font-heading text-2xl font-semibold tracking-tight">
            {index} · {sheet.label}
          </h3>
          {own && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-label uppercase tracking-[0.1em] text-primary">
              deine Rolle
            </span>
          )}
        </div>
        <p className="max-w-[var(--reading-max-w)] text-prose leading-relaxed">
          {inline(sheet.mission)}
        </p>
      </div>

      <div className="grid gap-2.5 md:grid-cols-2 md:items-start">
        <ClaimList title="Verantwortung" claims={sheet.responsibilities} />
        <ClaimList title="Übergaben" claims={sheet.handoffs} />
      </div>
    </section>
  );
}

/**
 * Faellt eine Liste ganz weg — ein Mandant ohne Budgeting nimmt dem
 * Wertstrom-Owner drei seiner Saetze —, steht das **da**. Eine Karte mit einer
 * leeren Spalte sieht aus wie ein Ladefehler; ein Satz darueber ist eine
 * Auskunft.
 */
function ClaimList({ title, claims }: { title: string; claims: readonly RoleSheetClaim[] }) {
  return (
    <div className="rounded-lg bg-card shadow-card px-3.5 py-3">
      <p className="font-mono text-label uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      {claims.length === 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          In diesem Mandanten nichts — die Module dafür sind nicht freigeschaltet.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {claims.map((c) => (
            <li key={c.text} className="flex gap-2 text-sm leading-relaxed">
              <span
                className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-muted-foreground"
                aria-hidden
              />
              <span>{inline(c.text)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Die Zustaendigkeiten. Sie kommen aus `ALL_DUTIES` und nicht aus dem
 * Gedaechtnis — dieselbe Vorsicht wie bei der Rollen-Figur, die `ALL_ROLES`
 * zaehlt. Traegt jemand einen achten Platz ein, erscheint er hier von selbst.
 */
function DutiesSection({ duties }: { duties: readonly DutyRow[] }) {
  return (
    <section id="zustaendigkeiten" className="scroll-mt-24 space-y-4">
      <div className="space-y-2 border-t pt-6">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Die Zuständigkeiten — je Wertstrom besetzt
        </h2>
        <p className="max-w-[var(--reading-max-w)] text-prose text-muted-foreground">
          {inline(
            "Das sind **Benennungen**, keine Rollen: sie werden an einem Wertstrom, einem ART oder einer Solution eingetragen, und niemand muss dafür eine Rolle tragen. Wer hier steht, wird gefragt — und zeichnet an den Toren, an denen der Wertstrom ihn einträgt.",
          )}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg bg-card shadow-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {["Anliegen", "Heißt im Haus", "Besetzt am"].map((h) => (
                <th
                  key={h}
                  className="border-b px-4 py-2.5 text-left font-mono text-meta uppercase tracking-[0.1em] text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {duties.map((d) => (
              <tr key={d.key}>
                <td className="border-b border-border/60 px-4 py-2.5 align-top font-medium text-foreground last:border-b-0">
                  {d.duty}
                </td>
                <td className="border-b border-border/60 px-4 py-2.5 align-top text-muted-foreground last:border-b-0">
                  {d.role}
                </td>
                <td className="border-b border-border/60 px-4 py-2.5 align-top last:border-b-0">
                  <span className="font-mono text-meta uppercase tracking-[0.1em] text-muted-foreground">
                    {d.levelLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-prose text-muted-foreground">
        Wer das bei euch ist, steht in der{" "}
        <Link href="/structure/rollen" className="font-medium text-foreground hover:underline">
          Rollenverteilung
        </Link>{" "}
        — dort mit Namen, und dort wird auch eingetragen.
      </p>
    </section>
  );
}

/** Dieselben drei Naehte wie am Fuss einer Anleitung. */
function SeeAlso() {
  const targets = [
    {
      href: "/meine-rolle",
      title: "Meine Rolle",
      hint: "Deine eigene Verantwortung, mit den Flächen dazu — geführt.",
    },
    {
      href: "/structure/rollen",
      title: "Die Rollenverteilung",
      hint: "Wer bei euch welchen Platz besetzt, und wo noch keiner steht.",
    },
    {
      href: "/wiki",
      title: "Die Abläufe",
      hint: "Was die Rollen miteinander tun — elf Anleitungen auf ihrem Rhythmus.",
    },
  ];

  return (
    <section id="weiter" className="scroll-mt-24 space-y-3 border-t pt-6">
      <h2 className="font-heading text-xl font-semibold tracking-tight">Weiter lesen</h2>
      <ul className="grid gap-2 border-l-2 pl-4 md:grid-cols-2">
        {targets.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="group block">
              <span className="text-sm font-medium text-foreground group-hover:underline">
                {t.title}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RoleToc({ sheets, roles }: { sheets: readonly RoleSheet[]; roles: readonly Role[] }) {
  return (
    <nav aria-label="Auf dieser Seite" className="top-24 space-y-2 border-l pl-4 text-xs lg:sticky">
      <p className="font-mono text-label uppercase tracking-[0.14em] text-muted-foreground">
        Auf dieser Seite
      </p>
      <ul className="space-y-1.5">
        <li>
          <a href="#rollen" className="text-muted-foreground hover:text-foreground">
            Die Rollen
          </a>
          <ul className="mt-1 space-y-1 pl-3">
            {sheets.map((s, i) => (
              <li key={s.role}>
                <a
                  href={`#${anchorId("r", s.label)}`}
                  className={
                    roles.includes(s.role)
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }
                >
                  {i + 1} · {s.label}
                </a>
              </li>
            ))}
          </ul>
        </li>
        <li>
          <a href="#zustaendigkeiten" className="text-muted-foreground hover:text-foreground">
            Die Zuständigkeiten
          </a>
        </li>
        <li>
          <a href="#weiter" className="text-muted-foreground hover:text-foreground">
            Weiter lesen
          </a>
        </li>
      </ul>
    </nav>
  );
}
