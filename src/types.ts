export type ElementType =
  | "title_card"
  | "scene_heading"
  | "action"
  | "dialogue"
  | "dual_dialogue";

export interface DialogueTrack {
  character: string;
  parenthetical?: string;
  lines: string[];
}

export interface ScreenplayElement {
  id: string;
  type: ElementType;
  text?: string;
  title?: string;
  author?: string;
  subtitle?: string;
  character?: string;
  parenthetical?: string;
  lines?: string[];
  left?: DialogueTrack[];
  right?: DialogueTrack[];
  pdfPage?: number;
  printedPage?: number;
  searchText?: string;
}

export interface Moment {
  id: string;
  index: number;
  elementIds: string[];
  sceneHeadingId?: string;
  printedPage?: number;
}

export interface SceneTocEntry {
  momentIndex: number;
  momentId: string;
  sceneHeadingId: string;
  title: string;
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
  parenthetical?: string;
  lines?: string[];
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
