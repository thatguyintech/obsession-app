import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  QA_OK_THRESHOLD,
  QA_WARN_THRESHOLD,
  analyzeAllPages,
  formatWordList,
  type QaElementLike,
  type QaRawPage,
} from "../lib/qa-compare.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RAW_PATH = join(ROOT, "data", "obsession.raw.json");
const DATA_PATH = join(ROOT, "data", "obsession.json");

interface RawPayload {
  pages: QaRawPage[];
}

interface ScreenplayPayload {
  meta: { pageCount: number };
  elements: QaElementLike[];
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
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

  const reports = analyzeAllPages(raw.pages, elements);

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
  console.log(`OK:   ${ok} pages (>= ${QA_OK_THRESHOLD * 100}% match)`);
  console.log(`WARN: ${warn} pages (${QA_WARN_THRESHOLD * 100}-${QA_OK_THRESHOLD * 100}% match)`);
  console.log(`FAIL: ${failCount} pages (< ${QA_WARN_THRESHOLD * 100}% match)`);
  console.log(`SKIP: ${skip} page${skip === 1 ? "" : "s"}`);

  if (needsReview.length > 0) {
    console.log(`\nPages needing review: ${needsReview.join(", ")}`);
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

main();
