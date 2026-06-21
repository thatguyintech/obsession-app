export type InlineEmphasisKind = "bold" | "italic" | "underline";

export interface InlineTextNode {
  type: "text";
  value: string;
}

export interface InlineEmphasisNode {
  type: InlineEmphasisKind;
  children: InlineNode[];
}

export type InlineNode = InlineTextNode | InlineEmphasisNode;

interface OpenMarker {
  kind: InlineEmphasisKind;
  openLength: number;
  findClose: (text: string, from: number) => number;
}

const MARKERS: OpenMarker[] = [
  {
    kind: "bold",
    openLength: 2,
    findClose: (text, from) => {
      const index = text.indexOf("**", from);
      return index === -1 ? -1 : index;
    },
  },
  {
    kind: "underline",
    openLength: 1,
    findClose: (text, from) => text.indexOf("_", from),
  },
  {
    kind: "italic",
    openLength: 1,
    findClose: findClosingSingleAsterisk,
  },
];

function findClosingSingleAsterisk(text: string, from: number): number {
  for (let index = from; index < text.length; index += 1) {
    if (text[index] !== "*") {
      continue;
    }
    if (text[index + 1] === "*") {
      index += 1;
      continue;
    }
    if (text[index - 1] === "*") {
      continue;
    }
    return index;
  }
  return -1;
}

function tryOpenMarker(text: string, index: number): OpenMarker | null {
  for (const marker of MARKERS) {
    if (marker.kind === "bold") {
      if (text.startsWith("**", index)) {
        return marker;
      }
      continue;
    }
    if (marker.kind === "italic") {
      if (text[index] === "*" && text[index + 1] !== "*") {
        return marker;
      }
      continue;
    }
    if (marker.kind === "underline" && text[index] === "_") {
      return marker;
    }
  }
  return null;
}

function findEarliestOpen(text: string, start: number): { index: number; marker: OpenMarker } | null {
  let earliest: { index: number; marker: OpenMarker } | null = null;

  for (let index = start; index < text.length; index += 1) {
    const marker = tryOpenMarker(text, index);
    if (!marker) {
      continue;
    }
    if (!earliest || index < earliest.index) {
      earliest = { index, marker };
    }
    if (index === start) {
      break;
    }
  }

  return earliest;
}

export function parseInlineEmphasis(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const open = findEarliestOpen(text, cursor);
    if (!open) {
      nodes.push({ type: "text", value: text.slice(cursor) });
      break;
    }

    if (open.index > cursor) {
      nodes.push({ type: "text", value: text.slice(cursor, open.index) });
    }

    const contentStart = open.index + open.marker.openLength;
    const closeIndex = open.marker.findClose(text, contentStart);

    if (closeIndex === -1 || closeIndex < contentStart) {
      nodes.push({ type: "text", value: text.slice(open.index, open.index + open.marker.openLength) });
      cursor = open.index + open.marker.openLength;
      continue;
    }

    const inner = text.slice(contentStart, closeIndex);
    nodes.push({
      type: open.marker.kind,
      children: parseInlineEmphasis(inner),
    });
    cursor = closeIndex + open.marker.openLength;
  }

  return nodes;
}

export function flattenInlineEmphasis(text: string): string {
  return flattenInlineNodes(parseInlineEmphasis(text));
}

function flattenInlineNodes(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") {
        return node.value;
      }
      return flattenInlineNodes(node.children);
    })
    .join("");
}

/** Strip READ-001 delimiters for search and QA word compare. */
export function stripInlineEmphasis(text: string): string {
  return flattenInlineEmphasis(text);
}

export function hasInlineEmphasis(text: string): boolean {
  return /\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_/.test(text);
}
