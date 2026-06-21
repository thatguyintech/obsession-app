import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDialogueElement } from "../lib/dialogue-segments.js";
import { prepareScreenplaySave, type QaSavePayload } from "./qa-save.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_PATH = join(ROOT, "data", "obsession.json");
const PUBLIC_DATA_PATH = join(ROOT, "public", "data", "obsession.json");

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

  const serialized = JSON.stringify(prepared, null, 2);
  writeFileSync(DATA_PATH, serialized);
  writeFileSync(PUBLIC_DATA_PATH, serialized);

  console.log(`Migrated dialogue → segments`);
  console.log(`  version: ${payload.meta.version} → ${prepared.meta.version}`);
  console.log(`  elements: ${prepared.meta.elementCount}`);
}

main();
