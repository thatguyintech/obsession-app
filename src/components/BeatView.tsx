import type { Beat, DialogueTrack } from "../types";

function TrackBlock({ track, align }: { track: DialogueTrack; align: "left" | "right" }) {
  return (
    <div className={align === "left" ? "text-left" : "text-right md:text-left"}>
      <p className="mb-2 text-sm font-bold tracking-wide uppercase">{track.character}</p>
      {track.parenthetical ? (
        <p className="mb-2 text-xs text-neutral-400 italic">({track.parenthetical})</p>
      ) : null}
      <div className="space-y-2 text-base leading-relaxed">
        {track.lines.map((line) => (
          <p key={`${track.character}-${line}`}>{line}</p>
        ))}
      </div>
    </div>
  );
}

export function BeatView({ beat }: { beat: Beat }) {
  if (beat.type === "title_card") {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <p className="text-sm tracking-[0.35em] text-neutral-500 uppercase">{beat.subtitle}</p>
        <h1 className="mt-6 text-4xl font-bold tracking-tight uppercase">{beat.title}</h1>
        <p className="mt-4 text-lg text-neutral-300">{beat.author}</p>
      </div>
    );
  }

  if (beat.type === "scene_heading") {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <p className="max-w-md text-xl leading-relaxed font-bold tracking-wide uppercase">
          {beat.text}
        </p>
      </div>
    );
  }

  if (beat.type === "action") {
    return (
      <div className="flex h-full items-center px-6 md:px-10">
        <p className="max-w-2xl text-base leading-7 text-neutral-100 md:text-lg md:leading-8">
          {beat.text}
        </p>
      </div>
    );
  }

  if (beat.type === "dialogue") {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <div className="max-w-lg text-center">
          <p className="mb-4 text-sm font-bold tracking-wide uppercase">{beat.character}</p>
          {beat.parenthetical ? (
            <p className="mb-4 text-xs text-neutral-400 italic">({beat.parenthetical})</p>
          ) : null}
          <div className="space-y-3 text-base leading-relaxed md:text-lg">
            {beat.lines?.map((line) => <p key={line}>{line}</p>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center px-4 md:px-8">
      <div className="grid w-full max-w-5xl gap-8 md:grid-cols-2 md:gap-10">
        {beat.left?.map((track) => (
          <TrackBlock key={`left-${track.character}-${track.lines[0]}`} track={track} align="left" />
        ))}
        {beat.right?.map((track) => (
          <TrackBlock
            key={`right-${track.character}-${track.lines[0]}`}
            track={track}
            align="right"
          />
        ))}
      </div>
    </div>
  );
}
