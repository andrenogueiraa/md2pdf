import { handle as handlePreview } from "../api/preview.js";
import { handle as handleConvert } from "../api/convert.js";
import { join } from "path";

const PUBLIC_DIR = join(import.meta.dir, "..", "public");
const SRC_UI_DIR = join(import.meta.dir, "ui");
const isDev = process.argv.includes("--dev");

async function buildFrontend() {
  const result = await Bun.build({
    entrypoints: [join(SRC_UI_DIR, "index.tsx")],
    outdir: PUBLIC_DIR,
    minify: !isDev,
  });
  if (!result.success) {
    console.error("Build failed:", result.logs);
  }
}

if (isDev) {
  await buildFrontend();
  console.log("Dev mode: frontend will rebuild on each request");
}

Bun.serve({
  port: 3007,
  async fetch(req) {
    const url = new URL(req.url);

    // The API routes are the very same web-standard handlers deployed to Vercel
    // (api/preview.ts, api/convert.ts) — single source of truth across dev/prod.
    if (req.method === "POST" && url.pathname === "/api/preview") return handlePreview(req);
    if (req.method === "POST" && url.pathname === "/api/convert") return handleConvert(req);

    // In dev mode, rebuild JS on each page load
    if (isDev && (url.pathname === "/" || url.pathname === "/index.html")) {
      await buildFrontend();
    }

    // Serve static files
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(join(PUBLIC_DIR, filePath));
    if (await file.exists()) {
      return new Response(file);
    }

    // SPA fallback
    return new Response(Bun.file(join(PUBLIC_DIR, "index.html")));
  },
});

console.log(`Server running at http://localhost:3007${isDev ? " (dev mode)" : ""}`);
