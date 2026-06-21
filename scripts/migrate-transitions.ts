import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isTransitionLine, isTransitionText } from "../lib/transitions.js";
import { prepareScreenplaySave, type QaSavePayload } from "./qa-save.js";
import type { ScreenplayElementDraft } from "./lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_PATH = join(ROOT, "data", "obsession.json");
const PUBLIC_DATA_PATH = join(ROOT, "public", "data", "obsession.json");
const RAW_PATH = join(ROOT, "data", "obsession.raw.json");

interface RawPage {
  pdfPage: number;
  lines: { text: string; x0: number }[];
}

function normalizeHeading(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function maxElementNumber(elements: ScreenplayElementDraft[]): number {
  return elements.reduce((max, element) => {
    const match = /^el-(\d+)$/.exec(element.id ?? "");
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
}

function findTransitionInserts(
  rawPages: RawPage[],
  elements: ScreenplayElementDraft[],
): Array<{ headingId: string; transitionText: string; pdfPage: number; printedPage?: number }> {
  const inserts: Array<{
    headingId: string;
    transitionText: string;
    pdfPage: number;
    printedPage?: number;
  }> = [];

  for (const page of rawPages) {
    const lines = page.lines;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!isTransitionLine(line)) continue;

      const transitionText = line.text.trim();
      let headingText: string | null = null;

      for (let next = index + 1; next < lines.length; next += 1) {
        const candidate = lines[next].text.trim();
        if (!candidate || /^March 9th\b/i.test(candidate)) continue;
        if (candidate.startsWith("INT.") || candidate.startsWith("EXT.")) {
          headingText = candidate;
          break;
        }
        break;
      }

      if (!headingText) continue;

      const heading = elements.find(
        (element) =>
          element.type === "scene_heading" &&
          element.pdfPage === page.pdfPage &&
          normalizeHeading(element.text ?? "") === normalizeHeading(headingText!),
      );

      if (!heading?.id) continue;

      const headingIndex = elements.findIndex((element) => element.id === heading.id);
      const previous = headingIndex > 0 ? elements[headingIndex - 1] : null;
      if (previous?.type === "transition" && isTransitionText(previous.text ?? "")) {
        continue;
      }

      inserts.push({
        headingId: heading.id,
        transitionText,
        pdfPage: page.pdfPage,
        ...(heading.printedPage !== undefined ? { printedPage: heading.printedPage } : {}),
      });
    }
  }

  return inserts;
}

function main(): void {
  const payload = JSON.parse(readFileSync(DATA_PATH, "utf8")) as QaSavePayload;
  const raw = JSON.parse(readFileSync(RAW_PATH, "utf8")) as { pages: RawPage[] };

  const inserts = findTransitionInserts(raw.pages, payload.elements);
  if (inserts.length === 0) {
    console.log("No transition inserts needed");
    return;
  }

  const insertMap = new Map(inserts.map((insert) => [insert.headingId, insert]));
  const elements: ScreenplayElementDraft[] = [];
  let nextNumber = maxElementNumber(payload.elements) + 1;

  for (const element of payload.elements) {
    const insert = insertMap.get(element.id ?? "");
    if (insert) {
      elements.push({
        id: `el-${String(nextNumber).padStart(3, "0")}`,
        type: "transition",
        text: insert.transitionText,
        pdfPage: insert.pdfPage,
        ...(insert.printedPage !== undefined ? { printedPage: insert.printedPage } : {}),
      });
      nextNumber += 1;
    }
    elements.push(element);
  }

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

  console.log(`Inserted ${inserts.length} transition element(s)`);
  for (const insert of inserts) {
    console.log(`  ${insert.transitionText} → before ${insert.headingId}`);
  }
  console.log(`  version: ${payload.meta.version} → ${prepared.meta.version}`);
  console.log(`  elements: ${prepared.meta.elementCount}`);
}

main();
