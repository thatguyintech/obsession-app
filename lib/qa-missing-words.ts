import { isRawContentLine, tokenize, type QaRawPage } from "./qa-compare.js";
import type { QaLineBBox } from "./qa-element-lines.js";

export interface MissingWordHit {
  word: string;
  lineIndices: number[];
  rects: QaLineBBox[];
}

function lineBBox(line: {
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
}): QaLineBBox | null {
  if (line.x0 === undefined || line.y0 === undefined || line.x1 === undefined || line.y1 === undefined) {
    return null;
  }
  return { x0: line.x0, y0: line.y0, x1: line.x1, y1: line.y1 };
}

export function findLineIndicesForWord(page: QaRawPage, word: string): number[] {
  const indices: number[] = [];

  for (let index = 0; index < page.lines.length; index += 1) {
    const line = page.lines[index];
    if (!line || !isRawContentLine(line.text)) {
      continue;
    }

    if (tokenize(line.text).includes(word)) {
      indices.push(index);
    }
  }

  return indices;
}

export function mapWordsToLines(page: QaRawPage, words: string[]): MissingWordHit[] {
  const unique = [...new Set(words)];

  return unique
    .map((word) => {
      const lineIndices = findLineIndicesForWord(page, word);
      const rects = lineIndices
        .map((index) => lineBBox(page.lines[index]!))
        .filter((rect): rect is QaLineBBox => rect !== null);

      return { word, lineIndices, rects };
    })
    .filter((hit) => hit.lineIndices.length > 0);
}

/** @deprecated use mapWordsToLines */
export function mapMissingWordsToLines(page: QaRawPage, missingWords: string[]): MissingWordHit[] {
  return mapWordsToLines(page, missingWords);
}

export function rectsForGapHits(hits: MissingWordHit[]): QaLineBBox[] {
  return rectsForMissingWords(hits);
}

export function rectsForMissingWords(hits: MissingWordHit[]): QaLineBBox[] {
  const seen = new Set<string>();
  const rects: QaLineBBox[] = [];

  for (const hit of hits) {
    for (const rect of hit.rects) {
      const key = `${rect.x0},${rect.y0},${rect.x1},${rect.y1}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      rects.push(rect);
    }
  }

  return rects;
}
