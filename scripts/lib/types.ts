export interface Line {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
}

export interface DialogueTrack {
  character: string;
  parenthetical?: string;
  lines: string[];
}

export type ColumnSide = "left" | "right" | "center";

export interface ScreenplayElementDraft {
  type: string;
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
  id?: string;
  searchText?: string;
}

export interface RawPage {
  pdfPage: number;
  printedPage: number | null;
  lines: Line[];
}
