# Design — "Visualizar para impressão" (print preview)

**Data:** 2026-06-18
**Status:** Aprovado para planejamento

## Problema

Hoje o app `md2pdf` tem um único botão **Convert**, que envia o `.md` para o
servidor, o Puppeteer renderiza e devolve um PDF para download. Queremos um
segundo botão, **"Visualizar para impressão"**, que renderize o Markdown com o
**CSS exato** que o PDF já produz, de modo que, ao usar o **Ctrl+P** do
navegador, o usuário obtenha o **mesmo resultado** do Convert — sem precisar
baixar o arquivo.

## Por que é viável

O PDF atual é gerado pelo Puppeteer, que é o motor de impressão do próprio
Chromium. O "convert" é, na prática, um "Ctrl+P do Chrome" rodando no servidor.
Se a impressão sair do Chrome do usuário, é o **mesmo motor de renderização** —
então a paridade é realista, não apenas aproximada.

O `convert.ts` monta um HTML simples: `github-markdown-css` + um reset de
`body` + o `text-align`. As margens e o tamanho da página **não** estão no CSS:
vêm das opções do `page.pdf()` (`margin`, `format`). O ponto-chave do design é
que, para o Ctrl+P bater, essas margens/tamanho precisam ser injetados como
regra CSS `@page { size; margin }` na versão de preview.

## Requisitos

1. Botão "Visualizar para impressão" ao lado do "Convert", com o mesmo gating
   (exige arquivo selecionado) e reusando as configurações atuais (margens,
   formato, alinhamento).
2. Ao clicar, o card inicial **some** e a página passa a mostrar **apenas** o
   documento renderizado, na **mesma aba e mesma URL** (`/`).
3. Para recomeçar (enviar outro arquivo), o usuário aperta **F5**, que recarrega
   o app e traz o card de volta.
4. O HTML/CSS/margens do preview devem ser **idênticos** aos do PDF.
5. Uma barra de instruções no topo do preview (escondida na impressão) lembra os
   dois ajustes do diálogo de impressão que o CSS não controla, e oferece um
   botão "Imprimir / Salvar PDF".

## Decisão de arquitetura

**Abordagem escolhida: render no servidor + substituição do documento.**

A montagem do HTML é extraída do `convert.ts` para uma função única
`buildHtml()`. **Tanto o PDF quanto o preview consomem essa mesma função**, o
que torna impossível o CSS divergir (fonte única da verdade). A única diferença
do preview é acrescentar a regra `@page` com as margens/formato escolhidos.

O cliente busca esse HTML via `fetch` e troca o documento atual com
`document.open(); document.write(html); document.close()`.

### Alternativas consideradas e rejeitadas

- **Render no cliente** (React converte o MD com `marked` no navegador): sem ida
  ao servidor, mas duplica o pipeline (outra cópia do `marked`, CSS embutido no
  bundle) — risco de divergir da versão que gera o PDF. Rejeitada porque o
  requisito central é "CSS exato".
- **Híbrida** (servidor devolve só o fragmento, cliente injeta no DOM atual):
  mais complexa e o Tailwind/preflight do app pode vazar para a impressão.
- **Rota navegável `/preview`**: F5 recarregaria o preview, não o card —
  viola o requisito 3. Por isso mantemos a URL em `/` e usamos `document.write`.

### Por que `document.write` é adequado aqui

`document.write` é desaconselhado quando usado *durante* o carregamento da
página. Substituir intencionalmente o documento inteiro por outro é o caso de
uso legítimo. Como ele apaga `<head>` e todo o conteúdo, o Tailwind do app some
junto — zero vazamento de estilo na impressão. Como não mexemos na URL nem no
histórico, o F5 re-busca `/` e o app volta.

## Componentes e mudanças

### 1. `src/convert.ts` — extrair `buildHtml()`

Nova função pura que retorna a string HTML completa:

```
interface PageSpec { format: string; margins: { top; right; bottom; left } }

function buildHtml(opts: {
  markdownContent: string;
  textAlign: "left" | "justify";
  page?: PageSpec;   // quando presente, injeta @page { size; margin }
}): Promise<string>
```

- Sem `page`: comportamento atual (margens aplicadas depois pelo Puppeteer via
  `page.pdf()`).
- Com `page`: injeta no `<style>` a regra
  `@page { size: <format>; margin: <top>mm <right>mm <bottom>mm <left>mm }`.

