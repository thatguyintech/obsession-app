import type { QaTransformElement } from "./qa-element-transform.js";

export function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) {
    return items;
  }
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  return next;
}

/** Reorder elements that share a pdfPage without moving other pages. */
export function reorderPageElements(
  elements: QaTransformElement[],
  pdfPage: number,
  fromPageIndex: number,
  toPageIndex: number,
): QaTransformElement[] {
  const pageGlobalIndices: number[] = [];
  const pageElements: QaTransformElement[] = [];

  elements.forEach((element, index) => {
    if (element.pdfPage === pdfPage) {
      pageGlobalIndices.push(index);
      pageElements.push(element);
    }
  });

  const reorderedPage = moveArrayItem(pageElements, fromPageIndex, toPageIndex);
  if (reorderedPage === pageElements) {
    return elements;
  }

  const next = [...elements];
  pageGlobalIndices.forEach((globalIndex, pageIndex) => {
    next[globalIndex] = reorderedPage[pageIndex]!;
  });
  return next;
}
