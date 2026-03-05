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
