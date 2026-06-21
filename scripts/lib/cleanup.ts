import type { ScreenplayElementDraft } from "./types.js";
import {
  ensureDialogueSegments,
  ensureTrackSegments,
  segmentsSearchParts,
} from "../../lib/dialogue-segments.js";
import { stripInlineEmphasis } from "../../lib/inline-emphasis.js";

const CHARACTER_CUE_FIXES: Record<string, string> = {
  "BEAR.": "BEAR",
  "NIC KY": "NICKY",
  "I AN": "IAN",
  "SARAH/NICKY": "SARAH & NICKY",
};

const TEXT_REPLACEMENTS: Array<[string, string]> = [
  ["wonde red", "wondered"],
  ["year ns", "yearns"],
  ["co mplain", "complain"],
  ["tim e", "time"],
  ["ea rly", "early"],
  ["C arter", "Carter"],
  ["I dro pped", "I dropped"],
  ["dro pped", "dropped"],
  ["Tha t", "That"],
  ["confused tha n", "confused than"],
  ["wou ld", "would"],
  ["go od", "good"],
  ["c ould", "could"],
  ["wr ong", "wrong"],
  ["o ut", "out"],
  ["sho wing", "showing"],
  ["besid e", "beside"],
  ["gi ves", "gives"],
  ["smo ke", "smoke"],
  ["Be ar", "Bear"],
  ["N icky", "Nicky"],
  ["h ugs", "hugs"],
  ["a r etort", "a retort"],
  ["clea r", "clear"],
  ["W hy", "Why"],
  ["Y ou", "You"],
  ["Ye ah", "Yeah"],
  ["y eah", "yeah"],
  ["l ets", "lets"],
  ["l ike", "like"],
  ["d eafeningly", "deafeningly"],
  ["wear ing", "wearing"],
  ["w alks", "walks"],
  ["p assion", "passion"],
  ["p lease", "please"],
  ["p robably", "probably"],
  ["b racing", "bracing"],
  ["s ame", "same"],
  ["peopl e", "people"],
  ["br ick", "brick"],
  ["in side", "inside"],
  ["unmov ed", "unmoved"],
  ["decent- looking", "decent-looking"],
  ["button- up", "button-up"],
  ["Ian .", "Ian."],
  ["love .", "love."],
  ["wish .", "wish."],
  ["around ,", "around,"],
  ["can ,", "can,"],
  ["she 's", "she's"],
  ["telling me she 's", "telling me she's"],
  ["filter s", "filters"],
  ["mom and pop", "mom-and-pop"],
  ["petals. approaches,", "petals. Bear approaches,"],
  ["She sit s.", "She sits."],
];

