"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * **Die einzige Fläche mit eingebautem Text — und zwar mit Grund.**
 *
 * `global-error` ersetzt das gesamte Dokument, `<html>` eingeschlossen. Es
 * greift, wenn das Wurzel-Layout selbst gescheitert ist — genau dort steht
 * kein `NextIntlClientProvider`, und `getTranslations` hätte keinen Request
 * mehr, aus dem es eine Sprache zöge. Ein Katalog-Aufruf wäre hier ein zweiter
 * Fehler in der Behandlung des ersten.
 *
 * Die Sprache kommt deshalb aus dem Pfad: `/de/…` bzw. `/en/…` steht in jeder
 * Route (`localePrefix: "always"`), und `location` ist das Einzige, was in
 * diesem Zustand verlässlich dasteht. Zwei Sätze, zwei Sprachen, keine
 * Abhängigkeit.
 */
const TEXTE = {
  de: { titel: "Etwas ist schiefgelaufen", erneut: "Erneut versuchen", ref: "Ref:" },
  en: { titel: "Something went wrong", erneut: "Try again", ref: "Ref:" },
} as const;

function texte() {
  const pfad = typeof window === "undefined" ? "" : window.location.pathname;
  return pfad.startsWith("/en/") || pfad === "/en" ? TEXTE.en : TEXTE.de;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const text = texte();
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            gap: "1rem",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{text.titel}</h1>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#666" }}>
              {text.ref} {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              background: "#000",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            {text.erneut}
          </button>
        </main>
      </body>
    </html>
  );
}
