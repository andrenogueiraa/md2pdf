import { test, expect, describe } from "bun:test";
import { buildHtml } from "./convert";

describe("buildHtml", () => {
  test("parses markdown into the github-markdown-css body", async () => {
    const html = await buildHtml({ markdownContent: "# Hello\n\nworld" });
    expect(html).toContain('<body class="markdown-body">');
    expect(html).toContain("<h1");
    expect(html).toContain("Hello");
    // bundles the github-markdown-css (sanity: the file defines .markdown-body)
    expect(html).toContain(".markdown-body");
  });

  test("defaults paragraph/list alignment to justify", async () => {
    const html = await buildHtml({ markdownContent: "text" });
    expect(html).toMatch(/\.markdown-body p,\s*\.markdown-body li\s*\{\s*text-align:\s*justify;/);
  });

  test("honors left text alignment", async () => {
    const html = await buildHtml({ markdownContent: "text", textAlign: "left" });
    expect(html).toMatch(/text-align:\s*left;/);
  });

  test("without a page spec, emits no @page rule and no print bar", async () => {
    const html = await buildHtml({ markdownContent: "text" });
    expect(html).not.toContain("@page");
    expect(html).not.toContain("window.print()");
  });

  test("with a page spec, injects @page size and margins so Ctrl+P matches the PDF", async () => {
    const html = await buildHtml({
      markdownContent: "text",
      page: { format: "A4", margins: { top: 20, right: 15, bottom: 25, left: 10 } },
    });
    expect(html).toMatch(/@page\s*\{[^}]*size:\s*A4;/);
    expect(html).toMatch(/@page\s*\{[^}]*margin:\s*20mm\s+15mm\s+25mm\s+10mm;/);
  });

  test("with a page spec, includes the print-instructions bar hidden on print", async () => {
    const html = await buildHtml({
      markdownContent: "text",
      page: { format: "A4", margins: { top: 20, right: 15, bottom: 20, left: 15 } },
    });
    // a print button that triggers the browser print dialog
    expect(html).toContain("window.print()");
    // the bar is hidden when actually printing
    expect(html).toMatch(/@media print\s*\{[^}]*\.print-bar[^}]*display:\s*none/);
  });
});
