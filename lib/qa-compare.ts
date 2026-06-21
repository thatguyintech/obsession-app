import type { DialogueSegment } from "./dialogue-segments.js";
import {
  ensureDialogueSegments,
  ensureTrackSegments,
  flattenSegments,
} from "./dialogue-segments.js";

export const QA_OK_THRESHOLD = 0.95;
export const QA_WARN_THRESHOLD = 0.8;
export const PAGE_HEADER_RE = /^March 9th\b/i;
export const PAGE_NUMBER_RE = /^\d+\.?$/;

export type QaPageStatus = "SKIP" | "OK" | "WARN" | "FAIL";

export interface QaRawLine {
  text: string;
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
}

export interface QaRawPage {
  pdfPage: number;
  lines: QaRawLine[];
}

export interface QaElementLike {
  id: string;
  type: string;
  pdfPage?: number;
  text?: string;
  title?: string;
  author?: string;
  subtitle?: string;
  character?: string;
  segments?: DialogueSegment[];
  parenthetical?: string;
  lines?: string[];
  left?: { character?: string; segments?: DialogueSegment[]; parenthetical?: string; lines?: string[] }[];
  right?: { character?: string; segments?: DialogueSegment[]; parenthetical?: string; lines?: string[] }[];
  rawLineStart?: number;
  rawLineEnd?: number;
}

export interface QaPageReport {
  pdfPage: number;
  status: QaPageStatus;
  score: number;
  matchedWords: number;
  totalRawWords: number;
  missingWords: string[];
  addedWords: string[];
  elementIds: string[];
  note?: string;
}

export function normalizeQuotes(value: string): string {
  return value
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/`/g, "'");
}

export function normalizeText(value: string): string {
  return normalizeQuotes(value).toLowerCase().replace(/\s+/g, " ").trim();
}

export function tokenize(value: string): string[] {
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

function trackText(track: {
  character?: string;
  segments?: DialogueSegment[];
  parenthetical?: string;
  lines?: string[];
}): string {
  return [track.character ?? "", flattenSegments(ensureTrackSegments(track))].join(" ").trim();
}

export function extractElementText(element: QaElementLike): string {
  switch (element.type) {
    case "title_card":
      return [element.title, element.author, element.subtitle].filter(Boolean).join(" ");
    case "transition":
    case "scene_heading":
    case "action":
      return element.text ?? "";
    case "dialogue":
      return [element.character ?? "", flattenSegments(ensureDialogueSegments(element))].join(" ");
    case "dual_dialogue": {
      const sides = [...(element.left ?? []), ...(element.right ?? [])].map(trackText).filter(Boolean);
      return sides.join(" ");
    }
    default:
      return "";
  }
}

export function isRawContentLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || PAGE_HEADER_RE.test(trimmed)) {
    return false;
  }
  if (PAGE_NUMBER_RE.test(trimmed)) {
    return false;
  }
  return true;
}

export function collectRawPageText(page: QaRawPage): string {
  const lines = page.lines
    .map((line) => line.text.trim())
    .filter((text) => isRawContentLine(text));

  return lines.join(" ");
}

export function compareWordSets(rawText: string, elementText: string) {
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

export function classifyQaScore(score: number): Exclude<QaPageStatus, "SKIP"> {
  if (score >= QA_OK_THRESHOLD) return "OK";
  if (score >= QA_WARN_THRESHOLD) return "WARN";
  return "FAIL";
}

export function formatWordList(words: string[]): string {
  const unique = [...new Set(words)];
  return unique.map((word) => `"${word}"`).join(", ");
}

export function analyzeQaPage(page: QaRawPage, elements: QaElementLike[]): QaPageReport {
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

  const elementText = pageElements
    .map(extractElementText)
    .filter(Boolean)
    .join(" ");
  const comparison = compareWordSets(rawText, elementText);
  const status = classifyQaScore(comparison.score);

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

export function analyzeAllPages(pages: QaRawPage[], elements: QaElementLike[]): QaPageReport[] {
  return pages.map((page) => analyzeQaPage(page, elements));
}

export function reviewPageNumbers(reports: QaPageReport[]): number[] {
  return reports
    .filter((report) => report.status === "WARN" || report.status === "FAIL")
    .map((report) => report.pdfPage);
}
