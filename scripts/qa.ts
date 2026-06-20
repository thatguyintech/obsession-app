import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RAW_PATH = join(ROOT, "data", "obsession.raw.json");
const DATA_PATH = join(ROOT, "data", "obsession.json");

const OK_THRESHOLD = 0.95;
const WARN_THRESHOLD = 0.8;
const PAGE_HEADER_RE = /^March 9th\b/i;

type PageStatus = "SKIP" | "OK" | "WARN" | "FAIL";

interface RawLine {
  text: string;
}

interface RawPage {
  pdfPage: number;
  lines: RawLine[];
}

interface DialogueTrack {
  character?: string;
  parenthetical?: string;
  lines?: string[];
}

interface ScreenplayElement {
  id: string;
  type: string;
  pdfPage?: number;
  text?: string;
  title?: string;
  author?: string;
  subtitle?: string;
  character?: string;
  parenthetical?: string;
  lines?: string[];
  left?: DialogueTrack[];
  right?: DialogueTrack[];
}

interface RawPayload {
  pages: RawPage[];
}

interface ScreenplayPayload {
  meta: { pageCount: number };
  elements: ScreenplayElement[];
}

interface PageReport {
  pdfPage: number;
  status: PageStatus;
  score: number;
  matchedWords: number;
  totalRawWords: number;
  missingWords: string[];
  addedWords: string[];
  elementIds: string[];
  note?: string;
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function normalizeQuotes(value: string): string {
  return value
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/`/g, "'");
}

function normalizeText(value: string): string {
  return normalizeQuotes(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  return normalized
    .split(/\s+/)
    .map((word) => word.replace(/^[^\w']+|[^\w']+$/g, ""))
    .filter(Boolean);
}

function wordFrequency(words: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }
  return freq;
}

function trackText(track: DialogueTrack): string {
  return [track.character ?? "", track.parenthetical ?? "", ...(track.lines ?? [])].join(" ").trim();
}

function extractElementText(element: ScreenplayElement): string {
  switch (element.type) {
    case "title_card":
      return [element.title, element.author, element.subtitle].filter(Boolean).join(" ");
    case "scene_heading":
    case "action":
      return element.text ?? "";
    case "dialogue":
      return [element.character ?? "", element.parenthetical ?? "", ...(element.lines ?? [])].join(" ");
    case "dual_dialogue": {
      const sides = [...(element.left ?? []), ...(element.right ?? [])].map(trackText).filter(Boolean);
      return sides.join(" ");
    }
    default:
      return "";
  }
}

function collectRawPageText(page: RawPage): string {
  const lines = page.lines
    .map((line) => line.text.trim())
    .filter((text) => text.length > 0 && !PAGE_HEADER_RE.test(text));

  return lines.join(" ");
}

function collectElementPageText(elements: ScreenplayElement[], pdfPage: number): string {
  return elements
    .filter((element) => element.pdfPage === pdfPage)
    .map(extractElementText)
    .filter(Boolean)
    .join(" ");
}

function compareWordSets(rawText: string, elementText: string) {
  const rawWords = tokenize(rawText);
  const elementWords = tokenize(elementText);
  const rawFreq = wordFrequency(rawWords);
  const elementFreq = wordFrequency(elementWords);

  let matchedWords = 0;
  const missingWords: string[] = [];
  const addedWords: string[] = [];

  for (const [word, rawCount] of rawFreq) {
    const elementCount = elementFreq.get(word) ?? 0;
    matchedWords += Math.min(rawCount, elementCount);
    const missingCount = rawCount - elementCount;
    for (let index = 0; index < missingCount; index += 1) {
      missingWords.push(word);
    }
  }

  for (const [word, elementCount] of elementFreq) {
    const rawCount = rawFreq.get(word) ?? 0;
    const addedCount = elementCount - rawCount;
    for (let index = 0; index < addedCount; index += 1) {
      addedWords.push(word);
    }
  }

  const totalRawWords = rawWords.length;
  const score = totalRawWords === 0 ? 1 : matchedWords / totalRawWords;

  return {
    score,
    matchedWords,
    totalRawWords,
    missingWords,
    addedWords,
  };
}

function classifyScore(score: number): Exclude<PageStatus, "SKIP"> {
  if (score >= OK_THRESHOLD) return "OK";
  if (score >= WARN_THRESHOLD) return "WARN";
  return "FAIL";
}

function formatWordList(words: string[]): string {
  const unique = [...new Set(words)];
  return unique.map((word) => `"${word}"`).join(", ");
}

function analyzePage(
  page: RawPage,
  elements: ScreenplayElement[],
): PageReport {
  const pdfPage = page.pdfPage;
  const pageElements = elements.filter((element) => element.pdfPage === pdfPage);
  const elementIds = pageElements.map((element) => element.id);
  const rawText = collectRawPageText(page);

  if (pdfPage === 1 || rawText.trim().length === 0) {
    return {
      pdfPage,
      status: "SKIP",
      score: 1,
      matchedWords: 0,
      totalRawWords: 0,
      missingWords: [],
      addedWords: [],
      elementIds,
      note: pdfPage === 1 ? "title card, no raw text" : "no raw text",
    };
  }

  const elementText = collectElementPageText(elements, pdfPage);
  const comparison = compareWordSets(rawText, elementText);
  const status = classifyScore(comparison.score);

  return {
    pdfPage,
    status,
    score: comparison.score,
    matchedWords: comparison.matchedWords,
    totalRawWords: comparison.totalRawWords,
    missingWords: comparison.missingWords,
    addedWords: comparison.addedWords,
    elementIds,
    note:
      status === "WARN" && comparison.missingWords.length > 0
        ? "Possibly split across elements at page boundary"
        : undefined,
  };
}

function loadJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    fail(`Missing ${path}. Run pnpm extract first.`);
  }
}

function main(): void {
  const raw = loadJson<RawPayload>(RAW_PATH);
  const payload = loadJson<ScreenplayPayload>(DATA_PATH);
  const { elements, meta } = payload;

  if (!raw.pages?.length) {
    fail("raw.json has no pages");
  }

  if (meta.pageCount !== raw.pages.length) {
    fail(`Page count mismatch: obsession.json=${meta.pageCount}, raw.json=${raw.pages.length}`);
  }

  const reports = raw.pages.map((page) => analyzePage(page, elements));

  console.log("=== Obsession QA Report ===");
  console.log(`${raw.pages.length} pages, ${elements.length} elements\n`);

  for (const report of reports) {
    const pageLabel = String(report.pdfPage).padStart(2, " ");

    if (report.status === "SKIP") {
      console.log(`Page ${pageLabel}: SKIP (${report.note})`);
      if (report.elementIds.length > 0) {
        console.log(`  Elements on this page: ${report.elementIds.join(", ")}`);
      }
      continue;
    }

    const pct = Math.round(report.score * 100);
    console.log(
      `Page ${pageLabel}: ${report.status} (${pct}% — ${report.matchedWords}/${report.totalRawWords} words)`,
    );

    if (report.status === "WARN" || report.status === "FAIL") {
      if (report.missingWords.length > 0) {
        console.log(`  Missing from elements: ${formatWordList(report.missingWords)}`);
      }

      if (report.addedWords.length > 0) {
        console.log(`  Extra in elements: ${formatWordList(report.addedWords)}`);
      }

      if (report.note) {
        console.log(`  ${report.note}`);
      }

      console.log(`  Elements on this page: ${report.elementIds.join(", ")}`);
    }
  }

  const ok = reports.filter((report) => report.status === "OK").length;
  const warn = reports.filter((report) => report.status === "WARN").length;
  const failCount = reports.filter((report) => report.status === "FAIL").length;
  const skip = reports.filter((report) => report.status === "SKIP").length;
  const needsReview = reports
    .filter((report) => report.status === "WARN" || report.status === "FAIL")
    .map((report) => report.pdfPage);

  console.log("\n=== Summary ===");
  console.log(`OK:   ${ok} pages (>= ${OK_THRESHOLD * 100}% match)`);
  console.log(`WARN: ${warn} pages (${WARN_THRESHOLD * 100}-${OK_THRESHOLD * 100}% match)`);
  console.log(`FAIL: ${failCount} pages (< ${WARN_THRESHOLD * 100}% match)`);
  console.log(`SKIP: ${skip} page${skip === 1 ? "" : "s"}`);

  if (needsReview.length > 0) {
    console.log(`\nPages needing review: ${needsReview.join(", ")}`);
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

main();
