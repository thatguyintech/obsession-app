export { isContinuousSceneHeading } from "../../lib/moments";

export function reflowLines(lines: string[]): string {
  return lines.join(" ").replace(/\s+/g, " ").trim();
}
