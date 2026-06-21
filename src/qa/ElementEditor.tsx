import type { DialogueSegment, ScreenplayElement } from "../types";
import type { DialogueTrack } from "../types";
import { ensureDialogueSegments, ensureTrackSegments } from "../../lib/dialogue-segments";

interface ElementEditorProps {
  element: ScreenplayElement;
  onChange: (element: ScreenplayElement) => void;
  onRevert: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function FieldLabel({ children }: { children: string }) {
  return (
    <label className="mb-1 block font-label text-[0.65rem] tracking-wide text-stone-500 uppercase">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-stone-300 px-2 py-1.5 font-reading text-sm text-stone-900"
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full resize-y rounded border border-stone-300 px-2 py-1.5 font-reading text-sm leading-relaxed text-stone-900"
    />
  );
}

function SegmentEditor({
  segments,
  onChange,
}: {
  segments: DialogueSegment[];
  onChange: (segments: DialogueSegment[]) => void;
}) {
  function updateSegment(index: number, next: DialogueSegment) {
    onChange(segments.map((segment, segmentIndex) => (segmentIndex === index ? next : segment)));
  }

  function removeSegment(index: number) {
    onChange(segments.filter((_, segmentIndex) => segmentIndex !== index));
  }

  function addSegment(kind: DialogueSegment["kind"]) {
    onChange([...segments, { kind, text: "" }]);
  }

  return (
    <div className="space-y-2">
      {segments.map((segment, index) => (
        <div key={index} className="flex flex-wrap items-start gap-2 rounded border border-stone-200 bg-stone-50 p-2">
          <select
            value={segment.kind}
            onChange={(event) =>
              updateSegment(index, {
                ...segment,
                kind: event.target.value as DialogueSegment["kind"],
              })
            }
            className="rounded border border-stone-300 px-2 py-1 font-label text-xs text-stone-800"
          >
            <option value="speech">Speech</option>
            <option value="parenthetical">Parenthetical</option>
          </select>
          <div className="min-w-0 flex-1">
            <TextArea
              value={segment.text}
              onChange={(text) => updateSegment(index, { ...segment, text })}
              rows={segment.kind === "parenthetical" ? 2 : 4}
              placeholder={segment.kind === "parenthetical" ? "some movement" : "Dialogue line"}
            />
          </div>
          <button
            type="button"
            className="reader-chrome-button text-xs text-stone-600"
            onClick={() => removeSegment(index)}
          >
            Remove
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="reader-chrome-button text-xs"
          onClick={() => addSegment("speech")}
        >
          + Speech
        </button>
        <button
          type="button"
          className="reader-chrome-button text-xs"
          onClick={() => addSegment("parenthetical")}
        >
          + Parenthetical
        </button>
      </div>
    </div>
  );
}

function DialogueTrackEditor({
  label,
  track,
  onChange,
}: {
  label: string;
  track: DialogueTrack;
  onChange: (track: DialogueTrack) => void;
}) {
  const segments = ensureTrackSegments(track);

  return (
    <div className="rounded border border-stone-200 bg-stone-50 p-3">
      <p className="mb-2 font-label text-xs font-semibold text-stone-700">{label}</p>
      <div className="space-y-2">
        <div>
          <FieldLabel>Character</FieldLabel>
          <TextInput
            value={track.character}
            onChange={(character) => onChange({ ...track, segments, character })}
          />
        </div>
        <div>
          <FieldLabel>Segments</FieldLabel>
          <SegmentEditor
            segments={segments}
            onChange={(nextSegments) => onChange({ ...track, segments: nextSegments })}
          />
        </div>
      </div>
    </div>
  );
}

function updateDualTrack(
  element: ScreenplayElement,
  side: "left" | "right",
  index: number,
  track: DialogueTrack,
): ScreenplayElement {
  const tracks = [...(element[side] ?? [])];
  tracks[index] = track;
  return { ...element, [side]: tracks };
}

export function ElementEditor({ element, onChange, onRevert, onDelete, onClose }: ElementEditorProps) {
  return (
    <div className="border-t border-stone-200 bg-white px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-stone-900">
          Edit {element.id}{" "}
          <span className="font-normal text-stone-500">({element.type.replace("_", " ")})</span>
        </h3>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className="reader-chrome-button text-sm text-red-800 hover:bg-red-50"
            onClick={onDelete}
          >
            Delete
          </button>
          <button type="button" className="reader-chrome-button text-sm" onClick={onRevert}>
            Revert
          </button>
          <button type="button" className="reader-chrome-button text-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
        {element.type === "title_card" ? (
          <>
            <div>
              <FieldLabel>Title</FieldLabel>
              <TextInput
                value={element.title ?? ""}
                onChange={(title) => onChange({ ...element, title })}
              />
            </div>
            <div>
              <FieldLabel>Author</FieldLabel>
              <TextInput
                value={element.author ?? ""}
                onChange={(author) => onChange({ ...element, author })}
              />
            </div>
            <div>
              <FieldLabel>Subtitle</FieldLabel>
              <TextInput
                value={element.subtitle ?? ""}
                onChange={(subtitle) => onChange({ ...element, subtitle })}
              />
            </div>
          </>
        ) : null}

        {element.type === "scene_heading" || element.type === "action" ? (
          <div>
            <FieldLabel>Text</FieldLabel>
            <TextArea
              value={element.text ?? ""}
              onChange={(text) => onChange({ ...element, text })}
              rows={6}
            />
          </div>
        ) : null}

        {element.type === "dialogue" ? (
          <>
            <div>
              <FieldLabel>Character</FieldLabel>
              <TextInput
                value={element.character ?? ""}
                onChange={(character) =>
                  onChange({
                    ...element,
                    character,
                    segments: ensureDialogueSegments(element),
                  })
                }
              />
            </div>
            <div>
              <FieldLabel>Segments</FieldLabel>
              <SegmentEditor
                segments={ensureDialogueSegments(element)}
                onChange={(segments) => onChange({ ...element, segments })}
              />
            </div>
          </>
        ) : null}

        {element.type === "dual_dialogue" ? (
          <div className="grid gap-3 md:grid-cols-2">
            {(element.left ?? []).map((track, index) => (
              <DialogueTrackEditor
                key={`left-${index}`}
                label={`Left ${index + 1}`}
                track={track}
                onChange={(next) => onChange(updateDualTrack(element, "left", index, next))}
              />
            ))}
            {(element.right ?? []).map((track, index) => (
              <DialogueTrackEditor
                key={`right-${index}`}
                label={`Right ${index + 1}`}
                track={track}
                onChange={(next) => onChange(updateDualTrack(element, "right", index, next))}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
