import { useEffect, useRef } from "react";
import type { QaRawPage } from "../../lib/qa-compare";
import { PAGE_HEADER_RE } from "../../lib/qa-compare";

interface RawPaneProps {
  page: QaRawPage | undefined;
  highlightedIndices?: number[];
}

export function RawPane({ page, highlightedIndices = [] }: RawPaneProps) {
  const lines = page?.lines ?? [];
  const highlightSet = new Set(highlightedIndices);
  const firstHighlightRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (highlightedIndices.length > 0) {
      firstHighlightRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [highlightedIndices, page?.pdfPage]);

  return (
    <div className="qa-pane flex min-h-0 flex-col">
      <h2 className="qa-pane-title">Raw lines ({lines.length})</h2>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-stone-200 bg-stone-950 p-3 font-mono text-xs leading-relaxed text-stone-100">
        {lines.length === 0 ? (
          <p className="text-stone-400">No raw text on this page.</p>
        ) : (
          <ol className="space-y-1">
            {lines.map((line, index) => {
              const trimmed = line.text.trim();
              const isHeader = PAGE_HEADER_RE.test(trimmed);
              const isHighlighted = highlightSet.has(index);
              const isFirstHighlight =
                isHighlighted && index === highlightedIndices[0];

              return (
                <li
                  key={`${index}-${trimmed.slice(0, 24)}`}
                  ref={isFirstHighlight ? firstHighlightRef : undefined}
                  className={
                    isHeader
                      ? "text-stone-500 line-through"
                      : isHighlighted
                        ? "qa-raw-highlight -mx-1 rounded px-1"
                        : undefined
                  }
                >
                  {trimmed || "(empty)"}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
