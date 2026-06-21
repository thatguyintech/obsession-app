export type DialogueSegmentKind = "speech" | "parenthetical";

export interface DialogueSegment {
  kind: DialogueSegmentKind;
  text: string;
}

export interface DialogueTrackLike {
  character?: string;
  segments?: DialogueSegment[];
  parenthetical?: string;
  lines?: string[];
}

export interface DialogueElementLike {
  type: string;
  character?: string;
  segments?: DialogueSegment[];
  parenthetical?: string;
  lines?: string[];
  left?: DialogueTrackLike[];
  right?: DialogueTrackLike[];
}

export function legacyToSegments(
  parenthetical?: string,
  lines?: string[],
): DialogueSegment[] {
  const segments: DialogueSegment[] = [];

  if (parenthetical?.trim()) {
    segments.push({ kind: "parenthetical", text: parenthetical.trim() });
  }

  for (const line of lines ?? []) {
    const trimmed = line.trim();
    if (trimmed) {
      segments.push({ kind: "speech", text: line });
    }
  }

  return segments;
}

export function ensureTrackSegments(track: DialogueTrackLike): DialogueSegment[] {
  if (track.segments && track.segments.length > 0) {
    return track.segments;
  }
  return legacyToSegments(track.parenthetical, track.lines);
}

export function ensureDialogueSegments(element: DialogueElementLike): DialogueSegment[] {
  if (element.segments && element.segments.length > 0) {
    return element.segments;
  }
  return legacyToSegments(element.parenthetical, element.lines);
}

export function normalizeTrack<T extends DialogueTrackLike>(track: T): T {
  const segments = ensureTrackSegments(track);
  const { parenthetical: _p, lines: _l, ...rest } = track;
  return { ...rest, segments } as T;
}

export function normalizeDialogueElement<T extends DialogueElementLike>(element: T): T {
  if (element.type === "dialogue") {
    const segments = ensureDialogueSegments(element);
    const { parenthetical: _p, lines: _l, ...rest } = element;
    return { ...rest, segments } as T;
  }

  if (element.type === "dual_dialogue") {
    return {
      ...element,
      left: element.left?.map((track) => normalizeTrack(track)),
      right: element.right?.map((track) => normalizeTrack(track)),
    } as T;
  }

  return element;
}

export function segmentsSearchParts(segments: DialogueSegment[]): string[] {
  return segments.map((segment) => segment.text).filter(Boolean);
}

export function flattenSegments(segments: DialogueSegment[]): string {
  return segmentsSearchParts(segments).join(" ").trim();
}

export function speechTexts(segments: DialogueSegment[]): string[] {
  return segments.filter((segment) => segment.kind === "speech").map((segment) => segment.text);
}
