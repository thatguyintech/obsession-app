import type { ReaderState, ScreenplayData, SearchResult } from "../types";

export const STORAGE_KEY = "obsession-reader-state";

export function loadReaderState(data: ScreenplayData): ReaderState {
  const fallback: ReaderState = {
    screenplayVersion: data.meta.version,
    currentBeatId: data.beats[0]?.id ?? "beat-001",
    currentBeatIndex: 0,
    lastReadAt: new Date().toISOString(),
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as ReaderState;
    if (parsed.screenplayVersion !== data.meta.version) return fallback;

    const beat = data.beats.find((item) => item.id === parsed.currentBeatId);
    if (!beat) return fallback;

    return {
      screenplayVersion: data.meta.version,
      currentBeatId: beat.id,
      currentBeatIndex: beat.index,
      lastReadAt: parsed.lastReadAt,
    };
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

export function searchScreenplay(data: ScreenplayData, query: string): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const beatByElement = new Map(data.beats.map((beat) => [beat.elementId, beat]));

  return data.elements
    .filter((element) => element.searchText?.includes(normalized))
    .map((element) => {
      const beat = beatByElement.get(element.id);
      return {
        elementId: element.id,
        beatId: beat?.id ?? "",
        beatIndex: beat?.index ?? 0,
        type: element.type,
        snippet: buildSnippet(element),
        printedPage: element.printedPage,
      };
    })
    .filter((result) => result.beatId);
}

function buildSnippet(element: ScreenplayData["elements"][number]): string {
  if (element.type === "scene_heading" || element.type === "action") {
    return element.text ?? "";
  }
  if (element.type === "dialogue") {
    return `${element.character}: ${element.lines?.join(" ") ?? ""}`;
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
  return response.json() as Promise<ScreenplayData>;
}
