import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { SceneTocEntry } from "../types";
import { filterScenes, resolveSceneJump } from "../lib/screenplay";

interface SceneTableOfContentsProps {
  entries: SceneTocEntry[];
  onSelect: (momentIndex: number) => void;
  compact?: boolean;
  hideTitle?: boolean;
  activeMomentIndex?: number;
}

function SceneList({
  entries,
  onSelect,
  activeMomentIndex,
  emptyMessage,
}: {
  entries: SceneTocEntry[];
  onSelect: (momentIndex: number) => void;
  activeMomentIndex?: number;
  emptyMessage: string;
}) {
  if (entries.length === 0) {
    return <p className="px-2 py-3 text-sm text-stone-500">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-1">
      {entries.map((entry) => {
        const isActive = activeMomentIndex === entry.momentIndex;

        return (
          <li key={entry.momentId}>
            <button
              type="button"
              className={`group flex w-full gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-stone-100 ${
                isActive ? "bg-stone-100" : ""
              }`}
              onClick={() => onSelect(entry.momentIndex)}
            >
              <span
                className={`w-7 shrink-0 pt-0.5 text-right font-label text-xs tabular-nums ${
                  isActive ? "text-stone-800" : "text-stone-400"
                }`}
              >
                {entry.momentNumber}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`text-toc-title block leading-snug transition-colors group-hover:text-stone-900 ${
                    isActive ? "text-stone-900" : ""
                  }`}
                >
                  {entry.title}
                  {isActive ? (
                    <span className="ml-2 font-label text-[0.65rem] tracking-wide text-stone-500 uppercase">
                      Here
                    </span>
                  ) : null}
                </span>
                {entry.printedPage ? (
                  <span className="mt-0.5 block text-xs text-stone-500">p. {entry.printedPage}</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function SceneTableOfContents({
  entries,
  onSelect,
  compact = false,
  hideTitle = false,
  activeMomentIndex,
}: SceneTableOfContentsProps) {
  return (
    <nav aria-label="Scene list" className={compact ? "mt-10" : ""}>
      {hideTitle ? null : (
        <h2 className="mb-4 text-sm font-bold tracking-[0.2em] text-stone-500 uppercase">Scenes</h2>
      )}
      <div className={compact ? "max-h-[50vh] overflow-y-auto pr-1" : undefined}>
        <SceneList
          entries={entries}
          onSelect={onSelect}
          activeMomentIndex={activeMomentIndex}
          emptyMessage="No scenes found."
        />
      </div>
    </nav>
  );
}

interface SceneTocOverlayProps {
  entries: SceneTocEntry[];
  activeMomentIndex: number;
  onSelect: (momentIndex: number) => void;
  onClose: () => void;
}

export function SceneTocOverlay({
  entries,
  activeMomentIndex,
  onSelect,
  onClose,
}: SceneTocOverlayProps) {
  const [query, setQuery] = useState("");

  const filteredEntries = useMemo(() => filterScenes(entries, query), [entries, query]);

  const emptyMessage = query.trim()
    ? /^\d+$/.test(query.trim())
      ? `No moment ${query.trim()}.`
      : "No matching scenes."
    : "No scenes found.";

  function jumpToMoment(momentIndex: number) {
    onSelect(momentIndex);
    onClose();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const match = resolveSceneJump(entries, query);
    if (match) {
      jumpToMoment(match.momentIndex);
    }
  }

  return (
    <div className="overlay-backdrop absolute inset-0 z-30 flex items-end p-4 md:items-start md:pt-[calc(var(--reader-chrome-height)+1rem)]">
      <div className="overlay-panel flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl md:max-w-lg">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 className="text-sm font-bold tracking-[0.15em] text-stone-500 uppercase">Scenes</h2>
          <button type="button" className="reader-chrome-button text-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="border-b border-stone-200 p-4" onSubmit={handleSubmit}>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Go to moment… 12 or kitchen"
            className="w-full bg-transparent font-reading text-base text-stone-900 outline-none placeholder:text-stone-400"
          />
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          <SceneList
            entries={filteredEntries}
            onSelect={jumpToMoment}
            activeMomentIndex={activeMomentIndex}
            emptyMessage={emptyMessage}
          />
        </div>
      </div>
    </div>
  );
}
