import { useLayoutEffect, useRef } from "react";
import type { Moment, ScreenplayData } from "../types";
import { ElementView } from "./ElementView";

interface MomentViewProps {
  moment: Moment;
  data: ScreenplayData;
  scrollY: number;
  scrollToElementId?: string | null;
  onScroll: (scrollY: number) => void;
}

export function MomentView({
  moment,
  data,
  scrollY,
  scrollToElementId,
  onScroll,
}: MomentViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousMomentId = useRef<string | null>(null);
  const elementMap = new Map(data.elements.map((element) => [element.id, element]));

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
    <div className="flex h-full flex-col px-5 pb-10 pt-14 md:px-10 md:pt-16">
      <div
        ref={scrollRef}
        className="moment-scroll mx-auto w-full max-w-prose flex-1 overflow-y-auto overscroll-contain text-left"
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
            />
          );
        })}
      </div>
    </div>
  );
}