`convertMarkdownToPdf` passa a chamar `buildHtml({ markdownContent, textAlign })`
(sem `page`) e segue aplicando margens/format pelo `page.pdf()` como hoje — sem
mudança de comportamento no PDF.

### 2. `src/server.ts` — rota `POST /api/preview`

Aceita os mesmos campos do `/api/convert` (`file`, `format`, `marginTop/Right/
Bottom/Left`, `textAlign`). Responde `Content-Type: text/html` com
`buildHtml({ markdownContent, textAlign, page: { format, margins } })`.
Mesmo tratamento de erro do `/api/convert` (400 sem arquivo, 500 em exceção).

### 3. `src/ui/App.tsx` — botão e troca de documento

- Novo botão "Visualizar para impressão" ao lado do "Convert", desabilitado
  quando não há arquivo (mesma regra do Convert).
- Handler `handlePreview`: monta o mesmo `FormData` do `handleConvert`, faz
  `POST /api/preview`, lê `res.text()` e executa:
  `document.open(); document.write(html); document.close();`.
- Em caso de erro (`!res.ok`), mostra a mensagem no mesmo `error` state, sem
  substituir o documento.

### 4. Barra de instruções no HTML do preview

Incluída por `buildHtml` quando `page` está presente. Um `<div>` fixo no topo,
com `@media print { display: none }`, contendo:

- Aviso: ligar **"Gráficos de plano de fundo"** (equivale a `printBackground:
  true`) e desligar **"Cabeçalhos e rodapés"** no diálogo do Ctrl+P.
- Botão "Imprimir / Salvar PDF" que chama `window.print()`.

A barra usa estilos inline próprios para não depender do `github-markdown-css`
nem do Tailwind.

## Fluxo de dados

```
App (file + settings)
   │  POST /api/preview (FormData)
   ▼
server.ts  ──►  buildHtml({ ..., page })  ──►  HTML (mesmo CSS do PDF + @page + barra)
   │  text/html
   ▼
App: document.open(); document.write(html); document.close()
   ▼
Documento renderizado na mesma aba  ──►  usuário dá Ctrl+P (ou botão Imprimir)
   ▼
Chrome imprime com o mesmo motor Chromium do Puppeteer  ──►  resultado == PDF do Convert
```

## Paridade e limites

**Idêntico ao PDF (sob nosso controle):** HTML, `github-markdown-css`, reset de
`body`, `text-align`, tamanho de página e margens (via `@page`).

**Fora do nosso controle (mitigado pela barra de instruções):** dois ajustes do
diálogo de impressão do navegador, que nenhum CSS controla:

- **"Gráficos de plano de fundo"** precisa estar **ligado** (espelha o
  `printBackground: true` do Puppeteer; afeta fundos de blocos de código/tabelas).
- **"Cabeçalhos e rodapés"** precisa estar **desligado** (o Puppeteer usa
  `displayHeaderFooter: false` por padrão).

A margem em "Padrão" no diálogo respeita o `@page`; se o usuário escolher "Nenhum",
as margens vão a zero — comportamento esperado do navegador, também coberto pela
dica.

**Tela vs. impressão:** na tela, o preview é renderizado na largura da viewport
do navegador, então pode parecer mais largo que a página e ter quebras de linha
diferentes. Isso é esperado: ao imprimir, o navegador re-diagrama o conteúdo na
caixa da página definida pelo `@page`, e é esse resultado impresso que precisa
bater com o PDF. A paridade é da **saída impressa**, não da prévia em tela.

## Fora de escopo (YAGNI)

- Renderização client-side / preview offline.
- Live preview enquanto digita (não há editor; a entrada é um arquivo `.md`).
- Botão de "voltar ao card" na tela de preview (o requisito é F5).
- Persistência de configurações entre sessões.

## Critérios de sucesso

1. Clicar em "Visualizar para impressão" com um `.md` selecionado substitui o
   card pelo documento renderizado, na mesma URL `/`.
2. F5 traz o card de volta.
3. Com "Gráficos de plano de fundo" ligado e "Cabeçalhos e rodapés" desligado, o
   PDF salvo pelo Ctrl+P é visualmente equivalente ao PDF do Convert (mesmas
   margens, mesma tipografia, mesmas quebras de página) para o `test.md`.
4. O PDF do Convert continua idêntico ao de antes (sem regressão).
