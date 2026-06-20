import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { denormalizeBeat } from "./lib/classifier.js";
import { applyCleanup } from "./lib/cleanup.js";
import { generateMoments } from "./lib/moments.js";
import type { ScreenplayElementDraft } from "./lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const PUBLIC_DATA_DIR = join(ROOT, "public", "data");
const IN_PATH = join(DATA_DIR, "obsession.json");
const OUT_PATH = join(DATA_DIR, "obsession.json");

interface ScreenplayPayload {
  meta: Record<string, unknown>;
  elements: ScreenplayElementDraft[];
  beats: Record<string, unknown>[];
  moments: ReturnType<typeof generateMoments>;
}

const payload = JSON.parse(readFileSync(IN_PATH, "utf8")) as ScreenplayPayload;
const cleanedElements = applyCleanup(payload.elements);

const beats = cleanedElements.map((element, index) => ({
  id: `beat-${String(index + 1).padStart(3, "0")}`,
  elementId: element.id,
  index,
  ...denormalizeBeat(element),
}));

const moments = generateMoments(cleanedElements);

const nextPayload = {
  ...payload,
  meta: {
    ...payload.meta,
    elementCount: cleanedElements.length,
    beatCount: beats.length,
    momentCount: moments.length,
  },
  elements: cleanedElements,
  beats,
  moments,
};

mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(nextPayload, null, 2));
writeFileSync(join(PUBLIC_DATA_DIR, "obsession.json"), JSON.stringify(nextPayload, null, 2));

console.log(`Cleaned ${payload.elements.length} -> ${cleanedElements.length} elements`);
console.log(`Wrote ${OUT_PATH}`);
