import {
  ensureDialogueSegments,
  ensureTrackSegments,
  flattenSegments,
} from "./dialogue-segments.js";
import type { QaElementLike } from "./qa-compare.js";

/** Types editable in QA — excludes title_card and dual_dialogue. */
export const QA_EDITABLE_ELEMENT_TYPES = [
  "action",
  "dialogue",
  "scene_heading",
  "transition",
] as const;

export type QaEditableElementType = (typeof QA_EDITABLE_ELEMENT_TYPES)[number];

export type QaTransformElement = QaElementLike & { id: string };

export function isQaEditableElementType(value: string): value is QaEditableElementType {
  return (QA_EDITABLE_ELEMENT_TYPES as readonly string[]).includes(value);
}

export function nextElementId(elements: Pick<QaTransformElement, "id">[]): string {
  const max = elements.reduce((acc, element) => {
    const match = /^el-(\d+)$/.exec(element.id);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return `el-${String(max + 1).padStart(3, "0")}`;
}

export function extractElementPlainText(element: QaTransformElement): string {
  switch (element.type) {
    case "action":
    case "scene_heading":
    case "transition":
      return element.text?.trim() ?? "";
    case "dialogue":
      return flattenSegments(ensureDialogueSegments(element));
    case "dual_dialogue": {
      const parts: string[] = [];
      for (const track of [...(element.left ?? []), ...(element.right ?? [])]) {
        const speech = ensureTrackSegments(track)
          .filter((segment) => segment.kind === "speech")
          .map((segment) => segment.text)
          .join(" ");
        if (speech.trim()) {
          parts.push(speech.trim());
        }
      }
      return parts.join(" ");
    }
    case "title_card":
      return [element.title, element.subtitle, element.author].filter(Boolean).join(" ").trim();
    default:
      return "";
  }
}

export function convertElementType(
  element: QaTransformElement,
  newType: QaEditableElementType,
): QaTransformElement {
  if (element.type === newType) {
    return element;
  }

  const text = extractElementPlainText(element);
  const base = {
    id: element.id,
    pdfPage: element.pdfPage,
    printedPage: element.printedPage,
    rawLineStart: element.rawLineStart,
    rawLineEnd: element.rawLineEnd,
  };

  switch (newType) {
    case "action":
    case "scene_heading":
    case "transition":
      return { ...base, type: newType, text };
    case "dialogue":
      return {
        ...base,
        type: "dialogue",
        character: element.type === "dialogue" ? (element.character ?? "") : "",
        segments: text ? [{ kind: "speech", text }] : [{ kind: "speech", text: "" }],
      };
    default:
      return element;
  }
}

export function createEmptyElement(
  type: QaEditableElementType,
  id: string,
  pdfPage: number,
  printedPage?: number,
): QaTransformElement {
  const base = {
    id,
    pdfPage,
    ...(printedPage !== undefined ? { printedPage } : {}),
  };

  switch (type) {
    case "action":
    case "scene_heading":
    case "transition":
      return { ...base, type, text: "" };
    case "dialogue":
      return {
        ...base,
        type,
        character: "",
        segments: [{ kind: "speech", text: "" }],
      };
    default:
      return { ...base, type: "action", text: "" };
  }
}

export function findElementInsertIndex(
  elements: QaTransformElement[],
  pdfPage: number,
  afterElementId?: string | null,
): number {
  if (afterElementId) {
    const afterIndex = elements.findIndex((element) => element.id === afterElementId);
    if (afterIndex >= 0) {
      return afterIndex + 1;
    }
  }

  let lastOnPage = -1;
  for (let index = 0; index < elements.length; index += 1) {
    if (elements[index]?.pdfPage === pdfPage) {
      lastOnPage = index;
    }
  }
  if (lastOnPage >= 0) {
    return lastOnPage + 1;
  }

  for (let index = 0; index < elements.length; index += 1) {
    if ((elements[index]?.pdfPage ?? 0) > pdfPage) {
      return index;
    }
  }

  return elements.length;
}
