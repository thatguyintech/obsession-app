import { syncPublicFromData } from "../lib/screenplay-data.js";

const result = syncPublicFromData();

if (result.synced) {
  console.log(`Synced public/data/obsession.json from data/ (version ${result.version ?? "?"})`);
} else {
  console.log("data/ and public/data/ already in sync");
}
