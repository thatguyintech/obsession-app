import { readFileSync } from "node:fs";
import { countProvenanceCoverage } from "../lib/qa-provenance.js";
import { DATA_PATH, writeScreenplay } from "../lib/screenplay-data.js";
import { prepareScreenplaySave, type QaSavePayload } from "./qa-save.js";

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
  writeScreenplay(prepared);

  console.log(`Refreshed highlight provenance`);
  console.log(`  anchored: ${coverage.anchored}/${coverage.total} elements`);
  console.log(`  version: ${payload.meta.version} → ${prepared.meta.version}`);
}

main();
