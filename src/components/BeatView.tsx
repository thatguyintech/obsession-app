import type { Beat, DialogueTrack } from "../types";

function BeatPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col px-6 pb-10 pt-14 md:px-10 md:pt-16">
      <div className="mx-auto w-full max-w-prose overflow-y-auto text-left">{children}</div>
    </div>
  );
}

function TrackBlock({ track, compact = false }: { track: DialogueTrack; compact?: boolean }) {
  return (
    <div className="min-w-0 text-left">
      <p
        className={`mb-1.5 font-bold tracking-wide uppercase ${compact ? "text-[10px] leading-tight md:text-sm" : "text-sm"}`}
      >
        {track.character}
      </p>
      {track.parenthetical ? (
        <p className={`mb-1.5 text-neutral-400 italic ${compact ? "text-[10px] md:text-xs" : "text-xs"}`}>
          ({track.parenthetical})
        </p>
      ) : null}
      <div
        className={`space-y-1.5 leading-relaxed text-neutral-100 ${compact ? "pl-1 text-xs md:space-y-2 md:pl-3 md:text-base" : "space-y-2 pl-4 text-base"}`}
      >
        {track.lines.map((line) => (
          <p key={`${track.character}-${line}`}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function DualBeatPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col px-4 pb-10 pt-14 md:px-8 md:pt-16">
      <div className="mx-auto w-full max-w-4xl overflow-y-auto">{children}</div>
    </div>
  );
}

export function BeatView({ beat }: { beat: Beat }) {
  if (beat.type === "title_card") {
    return (
      <BeatPanel>
        <p className="text-sm tracking-[0.25em] text-neutral-500 uppercase">{beat.subtitle}</p>
        <h1 className="mt-10 text-4xl leading-tight font-bold tracking-tight uppercase">
          {beat.title}
        </h1>
        <p className="mt-6 text-lg text-neutral-300">{beat.author}</p>
      </BeatPanel>
    );
  }

  if (beat.type === "scene_heading") {
    return (
      <BeatPanel>
        <p className="text-lg leading-relaxed font-bold tracking-wide text-neutral-200 uppercase md:text-xl">
          {beat.text}
        </p>
      </BeatPanel>
    );
  }

  if (beat.type === "action") {
    return (
      <BeatPanel>
        <p className="text-base leading-7 text-neutral-100 md:text-lg md:leading-8">{beat.text}</p>
      </BeatPanel>
    );
  }

  if (beat.type === "dialogue") {
    return (
      <BeatPanel>
        <p className="mb-3 text-sm font-bold tracking-wide uppercase">{beat.character}</p>
        {beat.parenthetical ? (
          <p className="mb-3 pl-4 text-xs text-neutral-400 italic">({beat.parenthetical})</p>
        ) : null}
        <div className="space-y-3 pl-4 text-base leading-relaxed text-neutral-100 md:text-lg md:leading-8">
          {beat.lines?.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </BeatPanel>
    );
  }

  return (
    <DualBeatPanel>
      <div className="grid grid-cols-2 gap-3 text-left md:gap-8">
        <div className="min-w-0 space-y-6">
          {beat.left?.map((track) => (
            <TrackBlock key={`left-${track.character}-${track.lines[0]}`} track={track} compact />
          ))}
        </div>
        <div className="min-w-0 space-y-6">
          {beat.right?.map((track) => (
            <TrackBlock key={`right-${track.character}-${track.lines[0]}`} track={track} compact />
          ))}
        </div>
      </div>
    </DualBeatPanel>
  );
}
