import { convertMarkdownToPdf } from "./convert";
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

    if (req.method === "POST" && url.pathname === "/api/convert") {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
          return new Response(JSON.stringify({ error: "No file provided" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const markdownContent = await file.text();
        const format = (formData.get("format") as string) || "A4";
        const top = Number(formData.get("marginTop")) || 20;
        const right = Number(formData.get("marginRight")) || 15;
        const bottom = Number(formData.get("marginBottom")) || 20;
        const left = Number(formData.get("marginLeft")) || 15;

        const textAlign = (formData.get("textAlign") as string) === "left" ? "left" : "justify";

        const pdfBuffer = await convertMarkdownToPdf({
          markdownContent,
          format,
          margins: { top, right, bottom, left },
          textAlign,
        });

        const outputName = file.name.replace(/\.md$/i, "") + ".pdf";
        return new Response(pdfBuffer, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${outputName}"`,
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

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
