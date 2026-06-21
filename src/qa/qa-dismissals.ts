const STORAGE_KEY = "obsession-qa-gap-dismissals";

type DismissalMap = Record<string, string[]>;

function readMap(): DismissalMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as DismissalMap;
  } catch {
    return {};
  }
}

function writeMap(map: DismissalMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getDismissedGapIds(pdfPage: number): Set<string> {
  const map = readMap();
  return new Set(map[String(pdfPage)] ?? []);
}

export function dismissGap(pdfPage: number, gapId: string): void {
  const map = readMap();
  const key = String(pdfPage);
  const current = new Set(map[key] ?? []);
  current.add(gapId);
  map[key] = [...current];
  writeMap(map);
}

export function restoreGap(pdfPage: number, gapId: string): void {
  const map = readMap();
  const key = String(pdfPage);
  map[key] = (map[key] ?? []).filter((id) => id !== gapId);
  writeMap(map);
}

export function clearPageDismissals(pdfPage: number): void {
  const map = readMap();
  delete map[String(pdfPage)];
  writeMap(map);
}
