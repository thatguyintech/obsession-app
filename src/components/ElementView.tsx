import type { ReactNode } from "react";
import type { SceneTocEntry, ScreenplayElement } from "../types";
import { isContinuousSceneHeading, reflowLines } from "../lib/display";
import { SceneTableOfContents } from "./SceneTableOfContents";
import type { DialogueTrack } from "../types";

interface ElementViewProps {
  element: ScreenplayElement;
  sceneHeadingId?: string;
  highlight?: boolean;
  sceneToc?: SceneTocEntry[];
  onGoToScene?: (momentIndex: number) => void;
}

function TrackBlock({ track }: { track: DialogueTrack }) {
  return (
    <div className="min-w-0 text-left">
      <p className="text-character mb-1">{track.character}</p>
      {track.parenthetical ? (
        <p className="text-parenthetical mb-1.5">({track.parenthetical})</p>
      ) : null}
      <p className="text-dialogue pl-3">{reflowLines(track.lines)}</p>
    </div>
  );
}

function ElementWrapper({
  elementId,
  highlight,
  children,
}: {
  elementId: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-element-id={elementId}
      className={highlight ? "scroll-target -mx-3 rounded-lg bg-neutral-900/80 px-3 py-2" : undefined}
    >
      {children}
    </div>
  );
}

export function ElementView({
  element,
  sceneHeadingId,
  highlight,
  sceneToc,
  onGoToScene,
}: ElementViewProps) {
  if (element.type === "title_card") {
    return (
      <ElementWrapper elementId={element.id} highlight={highlight}>
        <div className="py-8">
          <p className="text-sm tracking-[0.25em] text-neutral-500 uppercase">{element.subtitle}</p>
          <h1 className="mt-10 text-4xl leading-tight font-bold tracking-tight uppercase">
            {element.title}
          </h1>
          <p className="mt-6 text-lg text-neutral-300">{element.author}</p>
          {sceneToc && sceneToc.length > 0 && onGoToScene ? (
            <SceneTableOfContents entries={sceneToc} onSelect={onGoToScene} compact />
          ) : null}
        </div>
      </ElementWrapper>
    );
  }

  if (element.type === "scene_heading") {
    const isContinuous = isContinuousSceneHeading(element.text ?? "");
    const isOpener = element.id === sceneHeadingId;

    if (isContinuous) {
      return (
        <ElementWrapper elementId={element.id} highlight={highlight}>
          <div className="scene-divider">
            <p className="text-scene-continuous">{element.text}</p>
          </div>
        </ElementWrapper>
      );
    }

    return (
      <ElementWrapper elementId={element.id} highlight={highlight}>
        <div className={isOpener ? "mb-8" : "scene-divider"}>
          <p className="text-scene-heading">{element.text}</p>
        </div>
      </ElementWrapper>
    );
  }

  if (element.type === "action") {
    return (
      <ElementWrapper elementId={element.id} highlight={highlight}>
        <p className="text-action mb-8">{element.text}</p>
      </ElementWrapper>
    );
  }

  if (element.type === "dialogue") {
    return (
      <ElementWrapper elementId={element.id} highlight={highlight}>
        <div className="mb-8">
          <p className="text-character mb-1">{element.character}</p>
          {element.parenthetical ? (
            <p className="text-parenthetical mb-2">({element.parenthetical})</p>
          ) : null}
          <p className="text-dialogue pl-3">{reflowLines(element.lines ?? [])}</p>
        </div>
      </ElementWrapper>
    );
  }

  if (element.type === "dual_dialogue") {
    return (
      <ElementWrapper elementId={element.id} highlight={highlight}>
        <div className="mb-8 grid grid-cols-2 gap-3 md:gap-8">
          <div className="min-w-0 space-y-4">
            {element.left?.map((track) => (
              <TrackBlock key={`left-${track.character}-${track.lines[0]}`} track={track} />
            ))}
          </div>
          <div className="min-w-0 space-y-4">
            {element.right?.map((track) => (
              <TrackBlock key={`right-${track.character}-${track.lines[0]}`} track={track} />
            ))}
          </div>
        </div>
      </ElementWrapper>
    );
  }

  return null;
}
