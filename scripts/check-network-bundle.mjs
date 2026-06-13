#!/usr/bin/env node
/**
 * Verifies dass das Netzplan-Surface (`@xyflow/react` + `@dagrejs/dagre`)
 * NICHT im initialen Bundle der Epic-Detail-Page landet — sondern in
 * einem separaten Chunk steckt, der erst beim Switch in den Netzplan-
 * Modus per `next/dynamic` geladen wird.
 *
 * Voraussetzung: `pnpm build` muss vorher gelaufen sein, sodass die
 * `.next/build-manifest.json` und die `.next/static/chunks/`-Dateien
 * existieren.
 *
 * Exit-Code 0 = Code-Split intakt; Exit-Code 1 = ReactFlow leakt ins
 * initial-bundle der Page (Regression).
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const BUILD_DIR = ".next";
const CHUNK_DIR = join(BUILD_DIR, "static", "chunks");
const PAGE_PATH = "src/app/[locale]/(dashboard)/portfolio/epics/[id]/page.tsx";

const NETWORK_MARKERS = [
  "@xyflow/react",
  "ReactFlow",
  "@dagrejs/dagre",
  "dagre.layout",
  "html-to-image",
];

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

  // Initial-Chunks der Epic-Detail-Page suchen — Manifest mapped Route → Chunk-IDs.
  const epicRouteKey = Object.keys(manifest.pages).find((k) => k.includes("portfolio/epics/[id]"));
  if (!epicRouteKey) {
    console.error("✗ Epic-Detail-Route nicht im Manifest gefunden.");
    process.exit(1);
  }
  const initialChunks = manifest.pages[epicRouteKey];
  console.log(`Initial-Chunks der Page (${PAGE_PATH}):`);
  for (const c of initialChunks) console.log(`  • ${c}`);

  let regression = false;
  for (const chunkRel of initialChunks) {
    const chunkPath = join(BUILD_DIR, chunkRel);
    if (!existsSync(chunkPath)) continue;
    const content = await readFile(chunkPath, "utf8");
    const markers = findMarkers(content);
    if (markers.length > 0) {
      console.error(`\n✗ ${chunkRel} enthaelt Netzplan-Marker:`);
      for (const m of markers) console.error(`    – ${m}`);
      regression = true;
    }
  }

  if (regression) {
    console.error(
      "\nLeck im Code-Split. Der `BreakdownNetworkView`-Import wird " +
        "vermutlich nicht mehr dynamisch geladen.",
    );
    process.exit(1);
  }

  // Cross-check: irgendein Chunk sollte ReactFlow enthalten (sonst greift der dynamic import nicht).
  const allChunks = await readdir(CHUNK_DIR);
  const reactFlowChunks = [];
  for (const file of allChunks) {
    const content = await readFile(join(CHUNK_DIR, file), "utf8");
    if (NETWORK_MARKERS.some((m) => content.includes(m))) {
      reactFlowChunks.push(file);
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
