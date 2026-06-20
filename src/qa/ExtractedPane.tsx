import type { ScreenplayElement } from "../types";
import { ElementView } from "../components/ElementView";

interface ExtractedPaneProps {
  pdfPage: number;
  elements: ScreenplayElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ExtractedPane({ pdfPage, elements, selectedId, onSelect }: ExtractedPaneProps) {
  const pageElements = elements.filter((element) => element.pdfPage === pdfPage);

  return (
    <div className="qa-pane flex min-h-0 flex-col">
      <h2 className="qa-pane-title">Extracted ({pageElements.length} elements)</h2>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto rounded-lg border border-stone-200 bg-white p-4">
        {pageElements.length === 0 ? (
          <p className="text-sm text-stone-500">No elements tagged for this page.</p>
        ) : (
          pageElements.map((element) => (
            <div
              key={element.id}
              role="button"
              tabIndex={0}
              className={`block w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors ${
                selectedId === element.id
                  ? "border-amber-400 bg-amber-50"
                  : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
              }`}
              onClick={() => onSelect(element.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(element.id);
                }
              }}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-label text-xs font-semibold text-stone-800">{element.id}</span>
                <span className="rounded bg-stone-100 px-1.5 py-0.5 font-label text-[0.65rem] tracking-wide text-stone-600 uppercase">
                  {element.type.replace("_", " ")}
                </span>
              </div>
              <ElementView element={element} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
