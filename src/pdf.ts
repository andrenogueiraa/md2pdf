import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { buildHtml, DEFAULT_MARGINS, type ConvertOptions } from "./convert.js";

/**
 * Renders the PDF with the same `buildHtml` output the print preview uses, via a
 * serverless-friendly Chromium (`@sparticuz/chromium` + `puppeteer-core`). The
 * same binary runs locally on Linux, so the production path is verifiable in dev.
 */
export async function renderPdf(options: ConvertOptions): Promise<Buffer> {
  const { markdownContent, margins = DEFAULT_MARGINS, format = "A4", textAlign = "justify" } = options;

  const html = await buildHtml({ markdownContent, textAlign });

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
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
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
