import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { countProvenanceCoverage } from "../lib/qa-provenance.js";
import { prepareScreenplaySave, type QaSavePayload } from "./qa-save.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_PATH = join(ROOT, "data", "obsession.json");
const PUBLIC_DATA_PATH = join(ROOT, "public", "data", "obsession.json");

function main(): void {
  const payload = JSON.parse(readFileSync(DATA_PATH, "utf8")) as QaSavePayload;

  const prepared = prepareScreenplaySave({
    ...payload,
    meta: {
      ...payload.meta,
      version: payload.meta.version,
    },
  });

  const coverage = countProvenanceCoverage(prepared.elements);
  const serialized = JSON.stringify(prepared, null, 2);
  writeFileSync(DATA_PATH, serialized);
  writeFileSync(PUBLIC_DATA_PATH, serialized);

  console.log(`Refreshed highlight provenance`);
  console.log(`  anchored: ${coverage.anchored}/${coverage.total} elements`);
  console.log(`  version: ${payload.meta.version} → ${prepared.meta.version}`);
}

main();
