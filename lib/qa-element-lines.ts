import {
  extractElementText,
  isRawContentLine,
  tokenize,
  type QaElementLike,
  type QaRawLine,
  type QaRawPage,
} from "./qa-compare";

/** pdf.js viewport scale in PdfPane — raw bboxes are at extract scale 1. */
export const QA_PDF_RENDER_SCALE = 1.35;
export const QA_PDF_EXTRACT_SCALE = 1;

const MATCH_THRESHOLD = 0.75;

export interface QaLineBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface QaRawLineWithBBox extends QaRawLine {
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
}

export interface MapElementOptions {
  /** Only match raw lines at or after this page.lines index. */
  minLineIndex?: number;
  /** Use element.rawLineStart/End when present (default true). */
  useStoredProvenance?: boolean;
}

function wordFrequency(words: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }
  return freq;
}

/** Share of element words found in a joined raw substring (0–1). */
function elementCoverageScore(joinedRaw: string, elementText: string): number {
  const elementWords = tokenize(elementText);
  if (elementWords.length === 0) return 0;

  const rawFreq = wordFrequency(tokenize(joinedRaw));
  const elementFreq = wordFrequency(elementWords);

  let matched = 0;
  for (const [word, count] of elementFreq) {
    matched += Math.min(count, rawFreq.get(word) ?? 0);
  }

  return matched / elementWords.length;
}

function isContentLine(line: QaRawLine): boolean {
  return isRawContentLine(line.text);
}

function lineBBox(line: QaRawLineWithBBox): QaLineBBox | null {
  if (
    line.x0 === undefined ||
    line.y0 === undefined ||
    line.x1 === undefined ||
    line.y1 === undefined
  ) {
    return null;
  }
  return { x0: line.x0, y0: line.y0, x1: line.x1, y1: line.y1 };
}

function indicesFromProvenance(
  element: QaElementLike,
  page: QaRawPage,
): number[] | null {
  if (element.rawLineStart === undefined || element.rawLineEnd === undefined) {
    return null;
  }
  if (element.rawLineEnd < element.rawLineStart) {
    return null;
  }

  const indices: number[] = [];
  for (let index = element.rawLineStart; index <= element.rawLineEnd; index += 1) {
    const line = page.lines[index];
    if (!line || !isContentLine(line)) {
      continue;
    }
    indices.push(index);
  }

  return indices.length > 0 ? indices : null;
}

function isSceneHeadingText(text: string): boolean {
  return text.startsWith("INT.") || text.startsWith("EXT.");
}

function isParentheticalText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("(") && trimmed.endsWith(")");
}

function isCharacterCueText(text: string, x0 = 250): boolean {
  if (text.length > 55 || isSceneHeadingText(text) || x0 < 150) {
    return false;
  }

  const letters = [...text].filter((char) => /[a-z]/i.test(char));
  if (letters.length === 0) {
    return false;
  }

  const capsRatio = letters.filter((char) => char === char.toUpperCase()).length / letters.length;
  return capsRatio >= 0.75;
}

function normalizeCharacterName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function lineMatchesCharacter(lineText: string, character: string): boolean {
  return normalizeCharacterName(lineText) === normalizeCharacterName(character);
}

/** Stop extending a highlight window at the next speaker, slug, or action line. */
function isHighlightBoundary(line: QaRawLine, hasContent: boolean, element: QaElementLike): boolean {
  if (!hasContent) {
    return false;
  }

  const text = line.text.trim();
  const x0 = line.x0 ?? 0;

  if (isSceneHeadingText(text) || isCharacterCueText(text, x0)) {
    return true;
  }

  // Action blocks span multiple left-margin lines — only break on slug/cue for action elements.
  if (element.type === "action" || element.type === "scene_heading") {
    return false;
  }

  if (x0 < 150 && !isParentheticalText(text)) {
    return true;
  }

  return false;
}

function prependCharacterCue(
  page: QaRawPage,
  indices: number[],
  character: string,
): number[] {
  if (indices.length === 0) {
    return indices;
  }

  const first = indices[0]!;
  const previous = page.lines[first - 1];
  if (!previous || !isContentLine(previous)) {
    return indices;
  }

  if (lineMatchesCharacter(previous.text, character)) {
    return [first - 1, ...indices];
  }

  return indices;
}

function findFuzzyLineIndices(
  element: QaElementLike,
  page: QaRawPage,
  minLineIndex: number,
): number[] {
  const elementText = extractElementText(element);
  if (!elementText.trim()) {
    return [];
  }

  const candidates = page.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => isContentLine(line) && index >= minLineIndex);

  let bestIndices: number[] = [];
  let bestScore = 0;
  let bestLength = Infinity;

  for (let start = 0; start < candidates.length; start += 1) {
    let joined = "";
    const indices: number[] = [];
    let previousScore = 0;

    for (let end = start; end < candidates.length; end += 1) {
      const { line, index } = candidates[end]!;

      if (isHighlightBoundary(line, indices.length > 0, element)) {
        break;
      }

      joined = joined ? `${joined} ${line.text}` : line.text;
      indices.push(index);

      const score = elementCoverageScore(joined, elementText);

      if (
        score >= MATCH_THRESHOLD &&
        (score > bestScore || (score === bestScore && indices.length < bestLength))
      ) {
        bestScore = score;
        bestIndices = [...indices];
        bestLength = indices.length;
      }

      if (score >= 0.99) {
        break;
      }

      // Duplicate words in later cues (e.g. "dropped") can plateau score — stop extending.
      if (indices.length > 1 && score <= previousScore) {
        break;
      }

      previousScore = score;
    }
  }

  if (bestScore < MATCH_THRESHOLD) {
    return [];
  }

  if (element.type === "dialogue" && element.character) {
    return prependCharacterCue(page, bestIndices, element.character);
  }

  return bestIndices;
}

function rectsForIndices(page: QaRawPage, indices: number[]): QaLineBBox[] {
  return indices
    .map((index) => lineBBox(page.lines[index] as QaRawLineWithBBox))
    .filter((box): box is QaLineBBox => box !== null);
}

function trimProvenanceToElement(
  element: QaElementLike,
  page: QaRawPage,
  indices: number[],
): number[] {
  if (indices.length === 0) {
    return indices;
  }

  const fuzzy = findFuzzyLineIndices(element, page, indices[0]!);
  if (fuzzy.length === 0) {
    return indices;
  }

  return fuzzy;
}

/**
 * Map an extracted element to contiguous raw PDF lines on the same page.
 * Prefers stored rawLineStart/End when available; otherwise fuzzy-matches text.
 */
export function mapElementToRawLines(
  element: QaElementLike,
  page: QaRawPage,
  options: MapElementOptions = {},
): { lineIndices: number[]; rects: QaLineBBox[] } {
  const useStoredProvenance = options.useStoredProvenance ?? true;

  if (useStoredProvenance) {
    const stored = indicesFromProvenance(element, page);
    if (stored) {
      const trimmed = trimProvenanceToElement(element, page, stored);
      return { lineIndices: trimmed, rects: rectsForIndices(page, trimmed) };
    }
  }

  const bestIndices = findFuzzyLineIndices(element, page, options.minLineIndex ?? 0);

  if (bestIndices.length === 0) {
    return { lineIndices: [], rects: [] };
  }

  return { lineIndices: bestIndices, rects: rectsForIndices(page, bestIndices) };
}
