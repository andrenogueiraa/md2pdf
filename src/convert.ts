import { readFileSync } from "fs";
import { marked } from "marked";
import puppeteer from "puppeteer";

export interface ConvertOptions {
  markdownContent: string;
  margins?: { top: number; right: number; bottom: number; left: number };
  format?: string;
  textAlign?: "left" | "justify";
}

export async function convertMarkdownToPdf(options: ConvertOptions): Promise<Buffer> {
  const { markdownContent, margins = { top: 20, right: 15, bottom: 20, left: 15 }, format = "A4", textAlign = "justify" } = options;

  marked.setOptions({ gfm: true, breaks: true });
  const htmlBody = await marked.parse(markdownContent);

  const cssPath = require.resolve("github-markdown-css/github-markdown.css");
  const css = readFileSync(cssPath, "utf-8");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${css}
body {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
.markdown-body p,
.markdown-body li {
  text-align: ${textAlign};
}
/* Override github-markdown-css table styles so tables fit the page width
   instead of overflowing (which gets clipped/truncated when printing to PDF). */
.markdown-body table {
  display: table;
  width: 100%;
  table-layout: fixed;
  overflow: visible;
  word-break: break-word;
  overflow-wrap: break-word;
}
.markdown-body table th,
.markdown-body table td {
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  vertical-align: top;
  text-align: left;
}
/* Avoid awkward row splits across page breaks. */
.markdown-body table tr,
.markdown-body table td,
.markdown-body table th {
  page-break-inside: avoid;
}
.markdown-body pre,
.markdown-body code {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
}
</style>
</head>
<body class="markdown-body">
${htmlBody}
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({
    format: format as any,
    margin: {
      top: `${margins.top}mm`,
      right: `${margins.right}mm`,
      bottom: `${margins.bottom}mm`,
      left: `${margins.left}mm`,
    },
    printBackground: true,
  });
  await browser.close();

  return Buffer.from(pdfBuffer);
}
