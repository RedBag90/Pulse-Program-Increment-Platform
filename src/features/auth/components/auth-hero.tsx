import { Zap, Target, LineChart, Users } from "lucide-react";

/**
 * Linkes Hero-Panel des Auth-Split-Layouts (W5): dunkles Brand-Panel mit
 * Headline und drei Feature-Bullets, die die Freemium-Story erzählen
 * (kostenloser Ziele-Bereich → Vollversion → Klienten-Tenant). Rein
 * präsentational; auf Mobile kompakt (Bullets erst ab lg sichtbar).
 */
const BULLETS = [
  {
    icon: Target,
    title: "Ziele & OKRs — kostenlos",
    text: "Persönlicher Bereich mit dem vollen Ziele-Modul.",
  },
  {
    icon: LineChart,
    title: "Portfolio & PI-Planung",
    text: "Epics, Budgets, ARTs — in der Vollversion für Teams.",
  },
  {
    icon: Users,
    title: "Gemeinsam im Klienten-Tenant",
    text: "Vom privaten Bereich nahtlos in den Team-Workspace wechseln.",
  },
] as const;

export function AuthHero() {
  return (
    <div className="flex flex-col justify-between bg-[#1b1a33] p-8 text-white lg:min-h-screen lg:w-1/2 lg:p-12">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Zap className="size-4.5 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="font-heading text-base font-semibold tracking-tight">Pulse</span>
      </div>

      {/* Headline + Bullets (Bullets erst ab lg — Mobile bleibt kompakt) */}
      <div className="mt-10 lg:mt-0">
        <h1 className="text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
          Vom Ziel bis zur Umsetzung.
          <br />
          Ein Portfolio.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-indigo-200/90">
          Starte kostenlos mit deinem persönlichen Ziele-Bereich — und skaliere bis zum vollen
          SAFe-Portfolio.
        </p>

        <ul className="mt-10 hidden flex-col gap-6 lg:flex">
          {BULLETS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Icon className="size-4 text-indigo-200" />
              </span>
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-sm text-indigo-300/80">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Spacer unten (hält die Headline im unteren Drittel, wie die Vorlage) */}
      <div className="hidden lg:block" aria-hidden />
    </div>
  );
}
