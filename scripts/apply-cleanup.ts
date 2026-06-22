import { readFileSync } from "node:fs";
import { denormalizeBeat } from "./lib/classifier.js";
import { applyCleanup } from "./lib/cleanup.js";
import { generateMoments } from "./lib/moments.js";
import { DATA_PATH, writeScreenplay } from "../lib/screenplay-data.js";
import type { ScreenplayElementDraft } from "./lib/types.js";

interface ScreenplayPayload {
  meta: Record<string, unknown>;
  elements: ScreenplayElementDraft[];
  beats: Record<string, unknown>[];
  moments: ReturnType<typeof generateMoments>;
}

const payload = JSON.parse(readFileSync(DATA_PATH, "utf8")) as ScreenplayPayload;
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

writeScreenplay(nextPayload);

console.log(`Cleaned ${payload.elements.length} -> ${cleanedElements.length} elements`);
console.log(`Wrote ${DATA_PATH} (synced to public/data/)`);
