/** Split action prose on blank lines (screenplay paragraph breaks). */
export function splitActionParagraphs(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  if (!trimmed.includes("\n\n")) {
    return [trimmed];
  }

  const paragraphs = trimmed
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : [trimmed];
}
