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
  segments?: { kind: string; text: string }[];
  searchText?: string;
}

interface Moment {
  id: string;
  index: number;
  elementIds: string[];
}

interface Payload {
  meta: { pageCount: number; momentCount?: number; version?: number };
  elements: Element[];
  moments: Moment[];
}

let payload: Payload;
try {
  payload = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Payload;
} catch {
  fail(`Missing ${DATA_PATH}. Run npm run extract first.`);
}

const { elements, moments, meta } = payload;

if (meta.pageCount !== 99) {
  fail(`Expected 99 pdf pages, got ${meta.pageCount}`);
}

if (!moments?.length) {
  fail("Missing moments array");
}

const elementIds = new Set(elements.map((element) => element.id));
if (elementIds.size !== elements.length) {
  fail("Duplicate element ids detected");
}

for (const moment of moments) {
  for (const elementId of moment.elementIds) {
    if (!elementIds.has(elementId)) {
      fail(`Moment ${moment.id} references missing element ${elementId}`);
    }
  }
}

if (moments[0]?.elementIds[0] !== elements[0]?.id) {
  fail("First moment should start with title_card element");
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

for (const element of elements) {
  if (element.type === "dialogue") {
    if (!element.segments?.length) {
      fail(`Dialogue ${element.id} missing segments`);
    }
    for (const segment of element.segments ?? []) {
      if (segment.kind !== "speech" && segment.kind !== "parenthetical") {
        fail(`Dialogue ${element.id} has invalid segment kind`);
      }
      if (!segment.text.trim()) {
        fail(`Dialogue ${element.id} has empty segment`);
      }
    }
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
console.log(`  moments: ${moments.length}`);
console.log(`  dual_dialogue elements: ${dualCount}`);
console.log(`  scene headings: ${sceneHeadingCount}`);
