/**
 * PB-Prozess-Leiste (F5.3) — bildet den Runden-Ablauf ab und markiert den
 * aktuellen Schritt aus dem Runden-Status. Rein präsentational.
 */
const STEPS: { key: string; label: string; status: string | null }[] = [
  { key: "frame", label: "Rahmen & Gruppen", status: "draft" },
  { key: "capture", label: "Erfassung & Zonen", status: "running" },
  { key: "decide", label: "Entscheidung", status: "decided" },
  { key: "protocol", label: "Protokoll & Übergabe", status: "closed" },
];

const ORDER = ["draft", "running", "decided", "closed"];

export function RoundStepper({ status }: { status: string | null }) {
  const activeIdx = status ? ORDER.indexOf(status) : -1;

  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {STEPS.map((s, i) => {
        const state = activeIdx < 0 ? "todo" : i < activeIdx ? "done" : i === activeIdx ? "active" : "todo";
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                state === "active"
                  ? "bg-primary text-primary-foreground"
                  : state === "done"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}. {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="text-muted-foreground/50">→</span>}
          </li>
        );
      })}
    </ol>
  );
}
