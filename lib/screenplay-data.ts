import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const DATA_PATH = join(ROOT, "data", "obsession.json");
export const PUBLIC_DATA_PATH = join(ROOT, "public", "data", "obsession.json");

export function serializeScreenplay(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

/** Write screenplay JSON to data/ and public/data/ in one step. */
export function writeScreenplay(payload: unknown): void {
  const serialized = serializeScreenplay(payload);
  mkdirSync(dirname(DATA_PATH), { recursive: true });
  mkdirSync(dirname(PUBLIC_DATA_PATH), { recursive: true });
  writeFileSync(DATA_PATH, serialized);
  writeFileSync(PUBLIC_DATA_PATH, serialized);
}

function hashFile(path: string): string | null {
  if (!existsSync(path)) {
    return null;
  }
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function getScreenplaySyncStatus(): {
  inSync: boolean;
  dataExists: boolean;
  publicExists: boolean;
} {
  const dataHash = hashFile(DATA_PATH);
  const publicHash = hashFile(PUBLIC_DATA_PATH);
  return {
    inSync: dataHash !== null && dataHash === publicHash,
    dataExists: dataHash !== null,
    publicExists: publicHash !== null,
  };
}

export function assertScreenplayDataInSync(): void {
  const status = getScreenplaySyncStatus();
  if (!status.dataExists) {
    throw new Error(`Missing ${DATA_PATH}. Run pnpm extract first.`);
  }
  if (!status.publicExists) {
    throw new Error(`Missing ${PUBLIC_DATA_PATH}. Run pnpm sync-data to copy from data/.`);
  }
  if (!status.inSync) {
    throw new Error(
      "data/obsession.json and public/data/obsession.json are out of sync.\n" +
        "  Run: pnpm sync-data\n" +
        "  Source of truth: data/obsession.json",
    );
  }
}

/** Copy data/obsession.json → public/data/obsession.json when they differ. */
export function syncPublicFromData(): { synced: boolean; version?: number } {
  if (!existsSync(DATA_PATH)) {
    throw new Error(`Missing ${DATA_PATH}. Run pnpm extract first.`);
  }

  const status = getScreenplaySyncStatus();
  if (status.inSync) {
    return { synced: false };
  }

  const payload = readFileSync(DATA_PATH, "utf8");
  mkdirSync(dirname(PUBLIC_DATA_PATH), { recursive: true });
  writeFileSync(PUBLIC_DATA_PATH, payload);

  const meta = JSON.parse(payload) as { meta?: { version?: number } };
  return { synced: true, version: meta.meta?.version };
}

export interface ExistingScreenplayMeta {
  version?: number;
  elementCount?: number;
  momentCount?: number;
}

export function readExistingScreenplayMeta(): ExistingScreenplayMeta | null {
  if (!existsSync(DATA_PATH)) {
    return null;
  }
  try {
    const payload = JSON.parse(readFileSync(DATA_PATH, "utf8")) as { meta?: ExistingScreenplayMeta };
    return payload.meta ?? null;
  } catch {
    return null;
  }
}
