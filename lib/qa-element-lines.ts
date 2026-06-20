import {
  extractElementText,
  PAGE_HEADER_RE,
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
  const trimmed = line.text.trim();
  return trimmed.length > 0 && !PAGE_HEADER_RE.test(trimmed);
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

/**
 * Fuzzy-match an extracted element to contiguous raw PDF lines on the same page.
 * Returns original line indices (into page.lines) and PDF-space bboxes.
 */
export function mapElementToRawLines(
  element: QaElementLike,
  page: QaRawPage,
): { lineIndices: number[]; rects: QaLineBBox[] } {
  const elementText = extractElementText(element);
  if (!elementText.trim()) {
    return { lineIndices: [], rects: [] };
  }

  const candidates = page.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => isContentLine(line));

  let bestIndices: number[] = [];
  let bestScore = 0;
  let bestLength = Infinity;

  for (let start = 0; start < candidates.length; start += 1) {
    let joined = "";
    const indices: number[] = [];

    for (let end = start; end < candidates.length; end += 1) {
      const { line, index } = candidates[end]!;
      joined = joined ? `${joined} ${line.text}` : line.text;
      indices.push(index);

      const score = elementCoverageScore(joined, elementText);
      if (
        score > bestScore ||
        (score === bestScore && score >= MATCH_THRESHOLD && indices.length < bestLength)
      ) {
        bestScore = score;
        bestIndices = [...indices];
        bestLength = indices.length;
      }

      if (score >= 0.99) break;
    }
  }

  if (bestScore < MATCH_THRESHOLD) {
    return { lineIndices: [], rects: [] };
  }

  const rects = bestIndices
    .map((index) => lineBBox(page.lines[index] as QaRawLineWithBBox))
    .filter((box): box is QaLineBBox => box !== null);

  return { lineIndices: bestIndices, rects };
}
