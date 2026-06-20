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
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [query, setQuery] = useState("");
  const scrollSaveTimer = useRef<number | null>(null);
  const scrollRef = useRef<HTMLElement>(null);

  const moment = data.moments[momentIndex];
  const lastMomentIndex = data.moments.length - 1;
  const progress = lastMomentIndex > 0 ? (momentIndex / lastMomentIndex) * 100 : 0;
  const sceneToc = useMemo(() => buildSceneTableOfContents(data), [data]);

  const results = useMemo(
    () => (searchOpen ? searchScreenplay(data, query).slice(0, 20) : []),
    [data, query, searchOpen],
  );

  const goToMoment = useCallback((index: number, elementId?: string) => {
    setMomentIndex(index);
    setScrollY(0);
    setScrollToElementId(elementId ?? null);
  }, []);

  const goToStart = useCallback(() => {
    goToMoment(0);
  }, [goToMoment]);

  const restart = useCallback(() => {
    setMomentIndex(0);
    setScrollY(0);
    setScrollToElementId(null);
    setRestartConfirmOpen(false);
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const requestRestart = useCallback(() => {
    if (momentIndex === 0) {
      restart();
      return;
    }
    setRestartConfirmOpen(true);
  }, [momentIndex, restart]);

  const goToEnd = useCallback(() => {
    goToMoment(lastMomentIndex);
  }, [goToMoment, lastMomentIndex]);

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
      if (isTypingTarget(event.target)) return;

      if (searchOpen || tocOpen || restartConfirmOpen) {
        if (event.key === "Escape") {
          setSearchOpen(false);
          setTocOpen(false);
          setRestartConfirmOpen(false);
        }
        if (restartConfirmOpen && event.key === "Enter") {
          event.preventDefault();
          restart();
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToMoment(Math.min(momentIndex + 1, lastMomentIndex));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToMoment(Math.max(momentIndex - 1, 0));
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        scrollRef.current?.scrollBy({ top: Math.round(window.innerHeight * 0.65), behavior: "smooth" });
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        scrollRef.current?.scrollBy({ top: -Math.round(window.innerHeight * 0.65), behavior: "smooth" });
      }
      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        requestRestart();
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
      }
      if (event.key === "t" || event.key === "T") {
        event.preventDefault();
        setTocOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToEnd, goToMoment, goToStart, lastMomentIndex, momentIndex, requestRestart, restart, restartConfirmOpen, searchOpen, tocOpen]);

  if (!moment) {
    return <div className="flex h-full items-center justify-center text-stone-500">No moments found.</div>;
  }

  return (
    <div className="relative h-full min-w-0 overflow-hidden bg-[var(--bg-page)]">
      <div className="reader-chrome-shell">
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
                Search ( / )
              </button>
              <button type="button" className="reader-chrome-button" onClick={() => setTocOpen(true)}>
                Scenes (T)
              </button>
              <button type="button" className="reader-chrome-button" onClick={requestRestart}>
                Restart (R)
              </button>
            </div>
            <span className="shrink-0 text-right text-stone-600">
              {momentIndex} / {lastMomentIndex}
              {moment.printedPage ? ` · p.${moment.printedPage}` : ""}
            </span>
          </header>
        </div>
      </div>

      <main
        ref={scrollRef}
        className="reader-main"
        onScroll={(event) => handleScroll(event.currentTarget.scrollTop)}
      >
        <MomentView
          moment={moment}
          data={data}
          scrollRootRef={scrollRef}
          scrollY={scrollY}
          scrollToElementId={scrollToElementId}
          sceneToc={sceneToc}
          onGoToScene={goToMoment}
        />
      </main>

      <button
        type="button"
        aria-label="Previous moment"
        className="absolute bottom-0 left-0 top-[var(--reader-chrome-height)] z-10 w-14 bg-transparent md:w-16"
        onClick={() => goToMoment(Math.max(momentIndex - 1, 0))}
      />
      <button
        type="button"
        aria-label="Next moment"
        className="absolute bottom-0 right-0 top-[var(--reader-chrome-height)] z-10 w-14 bg-transparent md:w-16"
        onClick={() => goToMoment(Math.min(momentIndex + 1, lastMomentIndex))}
      />

      {restartConfirmOpen ? (
        <div className="overlay-backdrop absolute inset-0 z-30 flex items-center justify-center p-4">
          <div className="overlay-panel w-full max-w-sm rounded-xl p-5">
            <p className="font-label text-xs tracking-wide text-stone-500 uppercase">Restart?</p>
            <p className="mt-2 font-reading text-sm leading-relaxed text-stone-800">
              Go back to the very beginning? You&apos;re on {momentIndex} of {lastMomentIndex}
              {moment.printedPage ? ` (p.${moment.printedPage})` : ""}.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="reader-chrome-button text-sm"
                onClick={() => setRestartConfirmOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="reader-chrome-button text-sm text-stone-900" onClick={restart}>
                Restart
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {searchOpen ? (
        <div className="overlay-backdrop absolute inset-0 z-30 flex items-end p-4 md:items-start md:pt-[calc(var(--reader-chrome-height)+1rem)]">
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
          activeMomentIndex={momentIndex}
          onSelect={goToMoment}
          onClose={() => setTocOpen(false)}
        />
      ) : null}
    </div>
  );
}
