import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { denormalizeBeat } from "./lib/classifier.js";
import { rebuildSearchText } from "./lib/cleanup.js";
import { generateMoments } from "./lib/moments.js";
import { normalizeDialogueElement } from "../lib/dialogue-segments.js";
import { refreshElementProvenance } from "../lib/qa-provenance.js";
import { writeScreenplay } from "../lib/screenplay-data.js";
import type { QaRawPage } from "../lib/qa-compare.js";
import type { ScreenplayElementDraft } from "./lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RAW_PATH = join(ROOT, "data", "obsession.raw.json");

export interface QaSavePayload {
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

export interface QaSaveResult {
  ok: boolean;
  data?: QaSavePayload;
  validateOutput?: string;
  error?: string;
}

function runValidate(): { ok: boolean; output: string } {
  try {
    const output = execSync("tsx scripts/validate.ts", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output: output.trim() };
  } catch (cause) {
    const error = cause as { stdout?: string; stderr?: string; message?: string };
    const output = [error.stdout, error.stderr, error.message].filter(Boolean).join("\n");
    return { ok: false, output };
  }
}

function loadRawPages(): QaRawPage[] | null {
  if (!existsSync(RAW_PATH)) {
    return null;
  }
  try {
    const payload = JSON.parse(readFileSync(RAW_PATH, "utf8")) as { pages: QaRawPage[] };
    return payload.pages;
  } catch {
    return null;
  }
}

export function prepareScreenplaySave(input: QaSavePayload): QaSavePayload {
  let elements = input.elements.map((element) => {
    const normalized = normalizeDialogueElement(element);
    return {
      ...normalized,
      searchText: rebuildSearchText(normalized),
    };
  });

  const rawPages = loadRawPages();
  if (rawPages) {
    elements = refreshElementProvenance(elements, rawPages);
  }

  const beats = elements.map((element, index) => ({
    id: `beat-${String(index + 1).padStart(3, "0")}`,
    elementId: element.id ?? `el-${String(index + 1).padStart(3, "0")}`,
    index,
    ...denormalizeBeat(element),
  }));

  const moments = generateMoments(elements);

  return {
    ...input,
    meta: {
      ...input.meta,
      elementCount: elements.length,
      beatCount: beats.length,
      momentCount: moments.length,
      version: input.meta.version + 1,
      extractedAt: new Date().toISOString().slice(0, 10),
    },
    elements,
    beats,
    moments,
  };
}

export function saveScreenplayFromQa(input: QaSavePayload): QaSaveResult {
  try {
    const prepared = prepareScreenplaySave(input);

    writeScreenplay(prepared);

    const validation = runValidate();
    if (!validation.ok) {
      return {
        ok: false,
        error: "Validate failed after save",
        validateOutput: validation.output,
        data: prepared,
      };
    }

    return {
      ok: true,
      data: prepared,
      validateOutput: validation.output,
    };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Save failed",
    };
  }
}
