import { isRawContentLine, type QaElementLike, type QaRawPage } from "./qa-compare.js";
import {
  mapElementToRawLines,
  type MapElementOptions,
  type QaLineBBox,
} from "./qa-element-lines.js";

export interface RawLineProvenance {
  rawLineStart: number;
  rawLineEnd: number;
}

export type ProvenanceElement = QaElementLike & RawLineProvenance;

function isContentLine(text: string): boolean {
  return isRawContentLine(text);
}

function contentLineIndices(page: QaRawPage): number[] {
  return page.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => isContentLine(line.text))
    .map(({ index }) => index);
}

function cursorAfterLineEnd(page: QaRawPage, rawLineEnd: number): number {
  const indices = contentLineIndices(page);
  const position = indices.indexOf(rawLineEnd);
  return position === -1 ? 0 : position + 1;
}

function cursorToMinLineIndex(page: QaRawPage, cursor: number): number {
  const indices = contentLineIndices(page);
  return indices[cursor] ?? page.lines.length;
}

export function clearProvenance<T extends QaElementLike>(element: T): T {
  const next = { ...element };
  delete next.rawLineStart;
  delete next.rawLineEnd;
  return next;
}

export function refreshElementProvenance<T extends QaElementLike>(
  elements: T[],
  rawPages: QaRawPage[],
): T[] {
  const pagesByNumber = new Map(rawPages.map((page) => [page.pdfPage, page]));
  const elementsByPage = new Map<number, T[]>();

  for (const element of elements) {
    if (element.pdfPage === undefined || element.type === "title_card") {
      continue;
    }
    const bucket = elementsByPage.get(element.pdfPage) ?? [];
    bucket.push(element);
    elementsByPage.set(element.pdfPage, bucket);
  }

  const provenanceById = new Map<string, RawLineProvenance>();

  for (const [pdfPage, pageElements] of elementsByPage) {
    const page = pagesByNumber.get(pdfPage);
    if (!page) {
      continue;
    }

    let cursor = 0;

    for (const element of pageElements) {
      const minLineIndex = cursorToMinLineIndex(page, cursor);
      const match = mapElementToRawLines(element, page, {
        minLineIndex,
        useStoredProvenance: false,
      });

      if (match.lineIndices.length === 0) {
        continue;
      }

      const rawLineStart = match.lineIndices[0]!;
      const rawLineEnd = match.lineIndices[match.lineIndices.length - 1]!;
      provenanceById.set(element.id, { rawLineStart, rawLineEnd });
      cursor = cursorAfterLineEnd(page, rawLineEnd);
    }
  }

  return elements.map((element) => {
    const provenance = provenanceById.get(element.id);
    if (!provenance) {
      return clearProvenance(element);
    }
    return { ...element, ...provenance };
  });
}

export function resolveElementHighlight(
  element: QaElementLike,
  page: QaRawPage,
  pageElements: QaElementLike[],
): { lineIndices: number[]; rects: QaLineBBox[] } {
  const elementIndex = pageElements.findIndex((item) => item.id === element.id);
  let minLineIndex = 0;

  if (elementIndex > 0) {
    const previous = pageElements[elementIndex - 1];
    if (previous?.rawLineEnd !== undefined) {
      minLineIndex = previous.rawLineEnd + 1;
    }
  }

  const options: MapElementOptions = {
    minLineIndex,
    useStoredProvenance: false,
  };

  return mapElementToRawLines(element, page, options);
}

export function countProvenanceCoverage(elements: QaElementLike[]): {
  anchored: number;
  total: number;
} {
  const total = elements.filter(
    (element) => element.type !== "title_card" && element.pdfPage !== undefined,
  ).length;
  const anchored = elements.filter(
    (element) =>
      element.rawLineStart !== undefined &&
      element.rawLineEnd !== undefined &&
      element.rawLineEnd >= element.rawLineStart,
  ).length;
  return { anchored, total };
}
