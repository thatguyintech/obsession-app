import type { ReactNode } from "react";
import type { DialogueSegment, SceneTocEntry, ScreenplayElement } from "../types";
import { ensureDialogueSegments, ensureTrackSegments } from "../../lib/dialogue-segments";
import { splitActionParagraphs } from "../../lib/text-paragraphs";
import { getCharacterColor, characterColorStyle } from "../lib/character-colors";
import { isContinuousSceneHeading } from "../lib/display";
import { InlineText } from "./InlineText";
import { SceneTableOfContents } from "./SceneTableOfContents";
import type { DialogueTrack } from "../types";

interface ElementViewProps {
  element: ScreenplayElement;
  sceneHeadingId?: string;
  highlight?: boolean;
  sceneToc?: SceneTocEntry[];
  onGoToScene?: (momentIndex: number) => void;
}

function SegmentList({ segments }: { segments: DialogueSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "parenthetical" ? (
          <p key={`${index}-p`} className="text-parenthetical">
            ({segment.text})
          </p>
        ) : (
          <p key={`${index}-s`} className="text-dialogue">
            <InlineText text={segment.text} />
          </p>
        ),
      )}
    </>
  );
}

function TrackBlock({ track }: { track: DialogueTrack }) {
  const character = track.character.trim();
  const blockStyle = characterColorStyle(getCharacterColor(character));
  const segments = ensureTrackSegments(track);

  return (
    <div className="dual-column-block min-w-0 text-left" style={blockStyle}>
      <p className="text-character break-words" style={{ color: blockStyle.color }}>
        {character}
      </p>
      <SegmentList segments={segments} />
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
  segments,
}: {
  character: string;
  segments: DialogueSegment[];
}) {
  const blockStyle = characterColorStyle(getCharacterColor(character));

  return (
    <div className="dialogue-block" style={blockStyle}>
      <p className="text-character break-words" style={{ color: blockStyle.color }}>
        {character}
      </p>
      <SegmentList segments={segments} />
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

  if (element.type === "transition") {
    return (
      <ElementWrapper elementId={element.id} highlight={highlight}>
        <div className="transition-block">
          <p className="text-scene-transition">
            <InlineText text={element.text ?? ""} />
          </p>
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
    const paragraphs = splitActionParagraphs(element.text ?? "");

    return (
      <ElementWrapper elementId={element.id} highlight={highlight}>
        <div className="action-block">
          {paragraphs.map((paragraph, index) => (
            <p key={`${element.id}-p-${index}`} className="text-action">
              <InlineText text={paragraph} />
            </p>
          ))}
        </div>
      </ElementWrapper>
    );
  }

  if (element.type === "dialogue") {
    return (
      <ElementWrapper elementId={element.id} highlight={highlight}>
        <DialogueBlock
          character={element.character ?? ""}
          segments={ensureDialogueSegments(element)}
        />
      </ElementWrapper>
    );
  }

  if (element.type === "dual_dialogue") {
    return (
      <ElementWrapper elementId={element.id} highlight={highlight}>
        <div className="dual-dialogue">
          <div className="dual-dialogue-grid">
            <div className="dual-dialogue-column">
              {element.left?.map((track) => (
                <TrackBlock
                  key={`left-${track.character.trim()}-${ensureTrackSegments(track)[0]?.text ?? ""}`}
                  track={track}
                />
              ))}
            </div>
            <div className="dual-dialogue-column">
              {element.right?.map((track) => (
                <TrackBlock
                  key={`right-${track.character.trim()}-${ensureTrackSegments(track)[0]?.text ?? ""}`}
                  track={track}
                />
              ))}
            </div>
          </div>
        </div>
      </ElementWrapper>
    );
  }

  return null;
}
