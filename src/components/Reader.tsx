import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScreenplayData, SearchResult } from "../types";
import { MomentView } from "./MomentView";
import { SceneTocOverlay } from "./SceneTableOfContents";
import {
  buildSceneTableOfContents,
  loadReaderState,
  saveReaderState,
  searchScreenplay,
} from "../lib/screenplay";

interface ReaderProps {
  data: ScreenplayData;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export function Reader({ data }: ReaderProps) {
  const initial = loadReaderState(data);
  const [momentIndex, setMomentIndex] = useState(initial.currentMomentIndex);
  const [scrollY, setScrollY] = useState(initial.scrollY);
  const [scrollToElementId, setScrollToElementId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chromeVisible, setChromeVisible] = useState(true);
  const scrollSaveTimer = useRef<number | null>(null);
  const lastScrollY = useRef(0);

  const moment = data.moments[momentIndex];
  const progress = ((momentIndex + 1) / data.moments.length) * 100;
  const sceneToc = useMemo(() => buildSceneTableOfContents(data), [data]);
  const lastMomentIndex = data.moments.length - 1;
  const overlayOpen = searchOpen || tocOpen;

  const results = useMemo(
    () => (searchOpen ? searchScreenplay(data, query).slice(0, 20) : []),
    [data, query, searchOpen],
  );

  const goToMoment = useCallback((index: number, elementId?: string) => {
    setMomentIndex(index);
    setScrollY(0);
    setScrollToElementId(elementId ?? null);
    setChromeVisible(true);
    lastScrollY.current = 0;
  }, []);

  const goToStart = useCallback(() => {
    goToMoment(0);
  }, [goToMoment]);

  const goToEnd = useCallback(() => {
    goToMoment(lastMomentIndex);
  }, [goToMoment, lastMomentIndex]);

  const handleScroll = useCallback((nextScrollY: number) => {
    const delta = nextScrollY - lastScrollY.current;
    if (nextScrollY > 48 && delta > 10) {
      setChromeVisible(false);
    } else if (delta < -10) {
      setChromeVisible(true);
    }
    lastScrollY.current = nextScrollY;

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
      if (isTypingTarget(event.target)) return;

      if (searchOpen || tocOpen) {
        if (event.key === "Escape") {
          setSearchOpen(false);
          setTocOpen(false);
        }
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        goToMoment(Math.min(momentIndex + 1, lastMomentIndex));
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        goToMoment(Math.max(momentIndex - 1, 0));
      }
      if (event.key === "j" || event.key === "J") {
        event.preventDefault();
        goToStart();
      }
      if (event.key === "k" || event.key === "K") {
        event.preventDefault();
        goToEnd();
      }
      if (event.key === "Home") {
        event.preventDefault();
        goToStart();
      }
      if (event.key === "End") {
        event.preventDefault();
        goToEnd();
      }
      if (event.key === "/") {
        event.preventDefault();
        setSearchOpen(true);
        setChromeVisible(true);
      }
      if (event.key === "t" || event.key === "T") {
        event.preventDefault();
        setTocOpen(true);
        setChromeVisible(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToEnd, goToMoment, goToStart, lastMomentIndex, momentIndex, searchOpen, tocOpen]);

  if (!moment) {
    return <div className="flex h-full items-center justify-center text-stone-500">No moments found.</div>;
  }

  const showChrome = overlayOpen || chromeVisible;

  return (
    <div className="relative h-full min-w-0 overflow-hidden bg-[var(--bg-page)]">
      <div
        className={`reader-chrome-shell ${showChrome ? "is-visible" : "is-hidden"}`}
        aria-hidden={!showChrome}
      >
        <div className="reader-chrome-bar">
          <div className="progress-track">
            <div
              className="progress-fill h-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>

          <header className="reader-chrome flex min-w-0 items-center justify-between gap-2 px-4 py-2.5 text-xs">
            <div className="flex min-w-0 shrink items-center gap-1">
              <button type="button" className="reader-chrome-button" onClick={() => setSearchOpen(true)}>
                Search /
              </button>
              <button type="button" className="reader-chrome-button" onClick={() => setTocOpen(true)}>
                Scenes T
              </button>
            </div>
            <span className="shrink-0 text-right text-stone-600">
              {momentIndex + 1} / {data.moments.length}
              {moment.printedPage ? ` · p.${moment.printedPage}` : ""}
            </span>
          </header>
        </div>
      </div>

      <main className="relative h-full min-w-0 overflow-hidden pb-10">
        <MomentView
          moment={moment}
          data={data}
          scrollY={scrollY}
          scrollToElementId={scrollToElementId}
          sceneToc={sceneToc}
          chromeVisible={showChrome}
          onGoToScene={goToMoment}
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
        onClick={() => goToMoment(Math.min(momentIndex + 1, lastMomentIndex))}
      />
      <button
        type="button"
        aria-label="Toggle controls"
        className="absolute inset-y-0 left-1/4 z-10 w-1/2 cursor-default bg-transparent"
        onClick={() => setChromeVisible((visible) => !visible)}
      />

      {searchOpen ? (
        <div className="overlay-backdrop absolute inset-0 z-30 flex items-end p-4 md:items-start md:pt-16">
          <div className="overlay-panel max-h-[80vh] w-full overflow-hidden rounded-xl">
            <div className="border-b border-stone-200 p-4">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search screenplay..."
                className="w-full bg-transparent font-reading text-base text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {results.length === 0 ? (
                <p className="p-4 text-sm text-stone-500">
                  {query ? "No matches." : "Type to search dialogue, action, and scene headings."}
                </p>
              ) : (
                results.map((result: SearchResult) => (
                  <button
                    key={result.elementId}
                    type="button"
                    className="block w-full border-b border-stone-100 px-4 py-3 text-left hover:bg-stone-50"
                    onClick={() => {
                      goToMoment(result.momentIndex, result.elementId);
                      setSearchOpen(false);
                      setQuery("");
                    }}
                  >
                    <p className="font-label text-xs tracking-wide text-stone-500 uppercase">
                      {result.type.replace("_", " ")}
                      {result.printedPage ? ` · p.${result.printedPage}` : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 font-reading text-sm text-stone-800">{result.snippet}</p>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-stone-200 p-3 text-right">
              <button
                type="button"
                className="reader-chrome-button text-sm"
                onClick={() => setSearchOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tocOpen ? (
        <SceneTocOverlay
          entries={sceneToc}
          onSelect={goToMoment}
          onClose={() => setTocOpen(false)}
        />
      ) : null}
    </div>
  );
}
