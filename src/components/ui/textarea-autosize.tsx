"use client";

import { useEffect } from "react";

/**
 * **Textfelder wachsen mit ihrem Inhalt** — überall in der App, ohne jedes
 * Formular anzufassen.
 *
 * Die Ecke zum Vergrössern ist eine Browser-Funktion, die iPad und iPhone
 * nicht anbieten; dort liess sich ein Feld gar nicht grösser ziehen. Jetzt
 * wird jedes `<textarea>` so hoch wie sein Text: beim Tippen, beim Fokus und
 * wenn es mit Inhalt erscheint. Kleiner als seine Mindesthöhe (`rows`,
 * `min-h`) wird es nie. Mit der Maus bleibt die Ecke zusätzlich.
 *
 * Ausnahme: `data-autosize="off"` am Feld.
 *
 * Einmal im App-Layout eingehängt; zeichnet nichts.
 */
export function TextareaAutosize() {
  useEffect(() => {
    const passe = (el: HTMLTextAreaElement) => {
      if (el.dataset.autosize === "off") return;
      // Erst zurücksetzen, sonst misst `scrollHeight` die alte Höhe mit.
      el.style.height = "auto";
      const rahmen = el.offsetHeight - el.clientHeight;
      el.style.height = `${el.scrollHeight + rahmen}px`;
    };
    const beiEreignis = (e: Event) => {
      if (e.target instanceof HTMLTextAreaElement) passe(e.target);
    };
    const alle = (root: ParentNode) => {
      root.querySelectorAll?.("textarea").forEach((el) => passe(el as HTMLTextAreaElement));
    };

    document.addEventListener("input", beiEreignis, true);
    document.addEventListener("focusin", beiEreignis, true);
    alle(document);
    // Felder, die später erscheinen (Dialoge, Reiter, Slide-Over).
    const beobachter = new MutationObserver((mutationen) => {
      for (const m of mutationen) {
        m.addedNodes.forEach((n) => {
          if (n instanceof HTMLTextAreaElement) passe(n);
          else if (n instanceof Element) alle(n);
        });
      }
    });
    beobachter.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("input", beiEreignis, true);
      document.removeEventListener("focusin", beiEreignis, true);
      beobachter.disconnect();
    };
  }, []);
  return null;
}
