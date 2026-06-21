export interface MomentElement {
  id?: string;
  type: string;
  text?: string;
  printedPage?: number;
}

export interface MomentDraft {
  id: string;
  index: number;
  elementIds: string[];
  sceneHeadingId?: string;
  printedPage?: number;
}

const CONTINUOUS_HEADING_RE = /\b-\s*CONTINUOUS\s*$/i;

export function isContinuousSceneHeading(text: string): boolean {
  return CONTINUOUS_HEADING_RE.test(text.trim());
}

export function startsNewMoment(element: MomentElement): boolean {
  if (element.type === "title_card") {
    return true;
  }
  if (element.type === "scene_heading") {
    return !isContinuousSceneHeading(element.text ?? "");
  }
  return false;
}

export function generateMoments(elements: MomentElement[]): MomentDraft[] {
  const moments: MomentDraft[] = [];
  let current: MomentDraft | null = null;
  let pendingTransitionId: string | null = null;

  for (const element of elements) {
    if (element.type === "transition") {
      pendingTransitionId = element.id ?? null;
      continue;
    }

    const prefixIds = pendingTransitionId ? [pendingTransitionId] : [];
    pendingTransitionId = null;

    if (startsNewMoment(element)) {
      if (current) {
        moments.push(current);
      }

      current = {
        id: `moment-${String(moments.length + 1).padStart(3, "0")}`,
        index: moments.length,
        elementIds: [...prefixIds, element.id!],
        ...(element.type === "scene_heading" ? { sceneHeadingId: element.id } : {}),
        ...(element.printedPage !== undefined ? { printedPage: element.printedPage } : {}),
      };
      continue;
    }

    if (!current) {
      current = {
        id: `moment-${String(moments.length + 1).padStart(3, "0")}`,
        index: moments.length,
        elementIds: [],
      };
    }

    current.elementIds.push(...prefixIds, element.id!);
    if (element.printedPage !== undefined && current.printedPage === undefined) {
      current.printedPage = element.printedPage;
    }
  }

  if (current) {
    moments.push(current);
  }

  return moments;
}
