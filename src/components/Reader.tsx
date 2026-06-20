import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScreenplayData, SearchResult } from "../types";
import { MomentView } from "./MomentView";
import { loadReaderState, saveReaderState, searchScreenplay } from "../lib/screenplay";

interface ReaderProps {
  data: ScreenplayData;
}

export function Reader({ data }: ReaderProps) {
  const initial = loadReaderState(data);
  const [momentIndex, setMomentIndex] = useState(initial.currentMomentIndex);
  const [scrollY, setScrollY] = useState(initial.scrollY);
  const [scrollToElementId, setScrollToElementId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const scrollSaveTimer = useRef<number | null>(null);

  const moment = data.moments[momentIndex];
  const progress = ((momentIndex + 1) / data.moments.length) * 100;

  const results = useMemo(
    () => (searchOpen ? searchScreenplay(data, query).slice(0, 20) : []),
    [data, query, searchOpen],
  );

  const goToMoment = useCallback((index: number, elementId?: string) => {
    setMomentIndex(index);
    setScrollY(0);
    setScrollToElementId(elementId ?? null);
  }, []);

  const handleScroll = useCallback((nextScrollY: number) => {
    if (scrollSaveTimer.current) {
      window.clearTimeout(scrollSaveTimer.current);
    }
    scrollSaveTimer.current = window.setTimeout(() => {
      setScrollY(nextScrollY);
    }, 150);
  }, []);

  useEffect(() => {
    if (!moment) return;
    saveReaderState({
      screenplayVersion: data.meta.version,
      currentMomentId: moment.id,
      currentMomentIndex: moment.index,
      scrollY,
      lastReadAt: new Date().toISOString(),
    });
  }, [moment, scrollY, data.meta.version]);

  useEffect(() => {
    if (!scrollToElementId) return;
    const timer = window.setTimeout(() => setScrollToElementId(null), 1200);
    return () => window.clearTimeout(timer);
  }, [scrollToElementId, momentIndex]);

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
        goToMoment(Math.min(momentIndex + 1, data.moments.length - 1));
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        goToMoment(Math.max(momentIndex - 1, 0));
      }
      if (event.key === "/") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [data.moments.length, goToMoment, momentIndex, searchOpen]);

  if (!moment) {
    return <div className="flex h-full items-center justify-center">No moments found.</div>;
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
          {momentIndex + 1} / {data.moments.length}
          {moment.printedPage ? ` · p.${moment.printedPage}` : ""}
        </span>
      </header>

      <main className="relative h-full overflow-hidden pt-8 pb-10">
        <MomentView
          moment={moment}
          data={data}
          scrollY={scrollY}
          scrollToElementId={scrollToElementId}
          onScroll={handleScroll}
        />
      </main>

      <button
        type="button"
        aria-label="Previous moment"
        className="absolute inset-y-0 left-0 z-10 w-1/4 cursor-w-resize bg-transparent"
        onClick={() => goToMoment(Math.max(momentIndex - 1, 0))}
      />
      <button
        type="button"
        aria-label="Next moment"
        className="absolute inset-y-0 right-0 z-10 w-1/4 cursor-w-resize bg-transparent"
        onClick={() => goToMoment(Math.min(momentIndex + 1, data.moments.length - 1))}
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
                      goToMoment(result.momentIndex, result.elementId);
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
