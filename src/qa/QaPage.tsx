import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import {
  analyzeAllPages,
  analyzeQaPage,
  extractElementText,
  formatWordList,
  reviewPageNumbers,
  type QaPageReport,
  type QaRawPage,
} from "../../lib/qa-compare";
import { buildSuspectedGaps, filterActiveGaps, type QaSuspectedGap } from "../../lib/qa-gaps";
import { mapWordsToLines, rectsForMissingWords } from "../../lib/qa-missing-words";
import { resolveElementHighlight } from "../../lib/qa-provenance";
import {
  createEmptyElement,
  findElementInsertIndex,
  nextElementId,
  type QaEditableElementType,
} from "../../lib/qa-element-transform";
import type { ScreenplayData, ScreenplayElement } from "../types";
import { dismissGap, getDismissedGapIds } from "./qa-dismissals";
import { ElementEditor } from "./ElementEditor";
import { ExtractedPane } from "./ExtractedPane";
import { PdfPane } from "./PdfPane";

interface QaSearch {
  page?: number;
}

interface RawPayload {
  pages: QaRawPage[];
}

function statusClass(status: QaPageReport["status"]): string {
  switch (status) {
    case "OK":
      return "bg-emerald-100 text-emerald-800";
    case "WARN":
      return "bg-amber-100 text-amber-900";
    case "FAIL":
      return "bg-red-100 text-red-800";
    default:
      return "bg-stone-100 text-stone-600";
  }
}

function clampPage(page: number, maxPage: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(maxPage, Math.max(1, Math.round(page)));
}

function cloneData(data: ScreenplayData): ScreenplayData {
  return structuredClone(data);
}

function getPairedTransition(
  elementId: string,
  elements: ScreenplayElement[],
): ScreenplayElement | null {
  const index = elements.findIndex((element) => element.id === elementId);
  if (index <= 0) return null;
  const current = elements[index];
  const previous = elements[index - 1];
  if (current?.type === "scene_heading" && previous?.type === "transition") {
    return previous;
  }
  return null;
}

