import { useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  QA_PDF_EXTRACT_SCALE,
  QA_PDF_RENDER_SCALE,
  type QaLineBBox,
} from "../../lib/qa-element-lines";

GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfPaneProps {
  pdfPage: number;
  highlightRects?: QaLineBBox[];
  missingHighlightRects?: QaLineBBox[];
}

function PdfHighlightOverlay({
  rects,
  canvasWidth,
  canvasHeight,
  variant,
}: {
  rects: QaLineBBox[];
  canvasWidth: number;
  canvasHeight: number;
  variant: "element" | "missing";
}) {
  const pdfScale = QA_PDF_RENDER_SCALE / QA_PDF_EXTRACT_SCALE;

  return (
    <>
      {rects.map((rect, index) => (
        <div
          key={`${variant}-${index}`}
          className={variant === "missing" ? "qa-pdf-highlight-missing" : "qa-pdf-highlight"}
          style={{
            left: `${((rect.x0 * pdfScale) / canvasWidth) * 100}%`,
            top: `${((rect.y0 * pdfScale) / canvasHeight) * 100}%`,
            width: `${(((rect.x1 - rect.x0) * pdfScale) / canvasWidth) * 100}%`,
            height: `${(((rect.y1 - rect.y0) * pdfScale) / canvasHeight) * 100}%`,
          }}
        />
      ))}
    </>
  );
}

export function PdfPane({
  pdfPage,
  highlightRects = [],
  missingHighlightRects = [],
}: PdfPaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<Awaited<ReturnType<typeof getDocument>["promise"]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);

      try {
        if (!pdfRef.current) {
          const response = await fetch("/__qa/source.pdf");
          if (!response.ok) {
            throw new Error("PDF not found — place obsession-2026.pdf in repo root");
          }
          const bytes = await response.arrayBuffer();
          pdfRef.current = await getDocument({ data: bytes }).promise;
        }

        if (cancelled) return;

        const page = await pdfRef.current.getPage(pdfPage);
        const viewport = page.getViewport({ scale: QA_PDF_RENDER_SCALE });
        const canvas = canvasRef.current;
        if (!canvas) {
          throw new Error("PDF canvas not ready");
        }

        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Could not get canvas context");
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        setCanvasSize({ width: viewport.width, height: viewport.height });

        await page.render({ canvasContext: context, viewport }).promise;
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to render PDF");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
    };
  }, [pdfPage]);

  return (
    <div className="qa-pane flex min-h-0 flex-col">
      <h2 className="qa-pane-title">PDF page {pdfPage}</h2>
      <div className="relative min-h-0 flex-1 overflow-auto rounded-lg border border-stone-200 bg-white p-2">
        <div className="relative mx-auto w-fit">
          <canvas
            ref={canvasRef}
            className={`block max-w-full transition-opacity ${loading ? "opacity-20" : "opacity-100"}`}
          />
          {!loading && !error && canvasSize.width > 0 ? (
            <div className="pointer-events-none absolute inset-0">
              {missingHighlightRects.length > 0 ? (
                <PdfHighlightOverlay
                  rects={missingHighlightRects}
                  canvasWidth={canvasSize.width}
                  canvasHeight={canvasSize.height}
                  variant="missing"
                />
              ) : null}
              {highlightRects.length > 0 ? (
                <PdfHighlightOverlay
                  rects={highlightRects}
                  canvasWidth={canvasSize.width}
                  canvasHeight={canvasSize.height}
                  variant="element"
                />
              ) : null}
            </div>
          ) : null}
        </div>
        {loading && !error ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-stone-500">
            Rendering PDF…
          </p>
        ) : null}
        {error ? (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
