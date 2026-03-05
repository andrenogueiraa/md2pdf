import { readFileSync } from "fs";
import { writeFileSync } from "fs";
import { resolve, basename, dirname } from "path";
import { convertMarkdownToPdf } from "./convert";

const args = process.argv.slice(2);
const inputIndex = args.findIndex((a) => !a.startsWith("-"));
if (inputIndex === -1) {
  console.error("Usage: bun run src/index.ts <input.md> [-o output.pdf]");
  process.exit(1);
}

const inputPath = resolve(args[inputIndex]);
const outputFlagIndex = args.indexOf("-o");
const outputPath =
  outputFlagIndex !== -1 && args[outputFlagIndex + 1]
    ? resolve(args[outputFlagIndex + 1])
    : resolve(
        dirname(inputPath),
        basename(inputPath).replace(/\.md$/i, "") + ".pdf"
      );

const markdown = readFileSync(inputPath, "utf-8");

const pdfBuffer = await convertMarkdownToPdf({ markdownContent: markdown });
writeFileSync(outputPath, pdfBuffer);

console.log(`Created ${outputPath}`);
