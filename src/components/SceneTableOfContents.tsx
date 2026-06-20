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
      <h2 className="mb-4 text-sm font-bold tracking-[0.2em] text-neutral-500 uppercase">
        Scenes
      </h2>
      <ul className={`space-y-2 ${compact ? "max-h-[50vh] overflow-y-auto pr-1" : ""}`}>
        {entries.map((entry) => (
          <li key={entry.momentId}>
            <button
              type="button"
              className="group w-full text-left"
              onClick={() => onSelect(entry.momentIndex)}
            >
              <span className="text-toc-title block leading-snug transition-colors group-hover:text-white">
                {entry.title}
              </span>
              {entry.printedPage ? (
                <span className="mt-0.5 block text-xs text-neutral-600">p. {entry.printedPage}</span>
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
    <div className="absolute inset-0 z-30 flex items-end bg-black/70 p-4 md:items-start md:pt-16">
      <div className="max-h-[85vh] w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl md:max-w-lg">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2 className="text-sm font-bold tracking-[0.15em] text-neutral-400 uppercase">Scenes</h2>
          <button
            type="button"
            className="text-sm text-neutral-400 hover:text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-3">
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
