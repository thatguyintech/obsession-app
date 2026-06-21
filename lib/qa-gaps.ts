import { normalizeForQaCompare } from "./qa-normalize.js";
import { tokenize } from "./qa-compare.js";

export type QaGapKind = "split_word" | "hyphen" | "token";

export interface QaSuspectedGap {
  id: string;
  kind: QaGapKind;
  label: string;
  reason: string;
  highlightWords: string[];
}

function elementHasWord(elementText: string, word: string): boolean {
  return tokenize(normalizeForQaCompare(elementText)).includes(word);
}

function elementHasJoined(elementText: string, left: string, right: string): boolean {
  const joined = `${left}${right}`;
  const spaced = `${left} ${right}`;
  const normalized = normalizeForQaCompare(elementText).toLowerCase();
  return normalized.includes(joined) || normalized.includes(spaced) || elementHasWord(elementText, joined);
}

export function buildSuspectedGaps(
  pdfPage: number,
  missingWords: string[],
  elementText: string,
): QaSuspectedGap[] {
  const gaps: QaSuspectedGap[] = [];
  const used = new Set<string>();
  const unique = [...new Set(missingWords)];

  for (let leftIndex = 0; leftIndex < unique.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < unique.length; rightIndex += 1) {
      const left = unique[leftIndex]!;
      const right = unique[rightIndex]!;
      if (used.has(left) || used.has(right)) {
        continue;
      }

      if (elementHasJoined(elementText, left, right)) {
        const joined = `${left}${right}`;
        gaps.push({
          id: `p${pdfPage}:split:${joined}`,
          kind: "split_word",
          label: `"${left} ${right}" in PDF → "${joined}" in JSON?`,
          reason: "Likely a PDF line-break split — JSON may already be correct.",
          highlightWords: [left, right],
        });
        used.add(left);
        used.add(right);
      }
    }
  }

  for (const word of unique) {
    if (used.has(word)) {
      continue;
    }

    gaps.push({
      id: `p${pdfPage}:token:${word}`,
      kind: "token",
      label: `"${word}"`,
      reason: "Token in raw PDF not matched after normalization — worth a look.",
      highlightWords: [word],
    });
  }

  return gaps;
}

export function filterActiveGaps(gaps: QaSuspectedGap[], dismissedIds: Set<string>): QaSuspectedGap[] {
  return gaps.filter((gap) => !dismissedIds.has(gap.id));
}
