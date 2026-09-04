import { Network } from "lucide-react";

/**
 * Der Struktur-Bereich ohne gewählten Knoten.
 *
 * Der Baum steht im Layout daneben; hier steht nur, was als Nächstes zu tun
 * ist. Ein leerer Rahmen ohne Satz wäre die häufigste Ansicht des Bereichs —
 * und die schlechteste.
 */
export default function StructureIndexPage() {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <Network className="mx-auto size-6 text-muted-foreground" aria-hidden />
      <p className="mt-3 text-sm font-medium">Wähle einen Knoten aus dem Baum.</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Wertströme tragen Budget, Guardrails und den Betrieb; ARTs ihren ART-Epic-Budget; Solutions
        das, was langfristig betrieben wird.
      </p>
    </div>
  );
}
