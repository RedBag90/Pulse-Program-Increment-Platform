#!/usr/bin/env node
/**
 * Verifies dass das Netzplan-Surface (`@xyflow/react` + `@dagrejs/dagre`)
 * NICHT im initialen Bundle der geprüften Pages landet — sondern in
 * einem separaten Chunk steckt, der erst beim Switch in den Netzplan-
 * Modus per `next/dynamic` geladen wird. Geprüft werden alle Routen in
 * `GUARDED_ROUTES` (Epic-Detail + /ziele).
 *
 * Voraussetzung: `pnpm build` muss vorher gelaufen sein, sodass die
 * `.next/build-manifest.json` und die `.next/static/chunks/`-Dateien
 * existieren.
 *
 * Exit-Code 0 = Code-Split intakt; Exit-Code 1 = ReactFlow leakt ins
 * initial-bundle einer Page (Regression).
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const BUILD_DIR = ".next";
const CHUNK_DIR = join(BUILD_DIR, "static", "chunks");

// Routen, deren Initial-Bundle den Netzplan NICHT enthalten darf. `match` wird
// gegen die Manifest-Route-Keys geprüft; `label` ist nur fürs Log.
const GUARDED_ROUTES = [
  { label: "Epic-Detail-Page", match: "portfolio/epics/[id]" },
  { label: "Ziele-Page", match: "(dashboard)/ziele" },
];

// Marker, die die Minifizierung überleben (Paket-Namen/Bezeichner wie
// "@xyflow/react"/"ReactFlow" werden wegminifiziert): interne Klassen-/Modul-
// Strings der ReactFlow+dagre-Fläche.
const NETWORK_MARKERS = ["xyflow", "react-flow", "graphlib"];

if (!existsSync(BUILD_DIR)) {
  console.error(`✗ ${BUILD_DIR}/ fehlt. Erst 'pnpm build' laufen lassen.`);
  process.exit(1);
}

function findMarkers(content) {
  const hits = new Set();
  for (const m of NETWORK_MARKERS) {
    if (content.includes(m)) hits.add(m);
  }
  return [...hits];
}

async function main() {
  const manifestPath = join(BUILD_DIR, "app-build-manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`✗ ${manifestPath} fehlt — alter Next-Build?`);
    process.exit(1);
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  let regression = false;
  for (const route of GUARDED_ROUTES) {
    // Manifest mapped Route → Chunk-IDs; die Route über ihren Teilstring finden.
    const routeKey = Object.keys(manifest.pages).find((k) => k.includes(route.match));
    if (!routeKey) {
      console.error(`✗ ${route.label} (${route.match}) nicht im Manifest gefunden.`);
      process.exit(1);
    }
    const initialChunks = manifest.pages[routeKey];
    console.log(`Initial-Chunks — ${route.label} (${routeKey}):`);
    for (const c of initialChunks) console.log(`  • ${c}`);

    for (const chunkRel of initialChunks) {
      const chunkPath = join(BUILD_DIR, chunkRel);
      if (!existsSync(chunkPath)) continue;
      const content = await readFile(chunkPath, "utf8");
      const markers = findMarkers(content);
      if (markers.length > 0) {
        console.error(`\n✗ [${route.label}] ${chunkRel} enthaelt Netzplan-Marker:`);
        for (const m of markers) console.error(`    – ${m}`);
        regression = true;
      }
    }
  }

  if (regression) {
    console.error(
      "\nLeck im Code-Split. Ein Netzplan-Import (`BreakdownNetworkView` / " +
        "`StrategyNetworkViewLazy`) wird vermutlich nicht mehr dynamisch geladen.",
    );
    process.exit(1);
  }

  // Cross-check: irgendein Chunk sollte ReactFlow enthalten (sonst greift der dynamic import nicht).
  // Nur Dateien auf oberster Ebene lesen (das `chunks/`-Verzeichnis enthält auch Unterordner
  // wie `app/` → sonst EISDIR).
  const allChunks = await readdir(CHUNK_DIR, { withFileTypes: true });
  const reactFlowChunks = [];
  for (const entry of allChunks) {
    if (!entry.isFile()) continue;
    const content = await readFile(join(CHUNK_DIR, entry.name), "utf8");
    if (NETWORK_MARKERS.some((m) => content.includes(m))) {
      reactFlowChunks.push(entry.name);
    }
  }
  if (reactFlowChunks.length === 0) {
    console.error(
      "\n✗ Kein Chunk enthaelt ReactFlow — Code-Split ist 'leer'. " +
        "Dynamischer Import vermutlich kaputt.",
    );
    process.exit(1);
  }

  console.log(`\n✓ Code-Split intakt.`);
  console.log(
    `✓ Netzplan-Chunks (${reactFlowChunks.length}): ${reactFlowChunks.slice(0, 3).join(", ")}${
      reactFlowChunks.length > 3 ? ", …" : ""
    }`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
