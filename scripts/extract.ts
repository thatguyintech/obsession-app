import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import {
  buildSearchText,
  classifyPage,
  denormalizeBeat,
  parsePrintedPage,
} from "./lib/classifier.js";
import { applyCleanup } from "./lib/cleanup.js";
import { generateMoments } from "./lib/moments.js";
import { groupTextItemsIntoLines } from "./lib/pdf-lines.js";
import type { RawPage, ScreenplayElementDraft } from "./lib/types.js";

const SCHEMA_VERSION = 2;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PDF_PATH = join(ROOT, "obsession-2026.pdf");
const DATA_DIR = join(ROOT, "data");
const PUBLIC_DATA_DIR = join(ROOT, "public", "data");
const RAW_PATH = join(DATA_DIR, "obsession.raw.json");
const OUT_PATH = join(DATA_DIR, "obsession.json");

interface ExtractResult {
  meta: {
    title: string;
    author: string;
    pageCount: number;
    elementCount: number;
    beatCount: number;
    momentCount: number;
    extractedAt: string;
    version: number;
  };
  elements: ScreenplayElementDraft[];
  beats: Record<string, unknown>[];
  moments: ReturnType<typeof generateMoments>;
}

async function extract(): Promise<{ payload: ExtractResult; rawPages: RawPage[] }> {
  const pdfBytes = new Uint8Array(readFileSync(PDF_PATH));
  const doc = await getDocument({ data: pdfBytes, useSystemFonts: true }).promise;
  const rawPages: RawPage[] = [];
  const elements: ScreenplayElementDraft[] = [
    {
      id: "el-001",
      type: "title_card",
      title: "Obsession",
      author: "Curry Barker",
      subtitle: "March 9th",
      pdfPage: 1,
      searchText: "obsession curry barker march 9th",
    },
  ];

  for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex += 1) {
    const pdfPage = pageIndex + 1;
    const page = await doc.getPage(pdfPage);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const lines = groupTextItemsIntoLines(textContent.items as TextItem[], viewport.height);
    const printedPage = parsePrintedPage(lines);

    rawPages.push({
      pdfPage,
      printedPage,
      lines: lines.map((line) => ({
        x0: line.x0,
        y0: line.y0,
        x1: line.x1,
        y1: line.y1,
        text: line.text,
      })),
    });

    if (pdfPage === 1) {
      continue;
    }

    const pageElements = classifyPage(lines, viewport.width, pdfPage, printedPage);
    for (const element of pageElements) {
      element.id = `el-${String(elements.length + 1).padStart(3, "0")}`;
      element.searchText = buildSearchText(element);
      elements.push(element);
    }
  }

  const cleanedElements = applyCleanup(elements);

  const beats = cleanedElements.map((element, index) => ({
    id: `beat-${String(index + 1).padStart(3, "0")}`,
    elementId: element.id,
    index,
    ...denormalizeBeat(element),
  }));

  const moments = generateMoments(cleanedElements);

  return {
    payload: {
      meta: {
        title: "Obsession",
        author: "Curry Barker",
        pageCount: rawPages.length,
        elementCount: cleanedElements.length,
        beatCount: beats.length,
        momentCount: moments.length,
        extractedAt: new Date().toISOString().slice(0, 10),
        version: SCHEMA_VERSION,
      },
      elements: cleanedElements,
      beats,
      moments,
    },
    rawPages,
  };
}

const { payload, rawPages } = await extract();

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(PUBLIC_DATA_DIR, { recursive: true });

writeFileSync(RAW_PATH, JSON.stringify({ pages: rawPages }, null, 2));
writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
writeFileSync(join(PUBLIC_DATA_DIR, "obsession.json"), JSON.stringify(payload, null, 2));

console.log(`Wrote ${RAW_PATH}`);
console.log(`Wrote ${OUT_PATH}`);
console.log(`Wrote ${join(PUBLIC_DATA_DIR, "obsession.json")}`);
console.log(
  `${payload.meta.elementCount} elements, ${payload.meta.momentCount} moments, ${payload.meta.pageCount} pdf pages`,
);
