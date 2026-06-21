import type { ReaderState, SceneTocEntry, ScreenplayData, SearchResult, Moment } from "../types";
import { ensureDialogueSegments, flattenSegments } from "../../lib/dialogue-segments";
import { generateMoments } from "../../lib/moments";
import { MOMENT_LABELS, getMomentLabel } from "./moment-labels";

export { getMomentLabel };

export const STORAGE_KEY = "obsession-reader-state";

export function ensureMoments(data: ScreenplayData): ScreenplayData {
  if (data.moments?.length) {
    return data;
  }

  const moments = generateMoments(data.elements) as Moment[];
  return {
    ...data,
    meta: { ...data.meta, momentCount: moments.length },
    moments,
  };
}

export function loadReaderState(data: ScreenplayData): ReaderState {
  const fallback: ReaderState = {
    screenplayVersion: data.meta.version,
    currentMomentId: data.moments[0]?.id ?? "moment-001",
    currentMomentIndex: 0,
    scrollY: 0,
    lastReadAt: new Date().toISOString(),
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<ReaderState> & {
      currentBeatId?: string;
    };

    if (parsed.screenplayVersion !== data.meta.version) {
      return fallback;
    }

    if (parsed.currentMomentId) {
      const moment = data.moments.find((item) => item.id === parsed.currentMomentId);
      if (!moment) return fallback;
      return {
        screenplayVersion: data.meta.version,
        currentMomentId: moment.id,
        currentMomentIndex: moment.index,
        scrollY: parsed.scrollY ?? 0,
        lastReadAt: parsed.lastReadAt ?? new Date().toISOString(),
      };
    }

    if (parsed.currentBeatId) {
      const beat = data.beats.find((item) => item.id === parsed.currentBeatId);
      if (beat) {
        const moment = data.moments.find((item) => item.elementIds.includes(beat.elementId));
        if (moment) {
          return {
            screenplayVersion: data.meta.version,
            currentMomentId: moment.id,
            currentMomentIndex: moment.index,
            scrollY: 0,
            lastReadAt: parsed.lastReadAt ?? new Date().toISOString(),
          };
        }
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function saveReaderState(state: ReaderState): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...state,
      lastReadAt: new Date().toISOString(),
    }),
  );
}

export function buildSceneTableOfContents(data: ScreenplayData): SceneTocEntry[] {
  const elementMap = new Map(data.elements.map((element) => [element.id, element]));

  return data.moments
    .filter((moment) => moment.sceneHeadingId)
    .map((moment) => {
      const heading = elementMap.get(moment.sceneHeadingId!);
      return {
        momentNumber: moment.index,
        momentIndex: moment.index,
        momentId: moment.id,
        sceneHeadingId: moment.sceneHeadingId!,
        title: heading?.text ?? "Unknown scene",
        label: MOMENT_LABELS[moment.id],
        printedPage: moment.printedPage ?? heading?.printedPage,
      };
    });
}

export function filterScenes(entries: SceneTocEntry[], query: string): SceneTocEntry[] {
  const trimmed = query.trim();
  if (!trimmed) return entries;

  if (/^\d+$/.test(trimmed)) {
    return entries.filter((entry) => String(entry.momentNumber).startsWith(trimmed));
  }

  const normalized = trimmed.toLowerCase();
  return entries.filter(
    (entry) =>
      entry.title.toLowerCase().includes(normalized) ||
      entry.label?.toLowerCase().includes(normalized),
  );
}

export function resolveSceneJump(entries: SceneTocEntry[], query: string): SceneTocEntry | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const exact = entries.find((entry) => entry.momentNumber === Number(trimmed));
    if (exact) return exact;

    const filtered = filterScenes(entries, trimmed);
    return filtered.length === 1 ? filtered[0]! : null;
  }

  const filtered = filterScenes(entries, trimmed);
  return filtered.length === 1 ? filtered[0]! : null;
}

export function findMomentForElement(data: ScreenplayData, elementId: string): Moment | undefined {
  return data.moments.find((moment) => moment.elementIds.includes(elementId));
}

export function searchScreenplay(data: ScreenplayData, query: string): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return data.elements
    .filter((element) => element.searchText?.includes(normalized))
    .map((element) => {
      const moment = findMomentForElement(data, element.id);
      return {
        elementId: element.id,
        momentId: moment?.id ?? "",
        momentIndex: moment?.index ?? 0,
        type: element.type,
        snippet: buildSnippet(element),
        printedPage: element.printedPage,
      };
    })
    .filter((result) => result.momentId);
}

function buildSnippet(element: ScreenplayData["elements"][number]): string {
  if (element.type === "scene_heading" || element.type === "action") {
    return element.text ?? "";
  }
  if (element.type === "dialogue") {
    return `${element.character}: ${flattenSegments(ensureDialogueSegments(element))}`;
  }
  if (element.type === "dual_dialogue") {
    const left = element.left?.[0];
    const right = element.right?.[0];
    return `${left?.character ?? "?"} / ${right?.character ?? "?"}`;
  }
  return element.title ?? "";
}

export async function loadScreenplay(): Promise<ScreenplayData> {
  const response = await fetch("/data/obsession.json");
  if (!response.ok) {
    throw new Error("Failed to load screenplay data");
  }
  const data = (await response.json()) as ScreenplayData;
  return ensureMoments(data);
}
