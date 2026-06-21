/** Shared OCR / extract artifact fixes for QA word comparison. */
const QA_TEXT_REPLACEMENTS: Array<[string, string]> = [
  ["wonde red", "wondered"],
  ["year ns", "yearns"],
  ["dro pped", "dropped"],
  ["I dro pped", "I dropped"],
  ["decent- looking", "decent looking"],
  ["decent-looking", "decent looking"],
  ["a\"poor", "a poor"],
  ['a"poor', "a poor"],
];

export function normalizeForQaCompare(text: string): string {
  let normalized = text.replace(/\u2019/g, "'").replace(/\u2018/g, "'").replace(/`/g, "'");

  for (const [from, to] of QA_TEXT_REPLACEMENTS) {
    normalized = normalized.split(from).join(to);
  }

  // Hyphenated compounds in JSON should match spaced PDF tokens.
  normalized = normalized.replace(/([a-z])-([a-z])/gi, "$1 $2");

  // Glued quote artifacts: a"poor → a poor
  normalized = normalized.replace(/([a-z])"([a-z])/gi, "$1 $2");

  return normalized;
}
