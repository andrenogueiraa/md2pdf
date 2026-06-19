import { marked } from "marked";
import { MARKDOWN_CSS } from "./markdown-css.js";

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageSpec {
  format: string;
  margins: Margins;
}

export interface BuildHtmlOptions {
  markdownContent: string;
  textAlign?: "left" | "justify";
  /**
   * When provided, the HTML is self-paginating for browser printing: it injects
   * an `@page` rule (size + margins) plus a no-print instructions bar. Omit it
   * for the PDF path, where Puppeteer applies size/margins via `page.pdf()`.
   */
  page?: PageSpec;
}

export interface ConvertOptions {
  markdownContent: string;
  margins?: Margins;
  format?: string;
  textAlign?: "left" | "justify";
}

export const DEFAULT_MARGINS: Margins = { top: 20, right: 15, bottom: 20, left: 15 };

function pageCss({ format, margins: m }: PageSpec): string {
  return `@page { size: ${format}; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm; }`;
}

const PRINT_BAR_CSS = `
.print-bar {
  position: sticky;
  top: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  color: #1f2328;
  background: #fff8c5;
  border-bottom: 1px solid #d4a72c;
}
.print-bar span { flex: 1; }
.print-bar button {
  flex: none;
  padding: 6px 14px;
  font: inherit;
  font-weight: 600;
  color: #fff;
  background: #1f883d;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.print-bar button:hover { background: #1a7f37; }
@media print { .print-bar { display: none !important; } }
`;

const PRINT_BAR_HTML = `<div class="print-bar">
  <span>Para o PDF sair igual ao "Convert", no Ctrl+P: <strong>ligue</strong> "Gráficos de plano de fundo" e <strong>desligue</strong> "Cabeçalhos e rodapés".</span>
  <button type="button" onclick="window.print()">Imprimir / Salvar PDF</button>
</div>`;

export async function buildHtml(options: BuildHtmlOptions): Promise<string> {
  const { markdownContent, textAlign = "justify", page } = options;

  marked.setOptions({ gfm: true, breaks: true });
  const htmlBody = await marked.parse(markdownContent);

  // Only the print path adds @page + the no-print bar; the PDF path stays
  // byte-identical to a plain markdown-body document.
  const printStyles = page ? `${pageCss(page)}\n${PRINT_BAR_CSS}\n` : "";
  const printBar = page ? `${PRINT_BAR_HTML}\n` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${MARKDOWN_CSS}
body {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
.markdown-body p,
.markdown-body li {
  text-align: ${textAlign};
}
${printStyles}</style>
</head>
<body class="markdown-body">
${printBar}${htmlBody}
</body>
</html>`;
}

/** Reads conversion options from a multipart form (shared by both API routes). */
export function readOptions(formData: FormData): { format: string; margins: Margins; textAlign: "left" | "justify" } {
  return {
    format: (formData.get("format") as string) || "A4",
    margins: {
      top: Number(formData.get("marginTop")) || DEFAULT_MARGINS.top,
      right: Number(formData.get("marginRight")) || DEFAULT_MARGINS.right,
      bottom: Number(formData.get("marginBottom")) || DEFAULT_MARGINS.bottom,
      left: Number(formData.get("marginLeft")) || DEFAULT_MARGINS.left,
    },
    textAlign: (formData.get("textAlign") as string) === "left" ? "left" : "justify",
  };
}

export const jsonError = (message: string, status: number): Response =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