export function QaPage() {
  const search = useSearch({ strict: false }) as QaSearch;
  const baselineRef = useRef<ScreenplayData | null>(null);
  const [data, setData] = useState<ScreenplayData | null>(null);
  const [rawPages, setRawPages] = useState<QaRawPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPageState] = useState(() => clampPage(search.page ?? 1, 99));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusGapId, setFocusGapId] = useState<string | null>(null);
  const [dismissedRevision, setDismissedRevision] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [screenplayResponse, rawResponse] = await Promise.all([
          fetch("/data/obsession.json"),
          fetch("/__qa/raw.json"),
        ]);

        if (!screenplayResponse.ok) {
          throw new Error("Failed to load obsession.json");
        }
        if (!rawResponse.ok) {
          throw new Error("Failed to load raw.json — run pnpm extract");
        }

        const screenplay = (await screenplayResponse.json()) as ScreenplayData;
        const raw = (await rawResponse.json()) as RawPayload;
        baselineRef.current = cloneData(screenplay);
        setData(screenplay);
        setRawPages(raw.pages);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to load QA data");
      }
    }

    void load();
  }, []);

  const maxPage = data?.meta.pageCount ?? 99;

  useEffect(() => {
    if (search.page) {
      setPageState(clampPage(search.page, maxPage));
    }
  }, [search.page, maxPage]);

  const reports = useMemo(
    () => (rawPages && data ? analyzeAllPages(rawPages, data.elements) : []),
    [rawPages, data],
  );

  const reviewPages = useMemo(() => reviewPageNumbers(reports), [reports]);
  const currentRawPage = rawPages?.find((rawPage) => rawPage.pdfPage === page);

  const currentReport = useMemo(() => {
    if (!data || !currentRawPage) return undefined;
    return analyzeQaPage(currentRawPage, data.elements);
  }, [currentRawPage, data]);

  const selectedElement = selectedId
    ? data?.elements.find((element) => element.id === selectedId) ?? null
    : null;

  const elementHighlight = useMemo(() => {
    if (!selectedElement || !currentRawPage || !data) {
      return { lineIndices: [] as number[], rects: [] };
    }
    const pageElements = data.elements.filter((element) => element.pdfPage === page);
    return resolveElementHighlight(selectedElement, currentRawPage, pageElements);
  }, [selectedElement, currentRawPage, data, page]);

  const pageElementText = useMemo(() => {
    if (!data) {
      return "";
    }
    return data.elements
      .filter((element) => element.pdfPage === page)
      .map(extractElementText)
      .filter(Boolean)
      .join(" ");
  }, [data, page]);

  const suspectedGaps = useMemo(() => {
    if (!currentReport) {
      return [];
    }
    return buildSuspectedGaps(page, currentReport.missingWords, pageElementText);
  }, [currentReport, page, pageElementText]);

  const dismissedGapIds = useMemo(() => {
    void dismissedRevision;
    return getDismissedGapIds(page);
  }, [page, dismissedRevision]);

  const activeGaps = useMemo(
    () => filterActiveGaps(suspectedGaps, dismissedGapIds),
    [suspectedGaps, dismissedGapIds],
  );

  const gapHighlightRects = useMemo(() => {
    if (!currentRawPage || activeGaps.length === 0) {
      return [];
    }

    const focusedGap = focusGapId
      ? activeGaps.find((gap) => gap.id === focusGapId)
      : activeGaps[0];

    if (!focusedGap) {
      return [];
    }

    const hits = mapWordsToLines(currentRawPage, focusedGap.highlightWords);
    return rectsForMissingWords(hits);
  }, [activeGaps, currentRawPage, focusGapId]);

  useEffect(() => {
    setFocusGapId(null);
  }, [page]);

  useEffect(() => {
    if (activeGaps.length === 0) {
      setFocusGapId(null);
      return;
    }
    if (!focusGapId || !activeGaps.some((gap) => gap.id === focusGapId)) {
      setFocusGapId(activeGaps[0]!.id);
    }
  }, [activeGaps, focusGapId]);

  function handleDismissGap(gap: QaSuspectedGap) {
    dismissGap(page, gap.id);
    setDismissedRevision((value) => value + 1);
  }

  function setPage(nextPage: number) {
    setPageState(clampPage(nextPage, maxPage));
    setSelectedId(null);
  }

  function requestPageChange(nextPage: number) {
    if (isDirty && !window.confirm("You have unsaved changes. Leave this page anyway?")) {
      return;
    }
    setPage(nextPage);
  }

  function updateElement(nextElement: ScreenplayElement) {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        elements: current.elements.map((element) =>
          element.id === nextElement.id ? nextElement : element,
        ),
      };
    });
    setSaveMessage(null);
  }

  useEffect(() => {
    if (!data || !baselineRef.current) return;
    setIsDirty(JSON.stringify(data) !== JSON.stringify(baselineRef.current));
  }, [data]);

  function updatePairedTransition(sceneHeadingId: string, transitionText: string) {
    setData((current) => {
      if (!current) return current;
      const elements = [...current.elements];
      const index = elements.findIndex((element) => element.id === sceneHeadingId);
      if (index === -1) return current;

      const sceneHeading = elements[index]!;
      const previous = index > 0 ? elements[index - 1] : null;
      const trimmed = transitionText.trim();

      if (!trimmed) {
        if (previous?.type === "transition") {
          elements.splice(index - 1, 1);
        }
        return { ...current, elements };
      }

      if (previous?.type === "transition") {
        elements[index - 1] = { ...previous, text: trimmed };
        return { ...current, elements };
      }

      const newId = nextElementId(elements);
      elements.splice(index, 0, {
        id: newId,
        type: "transition",
        text: trimmed,
        pdfPage: sceneHeading.pdfPage,
        printedPage: sceneHeading.printedPage,
      });
      return { ...current, elements };
    });
    setSaveMessage(null);
  }

  function revertElement(elementId: string) {
    const original = baselineRef.current?.elements.find((element) => element.id === elementId);
    if (!original) return;

    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        elements: current.elements.map((element) =>
          element.id === elementId ? structuredClone(original) : element,
        ),
      };
    });
    setSaveMessage(null);
  }

  function deleteElement(elementId: string) {
    const element = data?.elements.find((item) => item.id === elementId);
    if (!element) return;

    const typeLabel = element.type.replace("_", " ");
    const confirmed = window.confirm(
      `Delete ${elementId} (${typeLabel})?\n\nThe element will be removed when you Save. Copy any text you need into another element first.`,
    );
    if (!confirmed) return;

    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        elements: current.elements.filter((item) => item.id !== elementId),
      };
    });
    setSelectedId(null);
    setSaveMessage(null);
  }

  function addElement(type: QaEditableElementType) {
    if (!data) return;

    const newId = nextElementId(data.elements);
    const printedPage = data.elements.find((element) => element.pdfPage === page)?.printedPage;

    setData((current) => {
      if (!current) return current;

      const newElement = createEmptyElement(type, newId, page, printedPage) as ScreenplayElement;
      const insertIndex = findElementInsertIndex(current.elements, page, selectedId);
      const elements = [...current.elements];
      elements.splice(insertIndex, 0, newElement);

      return { ...current, elements };
    });
    setSelectedId(newId);
    setSaveMessage(null);
  }

  async function handleSave() {
    if (!data || saving) return;

    setSaving(true);
    setSaveMessage(null);
    setError(null);

    try {
      const response = await fetch("/__qa/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = (await response.json()) as {
        ok: boolean;
        data?: ScreenplayData;
        error?: string;
        validateOutput?: string;
      };

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.error ?? result.validateOutput ?? "Save failed");
      }

      baselineRef.current = cloneData(result.data);
      setData(result.data);
      setIsDirty(false);
      setSaveMessage(`Saved · version ${result.data.meta.version} · validate OK`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function goToReview(direction: -1 | 1) {
    if (reviewPages.length === 0) return;

    const currentIndex = reviewPages.indexOf(page);
    const nextIndex =
      currentIndex === -1
        ? direction === 1
          ? 0
          : reviewPages.length - 1
        : (currentIndex + direction + reviewPages.length) % reviewPages.length;

    requestPageChange(reviewPages[nextIndex]!);
  }

  if (error && !data) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-red-700">
        {error}
      </div>
    );
  }

  if (!data || !rawPages) {
    return (
      <div className="flex h-full items-center justify-center text-stone-500">
        Loading QA data…
      </div>
    );
  }

  const pct = currentReport ? Math.round(currentReport.score * 100) : 0;

  return (
    <div className="qa-shell flex h-full min-h-0 flex-col bg-stone-100">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-stone-200 bg-white px-4 py-3">
        <div>
          <p className="font-label text-xs tracking-wide text-stone-500 uppercase">Dev QA</p>
          <h1 className="text-sm font-semibold text-stone-900">PDF vs extracted JSON</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="reader-chrome-button"
            onClick={() => requestPageChange(page - 1)}
            disabled={page <= 1}
          >
            ◀
          </button>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            Page
            <input
              type="number"
              min={1}
              max={maxPage}
              value={page}
              onChange={(event) => requestPageChange(Number(event.target.value))}
              className="w-16 rounded border border-stone-300 px-2 py-1"
            />
            <span>/ {maxPage}</span>
          </label>
          <button
            type="button"
            className="reader-chrome-button"
            onClick={() => requestPageChange(page + 1)}
            disabled={page >= maxPage}
          >
            ▶
          </button>
        </div>

        {currentReport ? (
          <span className={`rounded px-2 py-1 font-label text-xs font-semibold ${statusClass(currentReport.status)}`}>
            {currentReport.status}
            {currentReport.status === "SKIP"
              ? ""
              : ` ${pct}% (${currentReport.matchedWords}/${currentReport.totalRawWords})`}
          </span>
        ) : null}

        {isDirty ? (
          <span className="rounded bg-orange-100 px-2 py-1 font-label text-xs font-semibold text-orange-900">
            Unsaved
          </span>
        ) : null}

        <button
          type="button"
          className="reader-chrome-button text-sm font-semibold text-stone-900 disabled:opacity-40"
          onClick={() => void handleSave()}
          disabled={!isDirty || saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>

        <div className="flex items-center gap-2">
          <button type="button" className="reader-chrome-button text-sm" onClick={() => goToReview(-1)}>
            Prev review
          </button>
          <button type="button" className="reader-chrome-button text-sm" onClick={() => goToReview(1)}>
            Next review
          </button>
          <span className="text-xs text-stone-500">{reviewPages.length} pages flagged</span>
        </div>

        <Link to="/" className="ml-auto reader-chrome-button text-sm">
          ← Reader
        </Link>
      </header>

      {saveMessage ? (
        <div className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          {saveMessage}
        </div>
      ) : null}

      {error ? (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {activeGaps.length > 0 ? (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              Suspected gaps — {activeGaps.length} on this page
            </span>
            <span className="text-amber-800">
              ({currentReport?.matchedWords}/{currentReport?.totalRawWords} words matched after
              normalization)
            </span>
          </div>
          <ul className="space-y-2">
            {activeGaps.map((gap) => (
              <li
                key={gap.id}
                className={`flex flex-wrap items-start gap-2 rounded border px-2 py-1.5 ${
                  focusGapId === gap.id
                    ? "border-amber-500 bg-amber-100"
                    : "border-amber-200 bg-white"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-amber-950">{gap.label}</p>
                  <p className="text-xs text-amber-800">{gap.reason}</p>
                </div>
                <button
                  type="button"
                  className="reader-chrome-button text-xs"
                  onClick={() => setFocusGapId(gap.id)}
                >
                  Show on PDF
                </button>
                <button
                  type="button"
                  className="reader-chrome-button text-xs text-stone-700"
                  onClick={() => handleDismissGap(gap)}
                >
                  Looks fine
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-800">
            We normalize hyphen/split-word artifacts before scoring. Dismiss anything you’ve verified
            — stored in this browser only.
          </p>
        </div>
      ) : null}

      {suspectedGaps.length > 0 && activeGaps.length === 0 ? (
        <div className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          All suspected gaps dismissed for this page — treat as reviewed.
        </div>
      ) : null}

      {currentReport && (currentReport.status === "WARN" || currentReport.status === "FAIL") ? (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          {currentReport.addedWords.length > 0 ? (
            <p>
              <span className="font-semibold">Extra:</span> {formatWordList(currentReport.addedWords)}
            </p>
          ) : null}
          {currentReport.note ? <p className="text-amber-800">{currentReport.note}</p> : null}
        </div>
      ) : null}

      <div className="qa-grid min-h-0 flex-1 gap-3 p-3">
        <PdfPane
          pdfPage={page}
          highlightRects={elementHighlight.rects}
          missingHighlightRects={gapHighlightRects}
        />
        <ExtractedPane
          pdfPage={page}
          elements={data.elements}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAddElement={addElement}
        />
      </div>

      {selectedElement ? (
        <ElementEditor
          element={selectedElement}
          pairedTransition={
            selectedElement.type === "scene_heading" && data
              ? getPairedTransition(selectedElement.id, data.elements)
              : null
          }
          onPairedTransitionChange={
            selectedElement.type === "scene_heading"
              ? (text) => updatePairedTransition(selectedElement.id, text)
              : undefined
          }
          onChange={updateElement}
          onRevert={() => revertElement(selectedElement.id)}
          onDelete={() => deleteElement(selectedElement.id)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
