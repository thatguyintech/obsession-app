const CORE_CHARACTER_COLORS: Record<string, string> = {
  BEAR: "#9a3412",
  NICKY: "#1d4ed8",
  IAN: "#15803d",
  SARAH: "#7c3aed",
  CARTER: "#b45309",
  "TRIVIA GUY": "#0f766e",
  VIOLA: "#be185d",
  CHRIS: "#6366f1",
  HARRY: "#4338ca",
  JOE: "#c2410c",
  REGGIE: "#047857",
  EMPLOYEE: "#78716c",
  "MAN ON TV": "#64748b",
};

const EXTENDED_PALETTE = [
  "#0e7490",
  "#a21caf",
  "#4f46e5",
  "#ca8a04",
  "#dc2626",
  "#059669",
  "#d97706",
  "#7c2d12",
];

export function normalizeCharacterName(raw: string): string {
  let name = raw.split("(")[0].trim().toUpperCase();
  name = name.replace(/\.$/, "");

  if (name === "NIC KY") return "NICKY";
  if (name === "I AN") return "IAN";
  if (name.includes("/")) {
    return name.split("/")[0].trim();
  }

  return name;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getCharacterColor(raw: string): string {
  const name = normalizeCharacterName(raw);
  if (CORE_CHARACTER_COLORS[name]) {
    return CORE_CHARACTER_COLORS[name];
  }

  const index = hashString(name) % EXTENDED_PALETTE.length;
  return EXTENDED_PALETTE[index];
}

export function characterColorStyle(color: string): { color: string; borderColor: string; backgroundColor: string } {
  return {
    color,
    borderColor: color,
    backgroundColor: `color-mix(in srgb, ${color} 10%, white)`,
  };
}
