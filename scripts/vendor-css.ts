// Regenera src/markdown-css.ts a partir do pacote github-markdown-css.
// Rode após atualizar a dependência:  bun run scripts/vendor-css.ts
//
// Vendorizamos o CSS como string TS (em vez de ler de node_modules em runtime)
// porque as funções serverless da Vercel rodam em ESM no Node, onde require.resolve
// não existe e leituras de arquivo de node_modules nem sempre entram no bundle.
import { readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const css = readFileSync(require.resolve("github-markdown-css/github-markdown.css"), "utf8");

const header =
  "// AUTO-GERADO a partir de github-markdown-css/github-markdown.css. Não editar à mão.\n" +
  "// Para regenerar após atualizar a dependência, rode scripts/vendor-css.ts.\n";

await Bun.write("src/markdown-css.ts", header + "export const MARKDOWN_CSS = " + JSON.stringify(css) + ";\n");
console.log(`src/markdown-css.ts regenerado (${css.length} bytes de CSS).`);
