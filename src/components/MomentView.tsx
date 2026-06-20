import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import type { Moment, SceneTocEntry, ScreenplayData } from "../types";
import { ElementView } from "./ElementView";

interface MomentViewProps {
  moment: Moment;
  data: ScreenplayData;
  scrollRootRef: RefObject<HTMLElement | null>;
  scrollY: number;
  scrollToElementId?: string | null;
  sceneToc?: SceneTocEntry[];
  onGoToScene?: (momentIndex: number) => void;
}

export function MomentView({
  moment,
  data,
  scrollRootRef,
  scrollY,
  scrollToElementId,
  sceneToc,
  onGoToScene,
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

  return (
    <div className="reader-column mx-auto w-full max-w-prose px-5 pb-16 pt-6 text-left md:px-10 md:pt-8">
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
  );
}
