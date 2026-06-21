export type DialogueSegmentKind = "speech" | "parenthetical";

export interface DialogueSegment {
  kind: DialogueSegmentKind;
  text: string;
}

export type ElementType =
  | "title_card"
  | "transition"
  | "scene_heading"
  | "action"
  | "dialogue"
  | "dual_dialogue";

export interface DialogueTrack {
  character: string;
  segments: DialogueSegment[];
}

export interface ScreenplayElement {
  id: string;
  type: ElementType;
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
  searchText?: string;
  /** Inclusive index into obsession.raw.json page.lines for QA PDF highlights */
  rawLineStart?: number;
  rawLineEnd?: number;
}

export interface Moment {
  id: string;
  index: number;
  elementIds: string[];
  sceneHeadingId?: string;
  printedPage?: number;
}

export interface SceneTocEntry {
  momentNumber: number;
  momentIndex: number;
  momentId: string;
  sceneHeadingId: string;
  title: string;
  /** Optional plot-summary label (READ-plot experiment) */
  label?: string;
  printedPage?: number;
}

/** @deprecated Legacy beat navigation — kept in JSON for debugging */
export interface Beat {
  id: string;
  elementId: string;
  index: number;
  type: ElementType;
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
}

export interface ScreenplayMeta {
  title: string;
  author: string;
  pageCount: number;
  elementCount: number;
  beatCount: number;
  momentCount: number;
  extractedAt: string;
  version: number;
}

export interface ScreenplayData {
  meta: ScreenplayMeta;
  elements: ScreenplayElement[];
  moments: Moment[];
  beats: Beat[];
}

export interface ReaderState {
  screenplayVersion: number;
  currentMomentId: string;
  currentMomentIndex: number;
  scrollY: number;
  lastReadAt: string;
}

export interface SearchResult {
  elementId: string;
  momentId: string;
  momentIndex: number;
  type: ElementType;
  snippet: string;
  printedPage?: number;
}
