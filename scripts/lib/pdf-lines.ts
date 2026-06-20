import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { Line } from "./types.js";

interface PositionedItem {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
}

function toPositionedItem(item: TextItem, pageHeight: number): PositionedItem | null {
  if (!item.str.trim()) {
    return null;
  }

  const [, , , scaleY, translateX, translateY] = item.transform;
  const height = item.height ?? Math.abs(scaleY);
  const width = item.width ?? 0;
  const x0 = translateX;
  const y0 = pageHeight - translateY - height;
  return {
    x0,
    y0,
    x1: x0 + width,
    y1: y0 + height,
    text: item.str,
  };
}

export function groupTextItemsIntoLines(items: TextItem[], pageHeight: number): Line[] {
  const positioned = items
    .map((item) => toPositionedItem(item, pageHeight))
    .filter((item): item is PositionedItem => item !== null);

  const buckets = new Map<number, PositionedItem[]>();

  for (const item of positioned) {
    const key = Math.round(item.y0 / 2) * 2;
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  }

  const lines: Line[] = [];

  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => a.x0 - b.x0);
    let current = bucket[0];

    for (let index = 1; index < bucket.length; index += 1) {
      const next = bucket[index];
      if (next.x0 - current.x1 < 8) {
        current = {
          x0: current.x0,
          y0: Math.min(current.y0, next.y0),
          x1: Math.max(current.x1, next.x1),
          y1: Math.max(current.y1, next.y1),
          text: `${current.text}${next.text.startsWith(" ") ? "" : " "}${next.text}`.trim(),
        };
      } else {
        lines.push({
          x0: current.x0,
          y0: current.y0,
          x1: current.x1,
          y1: current.y1,
          text: current.text.trim(),
        });
        current = next;
      }
    }

    lines.push({
      x0: current.x0,
      y0: current.y0,
      x1: current.x1,
      y1: current.y1,
      text: current.text.trim(),
    });
  }

  return lines
    .filter((line) => line.text.length > 0)
    .sort((a, b) => (a.y0 === b.y0 ? a.x0 - b.x0 : a.y0 - b.y0));
}
