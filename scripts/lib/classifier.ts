import type { ColumnSide, DialogueTrack, Line, ScreenplayElementDraft } from "./types.js";

const HEADER_RE = /^March 9th\s+(\d+)\.?\s*$/;

export function parsePrintedPage(lines: Line[]): number | null {
  for (const line of lines) {
    const match = HEADER_RE.exec(line.text.trim());
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

export function isPageHeader(text: string): boolean {
  return HEADER_RE.test(text.trim());
}

function isSceneHeading(text: string): boolean {
  return text.startsWith("INT.") || text.startsWith("EXT.");
}

function isParenthetical(text: string): boolean {
  const stripped = text.trim();
  return stripped.startsWith("(") && stripped.endsWith(")");
}

function isCharacterCue(text: string, x0: number): boolean {
  if (text.length > 55 || isSceneHeading(text) || x0 < 150) {
    return false;
  }

  const letters = [...text].filter((char) => /[a-z]/i.test(char));
  if (letters.length === 0) {
    return false;
  }

  const capsRatio = letters.filter((char) => char === char.toUpperCase()).length / letters.length;
  return capsRatio >= 0.75;
}

function lineColumn(line: Line, pageWidth: number): ColumnSide {
  const mid = pageWidth / 2;
  const center = (line.x0 + line.x1) / 2;
  if (center < mid - 18) return "left";
  if (center > mid + 18) return "right";
  return "center";
}

function linesAtY(lines: Line[], index: number, tolerance = 4): Line[] {
  const y = lines[index].y0;
  return lines.filter((line) => Math.abs(line.y0 - y) <= tolerance);
}

function trackToDict(track: DialogueTrack): DialogueTrack {
  return {
    character: track.character,
    lines: track.lines,
    ...(track.parenthetical ? { parenthetical: track.parenthetical } : {}),
  };
}

function parseDialogueTrack(
  lines: Line[],
  start: number,
  pageWidth: number,
  side: ColumnSide,
): [DialogueTrack | null, number] {
  let index = start;
  const track: DialogueTrack = { character: "", lines: [] };
  let found = false;

  while (index < lines.length) {
    const row = linesAtY(lines, index);
    const sideLines = row.filter((line) => lineColumn(line, pageWidth) === side);
    if (sideLines.length === 0) {
      if (found) break;
      return [null, start];
    }

    sideLines.sort((a, b) => a.y0 - b.y0);
    const texts = sideLines.map((line) => line.text);
    let rest: string[];

    if (!found) {
      if (!isCharacterCue(texts[0], sideLines[0].x0)) {
        return [null, start];
      }
      track.character = texts[0];
      found = true;
      rest = texts.slice(1);
    } else {
      rest = texts;
    }

    for (const text of rest) {
      if (isCharacterCue(text, sideLines[0].x0)) {
        return [track, index];
      }
      if (isParenthetical(text)) {
        track.parenthetical = text.slice(1, -1);
      } else if (isSceneHeading(text)) {
        return [track, index];
      } else {
        track.lines.push(text);
      }
    }

    const consumed = Math.max(...row.map((line) => lines.indexOf(line))) + 1;
    index = consumed <= index ? index + 1 : consumed;
  }

  return [found ? track : null, index];
}

function parseDualDialogue(
  lines: Line[],
  start: number,
  pageWidth: number,
): [ScreenplayElementDraft | null, number] {
  let index = start;
  const leftTracks: DialogueTrack[] = [];
  const rightTracks: DialogueTrack[] = [];

  while (index < lines.length) {
    const row = linesAtY(lines, index);
    const left = row.filter((line) => lineColumn(line, pageWidth) === "left");
    const right = row.filter((line) => lineColumn(line, pageWidth) === "right");
    if (left.length === 0 || right.length === 0) {
      break;
    }

    const [leftTrack, nextLeft] = parseDialogueTrack(lines, index, pageWidth, "left");
    const [rightTrack, nextRight] = parseDialogueTrack(lines, index, pageWidth, "right");
    if (!leftTrack || !rightTrack) {
      break;
    }

    leftTracks.push(leftTrack);
    rightTracks.push(rightTrack);
    index = Math.max(nextLeft, nextRight);
  }

  if (leftTracks.length === 0) {
    return [null, start];
  }

  return [
    {
      type: "dual_dialogue",
      left: leftTracks.map(trackToDict),
      right: rightTracks.map(trackToDict),
    },
    index,
  ];
}

function parseDialogue(
  lines: Line[],
  start: number,
  pageWidth: number,
): [ScreenplayElementDraft | null, number] {
  if (!isCharacterCue(lines[start].text, lines[start].x0)) {
    return [null, start];
  }

  const track: DialogueTrack = { character: lines[start].text, lines: [] };
  let index = start + 1;

  while (index < lines.length) {
    const line = lines[index];
    if (isPageHeader(line.text)) {
      index += 1;
      continue;
    }

    const row = linesAtY(lines, index);
    if (
      row.some((other) => lineColumn(other, pageWidth) === "left") &&
      row.some((other) => lineColumn(other, pageWidth) === "right")
    ) {
      break;
    }
    if (isSceneHeading(line.text)) break;
    if (isCharacterCue(line.text, line.x0)) break;
    if (line.x0 < 120 && !isParenthetical(line.text)) break;

    if (isParenthetical(line.text)) {
      track.parenthetical = line.text.slice(1, -1);
    } else {
      track.lines.push(line.text);
    }
    index += 1;
  }

  if (track.lines.length === 0 && !track.parenthetical) {
    return [null, start];
  }

  return [
    {
      type: "dialogue",
      character: track.character,
      ...(track.parenthetical ? { parenthetical: track.parenthetical } : {}),
      lines: track.lines,
    },
    index,
  ];
}

function parseAction(lines: Line[], start: number, pageWidth: number): [ScreenplayElementDraft, number] {
  const chunks = [lines[start].text];
  let index = start + 1;

  while (index < lines.length) {
    const line = lines[index];
    if (isPageHeader(line.text)) {
      index += 1;
      continue;
    }

    const row = linesAtY(lines, index);
    if (
      row.some((other) => lineColumn(other, pageWidth) === "left") &&
      row.some((other) => lineColumn(other, pageWidth) === "right")
    ) {
      break;
    }
    if (isSceneHeading(line.text)) break;
    if (isCharacterCue(line.text, line.x0)) break;
    if (line.x0 >= 120) break;
    if (line.y0 - lines[index - 1].y0 > 24) break;

    chunks.push(line.text);
    index += 1;
  }

  return [{ type: "action", text: chunks.join(" ") }, index];
}

export function classifyPage(
  lines: Line[],
  pageWidth: number,
  pdfPage: number,
  printedPage: number | null,
): ScreenplayElementDraft[] {
  const elements: ScreenplayElementDraft[] = [];
  const filtered = lines.filter((line) => !isPageHeader(line.text));
  let index = 0;

  while (index < filtered.length) {
    const line = filtered[index];
    const row = linesAtY(filtered, index);
    const hasLeft = row.some((other) => lineColumn(other, pageWidth) === "left");
    const hasRight = row.some((other) => lineColumn(other, pageWidth) === "right");

    if (hasLeft && hasRight) {
      const [dual, nextIndex] = parseDualDialogue(filtered, index, pageWidth);
      if (dual) {
        dual.pdfPage = pdfPage;
        if (printedPage !== null) dual.printedPage = printedPage;
        elements.push(dual);
        index = nextIndex;
        continue;
      }
    }

    if (isSceneHeading(line.text)) {
      let text = line.text;
      let nextIndex = index + 1;
      while (nextIndex < filtered.length) {
        const next = filtered[nextIndex];
        if (next.x0 > 120 || isSceneHeading(next.text) || isCharacterCue(next.text, next.x0)) {
          break;
        }
        if (next.y0 - filtered[nextIndex - 1].y0 > 20) {
          break;
        }
        text = `${text} ${next.text}`;
        nextIndex += 1;
      }
      elements.push({
        type: "scene_heading",
        text,
        pdfPage,
        ...(printedPage !== null ? { printedPage } : {}),
      });
      index = nextIndex;
      continue;
    }

    const [dialogue, dialogueNext] = parseDialogue(filtered, index, pageWidth);
    if (dialogue) {
      dialogue.pdfPage = pdfPage;
      if (printedPage !== null) dialogue.printedPage = printedPage;
      elements.push(dialogue);
      index = dialogueNext;
      continue;
    }

    if (line.x0 < 120) {
      const [action, actionNext] = parseAction(filtered, index, pageWidth);
      action.pdfPage = pdfPage;
      if (printedPage !== null) action.printedPage = printedPage;
      elements.push(action);
      index = actionNext;
      continue;
    }

    index += 1;
  }

  return elements;
}

export function buildSearchText(element: ScreenplayElementDraft): string {
  const parts: string[] = [];

  switch (element.type) {
    case "title_card":
      parts.push(element.title ?? "", element.author ?? "", element.subtitle ?? "");
      break;
    case "scene_heading":
    case "action":
      parts.push(element.text ?? "");
      break;
    case "dialogue":
      parts.push(element.character ?? "", element.parenthetical ?? "", ...(element.lines ?? []));
      break;
    case "dual_dialogue":
      for (const side of ["left", "right"] as const) {
        for (const track of element[side] ?? []) {
          parts.push(track.character, track.parenthetical ?? "", ...track.lines);
        }
      }
      break;
  }

  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function denormalizeBeat(element: ScreenplayElementDraft): Record<string, unknown> {
  const beat: Record<string, unknown> = { type: element.type };

  switch (element.type) {
    case "title_card":
      if (element.title) beat.title = element.title;
      if (element.author) beat.author = element.author;
      if (element.subtitle) beat.subtitle = element.subtitle;
      break;
    case "scene_heading":
      beat.text = element.text;
      break;
    case "action":
      beat.text = element.text;
      break;
    case "dialogue":
      beat.character = element.character;
      if (element.parenthetical) beat.parenthetical = element.parenthetical;
      beat.lines = element.lines;
      break;
    case "dual_dialogue":
      beat.left = element.left;
      beat.right = element.right;
      break;
  }

  if (element.pdfPage !== undefined) beat.pdfPage = element.pdfPage;
  if (element.printedPage !== undefined) beat.printedPage = element.printedPage;
  return beat;
}
