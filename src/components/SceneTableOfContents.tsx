import type { SceneTocEntry } from "../types";

interface SceneTableOfContentsProps {
  entries: SceneTocEntry[];
  onSelect: (momentIndex: number) => void;
  compact?: boolean;
}

export function SceneTableOfContents({
  entries,
  onSelect,
  compact = false,
}: SceneTableOfContentsProps) {
  return (
    <nav aria-label="Scene list" className={compact ? "mt-10" : ""}>
      <h2 className="mb-4 text-sm font-bold tracking-[0.2em] text-stone-500 uppercase">
        Scenes
      </h2>
      <ul className={`space-y-2 ${compact ? "max-h-[50vh] overflow-y-auto pr-1" : ""}`}>
        {entries.map((entry) => (
          <li key={entry.momentId}>
            <button
              type="button"
              className="group w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-stone-100"
              onClick={() => onSelect(entry.momentIndex)}
            >
              <span className="text-toc-title block leading-snug transition-colors group-hover:text-stone-900">
                {entry.title}
              </span>
              {entry.printedPage ? (
                <span className="mt-0.5 block text-xs text-stone-500">p. {entry.printedPage}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface SceneTocOverlayProps {
  entries: SceneTocEntry[];
  onSelect: (momentIndex: number) => void;
  onClose: () => void;
}

export function SceneTocOverlay({ entries, onSelect, onClose }: SceneTocOverlayProps) {
  return (
    <div className="overlay-backdrop absolute inset-0 z-30 flex items-end p-4 md:items-start md:pt-16">
      <div className="overlay-panel max-h-[85vh] w-full overflow-hidden rounded-xl md:max-w-lg">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 className="text-sm font-bold tracking-[0.15em] text-stone-500 uppercase">Scenes</h2>
          <button type="button" className="reader-chrome-button text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-2 py-3">
          <SceneTableOfContents
            entries={entries}
            onSelect={(index) => {
              onSelect(index);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
