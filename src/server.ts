import { convertMarkdownToPdf, buildHtml, type Margins } from "./convert";
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

const jsonError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function readOptions(formData: FormData): { format: string; margins: Margins; textAlign: "left" | "justify" } {
  return {
    format: (formData.get("format") as string) || "A4",
    margins: {
      top: Number(formData.get("marginTop")) || 20,
      right: Number(formData.get("marginRight")) || 15,
      bottom: Number(formData.get("marginBottom")) || 20,
      left: Number(formData.get("marginLeft")) || 15,
    },
    textAlign: (formData.get("textAlign") as string) === "left" ? "left" : "justify",
  };
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
        if (!file) return jsonError("No file provided", 400);

        const markdownContent = await file.text();
        const { format, margins, textAlign } = readOptions(formData);

        const pdfBuffer = await convertMarkdownToPdf({ markdownContent, format, margins, textAlign });

        const outputName = file.name.replace(/\.md$/i, "") + ".pdf";
        return new Response(pdfBuffer, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${outputName}"`,
          },
        });
      } catch (err: any) {
        return jsonError(err.message, 500);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/preview") {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) return jsonError("No file provided", 400);

        const markdownContent = await file.text();
        const { format, margins, textAlign } = readOptions(formData);

        const html = await buildHtml({ markdownContent, textAlign, page: { format, margins } });
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      } catch (err: any) {
        return jsonError(err.message, 500);
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
