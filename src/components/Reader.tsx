import { useEffect, useMemo, useState } from "react";
import type { Beat, ScreenplayData, SearchResult } from "../types";
import { BeatView } from "./BeatView";
import { loadReaderState, saveReaderState, searchScreenplay } from "../lib/screenplay";

interface ReaderProps {
  data: ScreenplayData;
}

export function Reader({ data }: ReaderProps) {
  const [beatIndex, setBeatIndex] = useState(() => loadReaderState(data).currentBeatIndex);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const beat = data.beats[beatIndex] as Beat | undefined;
  const progress = ((beatIndex + 1) / data.beats.length) * 100;

  const results = useMemo(
    () => (searchOpen ? searchScreenplay(data, query).slice(0, 20) : []),
    [data, query, searchOpen],
  );

  useEffect(() => {
    if (!beat) return;
    saveReaderState({
      screenplayVersion: data.meta.version,
      currentBeatId: beat.id,
      currentBeatIndex: beat.index,
      lastReadAt: new Date().toISOString(),
    });
  }, [beat, data.meta.version]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (searchOpen) {
        if (event.key === "Escape") {
          setSearchOpen(false);
        }
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        setBeatIndex((current: number) => Math.min(current + 1, data.beats.length - 1));
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        setBeatIndex((current: number) => Math.max(current - 1, 0));
      }
      if (event.key === "/") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [data.beats.length, searchOpen]);

  if (!beat) {
    return <div className="flex h-full items-center justify-center">No beats found.</div>;
  }

  return (
    <div className="relative h-full overflow-hidden bg-neutral-950">
      <div className="absolute inset-x-0 top-0 z-20 h-1 bg-neutral-800">
        <div className="h-full bg-white transition-all duration-200" style={{ width: `${progress}%` }} />
      </div>

      <header className="absolute inset-x-0 top-3 z-20 flex items-center justify-between px-4 text-xs text-neutral-500">
        <button
          type="button"
          className="rounded px-2 py-1 hover:bg-neutral-900 hover:text-neutral-300"
          onClick={() => setSearchOpen(true)}
        >
          Search /
        </button>
        <span>
          {beatIndex + 1} / {data.beats.length}
          {beat.printedPage ? ` · p.${beat.printedPage}` : ""}
        </span>
      </header>

      <main className="relative h-full pt-8 pb-10">
        <BeatView beat={beat} />
      </main>

      <button
        type="button"
        aria-label="Previous beat"
        className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-w-resize bg-transparent"
        onClick={() => setBeatIndex((current: number) => Math.max(current - 1, 0))}
      />
      <button
        type="button"
        aria-label="Next beat"
        className="absolute inset-y-0 right-0 z-10 w-1/3 cursor-e-resize bg-transparent"
        onClick={() => setBeatIndex((current: number) => Math.min(current + 1, data.beats.length - 1))}
      />

      {searchOpen ? (
        <div className="absolute inset-0 z-30 flex items-end bg-black/70 p-4 md:items-start md:pt-16">
          <div className="max-h-[80vh] w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl">
            <div className="border-b border-neutral-800 p-4">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search screenplay..."
                className="w-full bg-transparent text-base outline-none placeholder:text-neutral-600"
              />
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {results.length === 0 ? (
                <p className="p-4 text-sm text-neutral-500">
                  {query ? "No matches." : "Type to search dialogue, action, and scene headings."}
                </p>
              ) : (
                results.map((result: SearchResult) => (
                  <button
                    key={result.elementId}
                    type="button"
                    className="block w-full border-b border-neutral-900 px-4 py-3 text-left hover:bg-neutral-900"
                    onClick={() => {
                      setBeatIndex(result.beatIndex);
                      setSearchOpen(false);
                      setQuery("");
                    }}
                  >
                    <p className="text-xs tracking-wide text-neutral-500 uppercase">
                      {result.type.replace("_", " ")}
                      {result.printedPage ? ` · p.${result.printedPage}` : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-200">{result.snippet}</p>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-neutral-800 p-3 text-right">
              <button
                type="button"
                className="text-sm text-neutral-400 hover:text-white"
                onClick={() => setSearchOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
