import { readOptions, jsonError } from "../src/convert.js";
import { renderPdf } from "../src/pdf.js";

/**
 * POST /api/convert — renders the Markdown to a downloadable PDF via Chromium.
 *
 * Web-standard `fetch` handler shared by Bun.serve (dev) and Vercel (prod). This
 * is the heavy path (launches Chromium); maxDuration is bumped in vercel.json.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("No file provided", 400);

    const markdownContent = await file.text();
    const { format, margins, textAlign } = readOptions(form);

    const pdf = await renderPdf({ markdownContent, format, margins, textAlign });
    const outputName = (file.name || "document").replace(/\.md$/i, "") + ".pdf";
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${outputName}"`,
      },
    });
  } catch (err: any) {
    return jsonError(err?.message ?? "Conversion failed", 500);
  }
}

export default { fetch: handle };
