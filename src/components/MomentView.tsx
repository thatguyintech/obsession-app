import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import type { Moment, SceneTocEntry, ScreenplayData } from "../types";
import { getMomentLabel } from "../lib/screenplay";
import { ElementView } from "./ElementView";

interface MomentViewProps {
  moment: Moment;
  data: ScreenplayData;
  scrollRootRef: RefObject<HTMLElement | null>;
  scrollY: number;
  scrollToElementId?: string | null;
  sceneToc?: SceneTocEntry[];
  onGoToScene?: (momentIndex: number) => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function MomentView({
  moment,
  data,
  scrollRootRef,
  scrollY,
  scrollToElementId,
  sceneToc,
  onGoToScene,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
}: MomentViewProps) {
  const previousMomentId = useRef<string | null>(null);
  const elementMap = new Map(data.elements.map((element) => [element.id, element]));

  useLayoutEffect(() => {
    const node = scrollRootRef.current;
    if (!node) return;

    if (scrollToElementId) {
      const target = node.querySelector(`[data-element-id="${scrollToElementId}"]`);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    if (previousMomentId.current !== moment.id) {
      node.scrollTop = scrollY;
      previousMomentId.current = moment.id;
    }
  }, [moment.id, scrollRootRef, scrollY, scrollToElementId]);

  const momentLabel = getMomentLabel(moment.id);

  return (
    <div className="reader-column mx-auto w-full max-w-none px-4 pb-16 pt-6 text-left sm:max-w-prose md:px-10 md:pt-8">
      {momentLabel ? (
        <header className="moment-scene-label mb-5">
          <p className="font-label text-[0.65rem] tracking-wide text-stone-400 uppercase">
            Scene {moment.index}
            {moment.printedPage ? ` · p.${moment.printedPage}` : ""}
          </p>
          <h2 className="mt-1.5 font-reading text-[1.125rem] leading-snug text-stone-800">
            {momentLabel}
          </h2>
        </header>
      ) : null}
      {moment.elementIds.map((elementId) => {
        const element = elementMap.get(elementId);
        if (!element) return null;
        return (
          <ElementView
            key={element.id}
            element={element}
            sceneHeadingId={moment.sceneHeadingId}
            highlight={scrollToElementId === element.id}
            sceneToc={element.type === "title_card" ? sceneToc : undefined}
            onGoToScene={element.type === "title_card" ? onGoToScene : undefined}
          />
        );
      })}
      <nav className="reader-moment-nav" aria-label="Scene navigation">
        <button
          type="button"
          className="reader-moment-nav-button"
          aria-label="Previous scene"
          disabled={!canGoPrevious}
          onClick={onPrevious}
        >
          ←
        </button>
        <button
          type="button"
          className="reader-moment-nav-button"
          aria-label="Next scene"
          disabled={!canGoNext}
          onClick={onNext}
        >
          →
        </button>
      </nav>
    </div>
  );
}
