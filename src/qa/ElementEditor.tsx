import type { DialogueTrack, ScreenplayElement } from "../types";

interface ElementEditorProps {
  element: ScreenplayElement;
  onChange: (element: ScreenplayElement) => void;
  onRevert: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function linesToTextarea(lines: string[] | undefined): string {
  return (lines ?? []).join("\n");
}

function linesFromTextarea(value: string): string[] {
  const lines = value.split("\n").map((line) => line.trimEnd());
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
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

function DialogueTrackEditor({
  label,
  track,
  onChange,
}: {
  label: string;
  track: DialogueTrack;
  onChange: (track: DialogueTrack) => void;
}) {
  return (
    <div className="rounded border border-stone-200 bg-stone-50 p-3">
      <p className="mb-2 font-label text-xs font-semibold text-stone-700">{label}</p>
      <div className="space-y-2">
        <div>
          <FieldLabel>Character</FieldLabel>
          <TextInput
            value={track.character}
            onChange={(character) => onChange({ ...track, character })}
          />
        </div>
        <div>
          <FieldLabel>Parenthetical</FieldLabel>
          <TextInput
            value={track.parenthetical ?? ""}
            onChange={(parenthetical) =>
              onChange({ ...track, parenthetical: parenthetical || undefined })
            }
            placeholder="optional"
          />
        </div>
        <div>
          <FieldLabel>Lines</FieldLabel>
          <TextArea
            value={linesToTextarea(track.lines)}
            onChange={(value) => onChange({ ...track, lines: linesFromTextarea(value) })}
            rows={5}
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
                onChange={(character) => onChange({ ...element, character })}
              />
            </div>
            <div>
              <FieldLabel>Parenthetical</FieldLabel>
              <TextInput
                value={element.parenthetical ?? ""}
                onChange={(parenthetical) =>
                  onChange({ ...element, parenthetical: parenthetical || undefined })
                }
                placeholder="optional"
              />
            </div>
            <div>
              <FieldLabel>Lines</FieldLabel>
              <TextArea
                value={linesToTextarea(element.lines)}
                onChange={(value) => onChange({ ...element, lines: linesFromTextarea(value) })}
                rows={6}
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