function shouldMergeActions(previous: string, next: string): boolean {
  const prev = previous.trim();
  const nextText = next.trim();
  if (!prev || !nextText) return false;

  if (/^[a-z"'""'(]/.test(nextText)) return true;
  if (/[,;:–-]$/.test(prev)) return true;
  if (prev.length <= 14 && /^[A-Z][A-Za-z]{0,10}\.?$/.test(prev)) return true;
  if (!/[.!?]["'""']?$/.test(prev) && nextText.length < 140) return true;

  return false;
}

function joinActionText(previous: string, next: string): string {
  return `${previous.trimEnd()} ${next.trimStart()}`;
}

function mergeSplitActions(elements: ScreenplayElementDraft[]): ScreenplayElementDraft[] {
  const merged: ScreenplayElementDraft[] = [];

  for (const element of elements) {
    const previous = merged[merged.length - 1];

    if (
      element.type === "action" &&
      previous?.type === "action" &&
      previous.text &&
      element.text &&
      shouldMergeActions(previous.text, element.text)
    ) {
      previous.text = joinActionText(previous.text, element.text);
      continue;
    }

    merged.push(element);
  }

  return merged;
}

function normalizeParenthetical(cue: string): string {
  return cue
    .replace(/\(O\s+\.\s*S\.?\s*\)/gi, "(O.S.)")
    .replace(/\(V\s+\.\s*O\.?\s*\)/gi, "(V.O.)")
    .replace(/\(O\.S\s*\)/gi, "(O.S.)")
    .replace(/\(V\.O\s*\)/gi, "(V.O.)");
}

export function normalizeCharacterCue(raw: string): string {
  const trimmed = raw.trim();
  if (CHARACTER_CUE_FIXES[trimmed]) {
    return CHARACTER_CUE_FIXES[trimmed];
  }

  let cue = normalizeParenthetical(trimmed);
  const parenIndex = cue.indexOf("(");
  if (parenIndex === -1) {
    return cue.replace(/\.$/, "");
  }

  const name = cue.slice(0, parenIndex).trim().replace(/\.$/, "");
  return `${name} ${cue.slice(parenIndex).trimStart()}`;
}

export function fixInlineText(text: string): string {
  let line = text.replace(/-\s+(?=[a-z])/g, "-");
  line = line.replace(/\s+([.,!?;:)'"])/g, "$1");
  line = line.replace(/\b([a-z]+)\s+'([a-z]+)\b/gi, "$1'$2");
  line = line.replace(/\bs\s+he\b/g, "she");

  for (const [from, to] of TEXT_REPLACEMENTS) {
    line = line.split(from).join(to);
  }

  return line;
}

function isOrphanCharacterCue(character: string): boolean {
  return character === "I";
}

function isContinuationSegment(segments: ReturnType<typeof ensureDialogueSegments>): boolean {
  const firstSpeech = segments.find((segment) => segment.kind === "speech");
  if (!firstSpeech) return false;
  const first = firstSpeech.text.trim();
  return /^[a-z(]/.test(first) || /^was\s/i.test(first);
}

function mergeOrphanDialogue(elements: ScreenplayElementDraft[]): ScreenplayElementDraft[] {
  const merged: ScreenplayElementDraft[] = [];

  for (const element of elements) {
    const previous = merged[merged.length - 1];

    if (
      element.type === "dialogue" &&
      previous?.type === "dialogue" &&
      element.character &&
      isOrphanCharacterCue(element.character) &&
      isContinuationSegment(ensureDialogueSegments(element)) &&
      previous.character?.startsWith("IAN")
    ) {
      previous.segments = [
        ...ensureDialogueSegments(previous),
        ...ensureDialogueSegments(element),
      ];
      continue;
    }

    merged.push(element);
  }

  return merged;
}

function cleanupDialogueTrack(track: { character: string; segments: { kind: string; text: string }[] }) {
  track.character = normalizeCharacterCue(track.character);
  track.segments = track.segments.map((segment) => ({
    ...segment,
    text: fixInlineText(segment.text),
  }));
}

function cleanupElement(element: ScreenplayElementDraft): ScreenplayElementDraft {
  const cleaned = { ...element };

  if (cleaned.text) {
    cleaned.text = fixInlineText(cleaned.text);
  }

  if (cleaned.character) {
    cleaned.character = normalizeCharacterCue(cleaned.character);
  }

  if (cleaned.segments) {
    cleaned.segments = cleaned.segments.map((segment) => ({
      ...segment,
      text: fixInlineText(segment.text),
    }));
  }

  if (cleaned.left) {
    cleaned.left = cleaned.left.map((track) => {
      cleanupDialogueTrack(track);
      return track;
    });
  }

  if (cleaned.right) {
    cleaned.right = cleaned.right.map((track) => {
      cleanupDialogueTrack(track);
      return track;
    });
  }

  return cleaned;
}

export function cleanupElements(elements: ScreenplayElementDraft[]): ScreenplayElementDraft[] {
  const mergedDialogue = mergeOrphanDialogue(elements);
  const mergedActions = mergeSplitActions(mergedDialogue);
  return mergedActions.map(cleanupElement);
}

export function rebuildSearchText(element: ScreenplayElementDraft): string {
  const parts: string[] = [];

  if (element.title) parts.push(element.title);
  if (element.author) parts.push(element.author);
  if (element.subtitle) parts.push(element.subtitle);
  if (element.text) parts.push(stripInlineEmphasis(element.text));
  if (element.character) parts.push(element.character);
  if (element.segments) {
    parts.push(...segmentsSearchParts(element.segments).map(stripInlineEmphasis));
  }

  for (const side of ["left", "right"] as const) {
    for (const track of element[side] ?? []) {
      parts.push(track.character);
      parts.push(
        ...segmentsSearchParts(ensureTrackSegments(track)).map(stripInlineEmphasis),
      );
    }
  }

  return parts.join(" ").toLowerCase();
}

export function applyCleanup(elements: ScreenplayElementDraft[]): ScreenplayElementDraft[] {
  return cleanupElements(elements).map((element) => ({
    ...element,
    searchText: rebuildSearchText(element),
  }));
}
