/** Screenplay transition directions (right-aligned in PDF). */
export const TRANSITION_TEXT_RE =
  /^(?:SMASH\s+)?CUT\s+TO:|(?:JUMP\s+)?CUT\s+TO:|FADE\s+(?:IN|OUT):|DISSOLVE\s+TO:|DISSOLVE:|MATCH\s+CUT\s+TO:|TIME\s+CUT:|WIPE\s+TO:/i;

export function isTransitionText(text: string): boolean {
  return TRANSITION_TEXT_RE.test(text.trim());
}

export interface TransitionLineLike {
  text: string;
  x0: number;
}

/** Transitions sit in the right column (roughly x0 >= 350 on letter-sized pages). */
export function isTransitionLine(line: TransitionLineLike, minX0 = 350): boolean {
  return isTransitionText(line.text) && line.x0 >= minX0;
}
