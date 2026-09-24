"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import type { TourStep } from "@/modules/onboarding/domain/role-playbook";
import type { Role } from "@/modules/core/kernel/domain/roles";
import {
  cardPlacement,
  centeredCard,
  spotlightRect,
  type CardPlacement,
  type Rect,
} from "@/modules/onboarding/domain/spotlight";
import {
  dismissTourStepsAction,
  markStepsSeenAction,
} from "@/modules/onboarding/features/onboarding/actions/role-onboarding";

/**
 * Die geführte Tour: hebt echte Bedienelemente hervor und navigiert zwischen
 * den Seiten.
 *
 * Bewusst ohne zusätzliche Abhängigkeit. Das Loch entsteht durch ein
 * transparentes Rechteck mit `box-shadow: 0 0 0 9999px` — dadurch bleibt das
 * hervorgehobene Element anklickbar, und wir brauchen weder SVG-Maske noch
 * Coachmark-Bibliothek.
 *
 * Robustheitsregel: **die Tour bricht nie ab, weil ein Anker fehlt.** Wird das
 * Element nicht gefunden (noch nicht gestreamt, umbenannt, ausgeblendet), zeigt
 * der Schritt eine zentrierte Karte ohne Spotlight. Ein vergessenes
 * `data-tour`-Attribut kostet Hervorhebung, nicht die Erklärung.
 *
 * Die Komponente hängt im Dashboard-Layout und überlebt damit die
 * Client-Navigation zwischen den Schritt-Zielen.
 */

/** Wie lange auf einen noch nicht gerenderten Anker gewartet wird. */
const ANCHOR_TIMEOUT_MS = 2000;

interface Props {
  role: Role;
  steps: readonly TourStep[];
  onFinish: () => void;
}

function readViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

export function RoleTourOverlay({ role, steps, onFinish }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Rect | null>(null);
  const [placement, setPlacement] = useState<CardPlacement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  /** Je Schritt nur einmal scrollen — sonst kämpft das Scrollen gegen den Nutzer. */
  const scrolledFor = useRef<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const step = steps[index];
  const isLast = index === steps.length - 1;

  /** Gesehene Schritte melden — gebündelt, Fehler sind hier nicht kritisch. */
  const reportSeen = useCallback(
    (keys: string[]) => {
      if (keys.length === 0) return;
      const fd = new FormData();
      fd.set("role", role);
      for (const k of keys) fd.append("stepKeys", k);
      startTransition(async () => {
        await markStepsSeenAction({}, fd);
      });
    },
    [role],
  );

  // ── Navigation zum Schritt-Ziel ────────────────────────────────────────
  // Genau **einmal pro Schritt** navigieren, nicht solange der Pfad abweicht.
  // Manche Ziele leiten weiter (z. B. `/portfolio` auf den gespeicherten
  // Standardfilter); ein Vergleich `pathname !== route` wäre danach dauerhaft
  // wahr und die Tour würde endlos neu pushen.
  const navigatedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!step || navigatedFor.current === step.key) return;
    navigatedFor.current = step.key;
    const target = step.route.split("?")[0] ?? step.route;
    if (pathname !== target) router.push(step.route);
  }, [step, pathname, router]);

  // ── Anker suchen und vermessen ─────────────────────────────────────────
  useLayoutEffect(() => {
    if (!step) return;
    let cancelled = false;
    const startedAt = performance.now();

    const measure = () => {
      if (cancelled) return;
      const viewport = readViewport();
      const cardHeight = cardRef.current?.offsetHeight ?? 200;

      const el = step.anchor
        ? document.querySelector<HTMLElement>(`[data-tour="${CSS.escape(step.anchor)}"]`)
        : null;

      if (!el) {
        // Weitersuchen, solange das Zeitfenster läuft — Seiten streamen nach.
        if (step.anchor && performance.now() - startedAt < ANCHOR_TIMEOUT_MS) {
          requestAnimationFrame(measure);
          return;
        }
        setHole(null);
        setPlacement(centeredCard(viewport, cardHeight));
        return;
      }

      // Ziel ins Bild holen, bevor gemessen wird. Ohne das zeigt der Spotlight
      // bei einem Element unterhalb des Falzes aus dem sichtbaren Bereich heraus
      // — die Karte erscheint, das hervorgehobene Element aber nicht.
      if (!scrolledFor.current.has(step.key)) {
        scrolledFor.current.add(step.key);
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      }

      const r = el.getBoundingClientRect();
      const nextHole = spotlightRect(
        { top: r.top, left: r.left, width: r.width, height: r.height },
        viewport,
      );
      setHole(nextHole);
      setPlacement(cardPlacement(nextHole, viewport, cardHeight));
    };

    measure();
    const onChange = () => measure();
    window.addEventListener("scroll", onChange, { passive: true, capture: true });
    window.addEventListener("resize", onChange, { passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onChange, { capture: true });
      window.removeEventListener("resize", onChange);
    };
  }, [step, pathname]);

  // ── Tastatur ───────────────────────────────────────────────────────────
  const finish = useCallback(() => {
    onFinish();
  }, [onFinish]);

  /**
   * **Abbruch mitten in der Tour** — „Tour beenden" oder Escape.
   *
   * Die noch nicht begangenen Schritte gelten damit als **abgelehnt**, nicht
   * als gesehen. Ohne das hinterliess ein Abbruch sie offen, und beim nächsten
   * Seitenaufbau stand derselbe Hinweis wieder da: wer eine Tour abbrach,
   * bekam sie unbegrenzt oft erneut angeboten. Das war die zweite Hälfte
   * desselben Fehlers wie beim „Nicht jetzt".
   *
   * Der **aktuelle** Schritt zählt mit: gesehen ist er erst, wenn man ihn
   * verlässt (`goNext`) — hier bricht man auf ihm ab.
   */
  const abort = useCallback(() => {
    const rest = steps.slice(index).map((s) => s.key);
    if (rest.length > 0) {
      const fd = new FormData();
      fd.set("role", role);
      for (const k of rest) fd.append("stepKeys", k);
      startTransition(async () => {
        await dismissTourStepsAction({}, fd);
      });
    }
    onFinish();
  }, [steps, index, role, onFinish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") abort();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abort]);

  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  if (!step || !placement) return null;

  const goNext = () => {
    reportSeen([step.key]);
    if (isLast) finish();
    else setIndex((i) => i + 1);
  };

  return (
    <div className="fixed inset-0 z-100" role="presentation">
      {/* Abdunklung: entweder als Loch um das Ziel, oder flächig beim Fallback. */}
      {hole ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-md ring-2 ring-primary transition-all duration-200"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/55" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-live="polite"
        aria-label={`Tour-Schritt ${index + 1} von ${steps.length}: ${step.title}`}
        tabIndex={-1}
        className="absolute rounded-lg bg-card p-4 shadow-lg outline-none ring-1 ring-foreground/10"
        style={{ top: placement.top, left: placement.left, width: placement.width }}
      >
        <p className="text-xs font-medium tabular-nums text-muted-foreground">
          Schritt {index + 1} von {steps.length}
        </p>
        <h2 className="mt-1 font-heading text-base font-semibold">{step.title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={abort}>
            {t("onboarding.ui.tourBeenden")}
          </Button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setIndex((i) => i - 1)}>
                {t("onboarding.ui.zurueck")}
              </Button>
            )}
            <Button size="sm" onClick={goNext}>
              {isLast ? "Fertig" : "Weiter"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
