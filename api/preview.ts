import { buildHtml, readOptions, jsonError } from "../src/convert.js";

/**
 * POST /api/preview — returns the print-ready HTML (same buildHtml as the PDF)
 * with an injected @page rule, so the browser's Ctrl+P reproduces the PDF.
 *
 * Web-standard `fetch` handler: runs identically under Bun.serve (dev) and as a
 * Vercel Function (prod). No Puppeteer here, so this stays a lightweight function.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("No file provided", 400);

    const markdownContent = await file.text();
    const { format, margins, textAlign } = readOptions(form);

    const html = await buildHtml({ markdownContent, textAlign, page: { format, margins } });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err: any) {
    return jsonError(err?.message ?? "Preview failed", 500);
  }
}

export default { fetch: handle };
