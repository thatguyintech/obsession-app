import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { saveScreenplayFromQa, type QaSavePayload } from "./scripts/qa-save.ts";

function socialMetaTags(): Plugin {
  const siteDescription =
    "A mobile-friendly reader for the Obsession screenplay by Curry Barker. Scroll scene by scene with search, moment navigation, and a clean book-like layout built for your phone.";
  const siteAuthor = "Curry Barker";
  // Screenplay title-page date (March 9th).
  const sitePublished = "2026-03-09T00:00:00.000Z";

  return {
    name: "social-meta-tags",
    transformIndexHtml(html) {
      const siteUrl = (
        process.env.VITE_SITE_URL ??
        process.env.CF_PAGES_URL ??
        "https://obsession.thatguyintech.com"
      ).replace(/\/$/, "");
      const imagePath = "/obsession-thumbnail.png";
      const ogImage = `${siteUrl}${imagePath}`;
      const siteUrlMeta = `    <meta property="og:url" content="${siteUrl}" />\n    <link rel="canonical" href="${siteUrl}" />\n`;

      return html
        .replaceAll("%SITE_DESCRIPTION%", siteDescription)
        .replaceAll("%SITE_AUTHOR%", siteAuthor)
        .replaceAll("%SITE_PUBLISHED%", sitePublished)
        .replaceAll("%OG_IMAGE%", ogImage)
        .replace("<!--SITE_URL_META-->", siteUrlMeta);
    },
  };
}

function readRequestBody(req: { on: Function }): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function qaDevAssets() {
  return {
    name: "qa-dev-assets",
    apply: "serve" as const,
    configureServer(server: {
      middlewares: { use: (path: string | Function, handler?: Function) => void };
    }) {
      server.middlewares.use("/__qa/source.pdf", (_req, res) => {
        const pdfPath = join(process.cwd(), "obsession-2026.pdf");
        if (!existsSync(pdfPath)) {
          res.statusCode = 404;
          res.end("obsession-2026.pdf not found in repo root");
          return;
        }

        res.setHeader("Content-Type", "application/pdf");
        res.end(readFileSync(pdfPath));
      });

      server.middlewares.use("/__qa/raw.json", (_req, res) => {
        const rawPath = join(process.cwd(), "data", "obsession.raw.json");
        if (!existsSync(rawPath)) {
          res.statusCode = 404;
          res.end("data/obsession.raw.json not found — run pnpm extract");
          return;
        }

        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(rawPath));
      });

      server.middlewares.use("/__qa/save", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        void (async () => {
          try {
            const body = await readRequestBody(req);
            const payload = JSON.parse(body) as QaSavePayload;
            const result = saveScreenplayFromQa(payload);

            res.setHeader("Content-Type", "application/json");
            res.statusCode = result.ok ? 200 : 422;
            res.end(JSON.stringify(result));
          } catch (cause) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                error: cause instanceof Error ? cause.message : "Save failed",
              }),
            );
          }
        })();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), socialMetaTags(), qaDevAssets()],
  server: {
    fs: {
      allow: ["."],
    },
  },
});
