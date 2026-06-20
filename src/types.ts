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
  extractedAt: string;
  version: number;
}

export interface ScreenplayData {
  meta: ScreenplayMeta;
  elements: ScreenplayElement[];
  beats: Beat[];
}

export interface ReaderState {
  screenplayVersion: number;
  currentBeatId: string;
  currentBeatIndex: number;
  lastReadAt: string;
}

export interface SearchResult {
  elementId: string;
  beatId: string;
  beatIndex: number;
  type: ElementType;
  snippet: string;
  printedPage?: number;
}
