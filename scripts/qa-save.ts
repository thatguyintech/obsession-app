import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { denormalizeBeat } from "./lib/classifier.js";
import { rebuildSearchText } from "./lib/cleanup.js";
import { generateMoments } from "./lib/moments.js";
import type { ScreenplayElementDraft } from "./lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_PATH = join(ROOT, "data", "obsession.json");
const PUBLIC_DATA_PATH = join(ROOT, "public", "data", "obsession.json");

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

export function prepareScreenplaySave(input: QaSavePayload): QaSavePayload {
  const elements = input.elements.map((element) => ({
    ...element,
    searchText: rebuildSearchText(element),
  }));

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

    mkdirSync(dirname(PUBLIC_DATA_PATH), { recursive: true });
    const serialized = JSON.stringify(prepared, null, 2);
    writeFileSync(DATA_PATH, serialized);
    writeFileSync(PUBLIC_DATA_PATH, serialized);

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
