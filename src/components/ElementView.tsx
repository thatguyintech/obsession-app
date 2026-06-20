import type { CSSProperties, ReactNode } from "react";
import type { SceneTocEntry, ScreenplayElement } from "../types";
import { characterColorStyle, getCharacterColor } from "../lib/character-colors";
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
  const tone = characterColorStyle(color);

  return (
    <div className="dual-column-rule min-w-0 text-left" style={{ borderLeftColor: color }}>
      <div className="dialogue-block mb-0 border-l-[3px] py-0 pl-3" style={tone}>
        <p className="text-character mb-1" style={{ color }}>
          {track.character}
        </p>
        {track.parenthetical ? (
          <p className="text-parenthetical mb-1.5 pl-1">({track.parenthetical})</p>
        ) : null}
        <p className="text-dialogue pl-1">{reflowLines(track.lines)}</p>
      </div>
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
  const tone = characterColorStyle(color);
  const blockStyle: CSSProperties = {
    borderLeftColor: color,
    backgroundColor: tone.backgroundColor,
  };

  return (
    <div className="dialogue-block" style={blockStyle}>
      <p className="text-character mb-1" style={{ color }}>
        {character}
      </p>
      {parenthetical ? (
        <p className="text-parenthetical mb-2 pl-1">({parenthetical})</p>
      ) : null}
      <p className="text-dialogue pl-1">{reflowLines(lines)}</p>
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
          <p className="text-sm tracking-[0.25em] text-stone-500 uppercase">{element.subtitle}</p>
          <h1 className="mt-10 text-4xl leading-tight font-bold tracking-tight text-stone-900 uppercase">
            {element.title}
          </h1>
          <p className="mt-6 text-lg text-stone-600">{element.author}</p>
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
        <div className={isOpener ? "scene-band" : "scene-divider"}>
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
        <div className="mb-8 grid grid-cols-2 gap-3 md:gap-6">
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
