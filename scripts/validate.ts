import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "data", "obsession.json");

const SEARCH_TERMS = [
  "tiny silver revolver",
  "got into some pills",
  "brick",
  "int. bear's house - living room - night",
];

const EXPECTED_CHARACTERS = new Set(["BEAR", "NICKY", "IAN", "SARAH", "CARTER"]);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\u2019/g, "'").replace(/\u2018/g, "'").replace(/`/g, "'");
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

interface Element {
  id: string;
  type: string;
  character?: string;
  searchText?: string;
}

interface Beat {
  id: string;
  elementId: string;
  type: string;
}

interface Payload {
  meta: { pageCount: number };
  elements: Element[];
  beats: Beat[];
}

let payload: Payload;
try {
  payload = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Payload;
} catch {
  fail(`Missing ${DATA_PATH}. Run npm run extract first.`);
}

const { elements, beats, meta } = payload;

if (meta.pageCount !== 99) {
  fail(`Expected 99 pdf pages, got ${meta.pageCount}`);
}

const elementIds = new Set(elements.map((element) => element.id));
if (elementIds.size !== elements.length) {
  fail("Duplicate element ids detected");
}

for (const beat of beats) {
  if (!elementIds.has(beat.elementId)) {
    fail(`Beat ${beat.id} references missing element ${beat.elementId}`);
  }
}

if (beats[0]?.type !== "title_card") {
  fail("First beat should be title_card");
}

const sceneHeadingCount = elements.filter((element) => element.type === "scene_heading").length;
if (sceneHeadingCount < 20) {
  fail("Scene heading count looks too low");
}

const characters = new Set(
  elements
    .filter((element) => element.type === "dialogue" && element.character)
    .map((element) => element.character!.split("(")[0].trim()),
);

for (const expected of EXPECTED_CHARACTERS) {
  if (!characters.has(expected)) {
    fail(`Missing expected character: ${expected}`);
  }
}

const searchable = normalizeText(
  elements
    .map((element) => element.searchText ?? "")
    .filter(Boolean)
    .join(" "),
);

for (const term of SEARCH_TERMS) {
  if (!searchable.includes(normalizeText(term))) {
    fail(`Search smoke test missed "${term}"`);
  }
}

const dualCount = elements.filter((element) => element.type === "dual_dialogue").length;
console.log("OK");
console.log(`  elements: ${elements.length}`);
console.log(`  beats: ${beats.length}`);
console.log(`  dual_dialogue elements: ${dualCount}`);
console.log(`  scene headings: ${sceneHeadingCount}`);
