import type { DialogueSegment } from "../../lib/dialogue-segments.js";

export type { DialogueSegment };
export type DialogueSegmentKind = DialogueSegment["kind"];

export interface Line {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
}

export interface DialogueTrack {
  character: string;
  segments: DialogueSegment[];
}

export type ColumnSide = "left" | "right" | "center";

export interface ScreenplayElementDraft {
  type: string;
  text?: string;
  title?: string;
  author?: string;
  subtitle?: string;
  character?: string;
  segments?: DialogueSegment[];
  left?: DialogueTrack[];
  right?: DialogueTrack[];
  pdfPage?: number;
  printedPage?: number;
  id?: string;
  searchText?: string;
  rawLineStart?: number;
  rawLineEnd?: number;
}

export interface RawPage {
  pdfPage: number;
  printedPage: number | null;
  lines: Line[];
}
