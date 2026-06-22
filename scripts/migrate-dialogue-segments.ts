import { readFileSync } from "node:fs";
import { normalizeDialogueElement } from "../lib/dialogue-segments.js";
import { DATA_PATH, writeScreenplay } from "../lib/screenplay-data.js";
import { prepareScreenplaySave, type QaSavePayload } from "./qa-save.js";

function main(): void {
  const payload = JSON.parse(readFileSync(DATA_PATH, "utf8")) as QaSavePayload;

  const elements = payload.elements.map((element) => normalizeDialogueElement(element));
  const prepared = prepareScreenplaySave({
    ...payload,
    elements,
    meta: {
      ...payload.meta,
      version: payload.meta.version,
    },
  });

  writeScreenplay(prepared);

  console.log(`Migrated dialogue → segments`);
  console.log(`  version: ${payload.meta.version} → ${prepared.meta.version}`);
  console.log(`  elements: ${prepared.meta.elementCount}`);
}

main();
