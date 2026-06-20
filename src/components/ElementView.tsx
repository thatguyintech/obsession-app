import type { CSSProperties, ReactNode } from "react";
import type { SceneTocEntry, ScreenplayElement } from "../types";
import { getCharacterColor } from "../lib/character-colors";
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
  const color = getCharacterColor(track.character);
  const blockStyle: CSSProperties = { borderLeftColor: color };

  return (
    <div className="dual-column-block min-w-0 text-left" style={blockStyle}>
      <p className="text-character break-words" style={{ color }}>
        {track.character}
      </p>
      {track.parenthetical ? (
        <p className="text-parenthetical">({track.parenthetical})</p>
      ) : null}
      <p className="text-dialogue">{reflowLines(track.lines)}</p>
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
    <div data-element-id={elementId} className={highlight ? "scroll-target-highlight" : undefined}>
      {children}
    </div>
  );
}

function DialogueBlock({
  character,
  parenthetical,
  lines,
}: {
  character: string;
  parenthetical?: string;
  lines: string[];
}) {
  const color = getCharacterColor(character);
  const blockStyle: CSSProperties = { borderLeftColor: color };

  return (
    <div className="dialogue-block" style={blockStyle}>
      <p className="text-character break-words" style={{ color }}>
        {character}
      </p>
      {parenthetical ? <p className="text-parenthetical">({parenthetical})</p> : null}
      <p className="text-dialogue">{reflowLines(lines)}</p>
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
        <div className="pb-12 pt-4">
          <p className="font-label text-xs tracking-[0.2em] text-stone-400 uppercase">{element.subtitle}</p>
          <h1 className="font-label mt-8 text-3xl leading-tight font-semibold tracking-tight text-stone-900 md:text-4xl">
            {element.title}
          </h1>
          <p className="mt-4 text-base text-stone-500">{element.author}</p>
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
          <div className="scene-continuous">
            <p className="text-scene-continuous">{element.text}</p>
          </div>
        </ElementWrapper>
      );
    }

    return (
      <ElementWrapper elementId={element.id} highlight={highlight}>
        <div className={`scene-marker${isOpener ? " scene-marker-opener" : ""}`}>
          <p className="text-scene-heading">{element.text}</p>
        </div>
      </ElementWrapper>
    );
  }

  if (element.type === "action") {
    return (
      <ElementWrapper elementId={element.id} highlight={highlight}>
        <div className="action-block">
          <p className="text-action">{element.text}</p>
        </div>
      </ElementWrapper>
    );
  }

  if (element.type === "dialogue") {
    return (
      <ElementWrapper elementId={element.id} highlight={highlight}>
        <DialogueBlock
          character={element.character ?? ""}
          parenthetical={element.parenthetical}
          lines={element.lines ?? []}
        />
      </ElementWrapper>
    );
  }

  if (element.type === "dual_dialogue") {
    return (
      <ElementWrapper elementId={element.id} highlight={highlight}>
        <div className="mb-7 grid grid-cols-1 gap-6 min-[28rem]:grid-cols-2 md:gap-8">
          <div className="min-w-0 space-y-6">
            {element.left?.map((track) => (
              <TrackBlock key={`left-${track.character}-${track.lines[0]}`} track={track} />
            ))}
          </div>
          <div className="min-w-0 space-y-6">
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
