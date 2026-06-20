import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import type { Moment, SceneTocEntry, ScreenplayData } from "../types";
import { ElementView } from "./ElementView";

interface MomentViewProps {
  moment: Moment;
  data: ScreenplayData;
  scrollY: number;
  scrollToElementId?: string | null;
  sceneToc?: SceneTocEntry[];
  chromeVisible?: boolean;
  onGoToScene?: (momentIndex: number) => void;
  onScroll: (scrollY: number) => void;
}

export interface MomentViewHandle {
  scrollBy: (delta: number) => void;
}

export const MomentView = forwardRef<MomentViewHandle, MomentViewProps>(function MomentView(
  {
    moment,
    data,
    scrollY,
    scrollToElementId,
    sceneToc,
    chromeVisible = true,
    onGoToScene,
    onScroll,
  },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousMomentId = useRef<string | null>(null);
  const elementMap = new Map(data.elements.map((element) => [element.id, element]));

  useImperativeHandle(ref, () => ({
    scrollBy(delta: number) {
      scrollRef.current?.scrollBy({ top: delta, behavior: "smooth" });
    },
  }));

  useLayoutEffect(() => {
    const node = scrollRef.current;
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
  }, [moment.id, scrollY, scrollToElementId]);

  return (
    <div
      className={`flex h-full min-w-0 flex-col pb-10 transition-[padding] duration-300 ${
        chromeVisible ? "pt-[4.25rem] md:pt-[4.75rem]" : "pt-4 md:pt-6"
      }`}
    >
      <div
        ref={scrollRef}
        className="moment-scroll mx-auto w-full max-w-prose flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 text-left md:px-10"
        onScroll={(event) => onScroll(event.currentTarget.scrollTop)}
      >
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
      </div>
    </div>
  );
});
