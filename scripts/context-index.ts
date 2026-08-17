/**
 * Context-pool indexer: tree-sitter repo map + gateway-embedded LanceDB table.
 *
 * Owns the two persisted context-pool artifacts (design lives at
 * docs/research/context-pools-2026-08-16.md). Both are derived, disposable caches
 * under .tmp/context-pools/ — delete them and rerun for an identical result.
 * Embeddings route through the Agency gateway (/v1/embeddings, agency-embed-code)
 * so every batch lands in the observability loop and is funded by MongoDB Atlas
 * Model API credits (see config in the sibling agency/ repo).
 *
 * Port of agency/scripts/context_index.py, adapted for this repo's TypeScript
 * surface. Language-specific points:
 *   - git ls-files '*.ts' '*.tsx' enumerates the tracked source set. Untyped
 *     build output (node_modules/, .output/, .eve/) is not tracked and is
 *     excluded automatically.
 *   - tree-sitter TypeScript grammar has two dialects: `typescript` for `.ts`
 *     and `tsx` for `.tsx`. They are separate wasm files; we use the
 *     prebuilt ones shipped by @vscode/tree-sitter-wasm (the same wams VS
 *     Code uses), which are compatible with web-tree-sitter 0.26's dylink
 *     wasm format. The `tree-sitter-wasms` package ships a different format
 *     and does not load.
 *   - Module-level + method-level function/class/arrow skeletons are extracted.
 *     Bodies are dropped. Signatures are reconstructed from the def node span
 *     up to the body node (space-collapsed) so the map stays legible.
 *
 * Usage:
 *   pnpm index                         # incremental index (map + embeds)
 *   pnpm index --map-only              # skeletons only, no embed spend
 *   pnpm index --query "where are virtual keys minted?"
 *   pnpm index --stats
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Connection as LanceConnection, Table as LanceTable } from "@lancedb/lancedb";

// web-tree-sitter and @lancedb/lancedb are ESM and load lazily inside the
// functions that need them. The dynamic imports are caught by main()'s
// try/catch (a top-level await here would bypass it and exit silently).

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ROOT_URL = new URL("..", import.meta.url);
const POOL_DIR = new URL(".tmp/context-pools/", ROOT_URL);
const POOL_PATH = fileURLToPath(POOL_DIR);
const MAP_PATH = POOL_PATH + "repo_map.txt";
const MANIFEST_PATH = POOL_PATH + "manifest.json";
const LANCE_DIR = POOL_PATH + "lance";
const TABLE_NAME = "code_chunks";
const EMBED_MODEL = "agency-embed-code";
const MAX_CHUNK_CHARS = 6000;
// Voyage free tier (3 RPM / 10K TPM). ~4 chars/token. Pace batches so we
// never blow the rate budget; the embedding pass is a one-shot per-repo cost.
const BATCH_CHAR_BUDGET = 30_000;
const BATCH_INTERVAL_S = 21.0;
const MAX_RETRIES = 5;

type SymbolKind = "function" | "method" | "class" | "arrow" | "value";

// Persisted at .tmp/context-pools/manifest.json. `embedded` maps a tracked
// file path to its git blob hash at the time it was last embedded; `embed_model`
// records which gateway route produced the vectors. Both fields are for the
// incremental gate and for traceability — not consumed by the runtime path.
interface ManifestFile {
  embedded: Record<string, string>;
  embed_model: string;
}

interface Symbol {
  kind: SymbolKind;
  name: string;
  signature: string;
  doc: string | null;
  source: string;
  startLine: number;
  endLine: number;
}

interface FileMap {
  moduleDoc: string | null;
  symbols: Symbol[];
  blob: string;
}

interface Row {
  id: string;
  file: string;
  kind: SymbolKind;
  name: string;
  signature: string;
  start_line: number;
  end_line: number;
  text: string;
  vector?: Float32Array;
  // LanceDB infers the Arrow schema from the row objects. The createTable /
  // add overloads require Record<string, unknown>[]; an explicit index
  // signature makes `Row` assignable without a cast.
  [k: string]: unknown;
}

function loadEnv(): void {
  const envPath = ROOT + ".env";
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function gatewayConfig(keyEnv: string): { base: string; key: string } {
  const base = (process.env.AGENCY_GATEWAY_BASE_URL ?? "https://gateway.jami.studio/v1").replace(/\/$/, "");
  const key = process.env[keyEnv] ?? "";
  if (!key) throw new Error(`missing ${keyEnv} in environment/.env`);
  return { base, key };
}

function gitBlobHash(data: Buffer): string {
  return createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${data.length}\0`), data])).digest("hex");
}

function trackedSourceFiles(): string[] {
  // git ls-files enumerates tracked files only, so node_modules/ and build
  // output never appear here. Two globs cover both TS dialects.
  const out = execFileSync("git", ["-C", ROOT, "ls-files", "*.ts", "*.tsx"], { encoding: "utf8" });
  return out
    .split("\n")
    .filter((f) => f && existsSync(ROOT + f));
}

// ---------------------------------------------------------------- tree-sitter

function nodeText(src: string, node: { startIndex: number; endIndex: number }): string {
  return src.slice(node.startIndex, node.endIndex);
}

function docstringOf(src: string, bodyNode: { namedChildren: unknown[] } | null | undefined): string | null {
  // TS/TSX have no docstring; we approximate the "first leading comment" via the
  // child comment node directly above a def. The grammar exposes comments as
  // named children of the program, so we leave doc null here. Kept in the row
  // schema so the map stays readable and the seam mirrors agency.
  return null;
}

function signatureOf(src: string, defNode: { startIndex: number; childForFieldName(name: string): { startIndex: number } | null }): string {
  const body = defNode.childForFieldName("body");
  const end = body ? body.startIndex : defNode.startIndex + 0;
  return src
    .slice(defNode.startIndex, end)
    .replace(/:\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// TreeNode-like accessors — typed as a structural interface so we don't have to
// import the underlying type.
interface TSNode {
  type: string;
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildren: TSNode[];
  childForFieldName(name: string): TSNode | null;
  text: string;
}

function extractSymbols(src: string, tree: { rootNode: TSNode }): Symbol[] {
  const symbols: Symbol[] = [];

  // For an `export` wrapper node, return the inner definition node (the thing
  // being exported) and a synthetic name for default exports. Returns null if
  // the wrapper has no exportable definition worth indexing.
  const unwrapExport = (child: TSNode): { inner: TSNode; synthName?: string } | null => {
    if (child.type !== "export_statement" && child.type !== "export_default_declaration") return { inner: child };
    // The grammar wraps `export default <expr>` as an export_statement whose
    // first named child is the expression (there is no dedicated
    // export_default_declaration node here). Treat that shape as a default
    // export whose inner is the expression — index call/identifier/arrow/etc.
    const first = child.namedChildren[0];
    if (!first) return null;
    // explicit named export (`export function ...`, `export const ...`)
    if (child.type === "export_statement" && ["function_declaration", "class_declaration", "lexical_declaration", "variable_declaration"].includes(first.type)) {
      return { inner: first };
    }
    // export default <expr> — expr is a call/identifier/arrow/ternary/etc.
    const exprTypes = ["call_expression", "identifier", "arrow_function", "ternary_expression", "new_expression", "binary_expression"];
    if (exprTypes.includes(first.type)) {
      return { inner: first, synthName: "default" };
    }
    // export_default_declaration (older grammar shape) — expr-style.
    if (child.type === "export_default_declaration") {
      if (exprTypes.includes(first.type)) return { inner: first, synthName: "default" };
      if (["function_declaration", "class_declaration"].includes(first.type)) return { inner: first };
    }
    return null;
  };

  const push = (child: TSNode, kind: SymbolKind, name: string, target: TSNode, signature: string): void => {
    symbols.push({
      kind,
      name,
      signature,
      doc: null,
      source: nodeText(src, child).slice(0, MAX_CHUNK_CHARS),
      startLine: child.startPosition.row + 1,
      endLine: child.endPosition.row + 1,
    });
  };

  const visit = (node: TSNode, className: string | null): void => {
    for (const child of node.namedChildren) {
      if (child.type === "decorator") continue;
      const unwrapped = unwrapExport(child);
      if (!unwrapped) continue;
      const target = unwrapped.inner;
      const synthName = unwrapped.synthName;

      if (target.type === "function_declaration" || target.type === "arrow_function") {
        const rawName = target.childForFieldName("name")?.text ?? "<anon>";
        const name =
          target.type === "arrow_function" && rawName === "<anon>"
            ? (child.type === "lexical_declaration" || child.type === "variable_declaration"
                ? child.namedChildren.find((n) => n.type === "variable_declarator")?.childForFieldName("name")?.text ?? "<anon>"
                : synthName ?? "<anon>")
            : rawName;
        const qualname = className ? `${className}.${name}` : name;
        push(child, className ? "method" : target.type === "arrow_function" ? "arrow" : "function", qualname, target, signatureOf(src, target));
      } else if (target.type === "class_declaration") {
        const name = target.childForFieldName("name")?.text ?? "<anon>";
        push(child, "class", name, target, signatureOf(src, target));
        // Recurse into the class body to capture method_definition members.
        const body = target.childForFieldName("body");
        if (body) {
          for (const member of body.namedChildren) {
            if (member.type === "method_definition") {
              const memberName = member.childForFieldName("name")?.text ?? "<anon>";
              push(member, "method", `${name}.${memberName}`, member, signatureOf(src, member));
            }
          }
        }
      } else if (
        (target.type === "lexical_declaration" || target.type === "variable_declaration") &&
        (child.type === "export_statement" || child.type === "export_default_declaration" || node.type === "program")
      ) {
        // Index module-level `const X = ...` exports: object literals and
        // call expressions (defineTool({...})) are the public API of many
        // tool files. Only index when the value is non-trivial (object,
        // call, arrow, function).
        for (const declarator of target.namedChildren.filter((n) => n.type === "variable_declarator")) {
          const nameNode = declarator.childForFieldName("name");
          const init = declarator.childForFieldName("value");
          if (!nameNode || !init) continue;
          if (!["object", "call_expression", "arrow_function", "new_expression"].includes(init.type)) continue;
          const sig = `const ${nameNode.text} = ${signaturePreview(init)}`;
          push(child, init.type === "arrow_function" ? "arrow" : "value", nameNode.text, declarator, sig);
        }
      } else if (synthName === "default") {
        // export default <expr>: capture the default export as one symbol
        // whose source is the full export statement and whose signature is
        // the (truncated) inner expression. call_expression (defineTool),
        // identifier, ternary, arrow — they all flow here.
        push(child, "value", "default", target, signaturePreview(target));
      }
    }
  };

  visit(tree.rootNode, null);
  return symbols;
}

// First-line preview of an initializer expression, truncated. Keeps the map
// legible without dumping multi-line object bodies.
function signaturePreview(node: TSNode): string {
  const text = node.text.replace(/\s+/g, " ").trim();
  return text.length > 80 ? text.slice(0, 77) + "..." : text;
}

function parseFile(parser: { parse(src: string): { rootNode: TSNode } | null }, path: string): { moduleDoc: string | null; symbols: Symbol[] } {
  const src = readFileSync(path, "utf8");
  const tree = parser.parse(src);
  if (!tree) return { moduleDoc: null, symbols: [] };
  return { moduleDoc: docstringOf(src, tree.rootNode), symbols: extractSymbols(src, tree) };
}

// ------------------------------------------------------------------ repo map

function renderMap(perFile: Record<string, FileMap>): string {
  const lines: string[] = [
    "# Luna repo map — tree-sitter skeletons (generated, disposable)",
    `# files: ${Object.keys(perFile).length}  |  regenerate: pnpm index`,
    "",
  ];
  for (const rel of Object.keys(perFile).sort()) {
    const entry = perFile[rel];
    if (!entry) continue;
    lines.push(rel);
    if (entry.moduleDoc) lines.push(`  """${entry.moduleDoc}"""`);
    for (const sym of entry.symbols) {
      const indent = sym.kind === "method" ? "    " : "  ";
      lines.push(`${indent}${sym.signature}`);
      if (sym.doc) lines.push(`${indent}  # ${sym.doc}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------- embeddings

function batchByChars(texts: string[]): string[][] {
  const batches: string[][] = [[]];
  let used = 0;
  for (const text of texts) {
    const size = text.length;
    const head = batches[0];
    if (head && head.length && used + size > BATCH_CHAR_BUDGET) {
      batches.push([]);
      used = 0;
    }
    const tail = batches[batches.length - 1];
    if (tail) tail.push(text);
    used += size;
  }
  return batches.filter((b) => b.length);
}

async function embedTexts(base: string, key: string, texts: string[], pace = true): Promise<Float32Array[]> {
  const vectors: Float32Array[] = [];
  const batches = batchByChars(texts);
  let resp: { data: { index: number; embedding: number[] }[] } | undefined;
  for (let i = 0; i < batches.length; i++) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      resp = await fetch(`${base}/embeddings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBED_MODEL, input: batches[i] }),
      })
        .then(async (r) => {
          if (r.ok) return (await r.json()) as { data: { index: number; embedding: number[] }[] };
          const body = await r.text();
          if ((r.status === 429 || body.toLowerCase().includes("rate limit")) && attempt < MAX_RETRIES - 1) {
            const wait = BATCH_INTERVAL_S * (attempt + 1);
            console.log(`  batch ${i + 1}/${batches.length}: rate limited, retrying in ${wait.toFixed(0)}s`);
            await new Promise((res) => setTimeout(res, wait * 1000));
            return undefined as unknown as never;
          }
          throw new Error(`embed ${r.status}: ${body.slice(0, 200)}`);
        });
      if (resp) break;
    }
    if (!resp) throw new Error("embed: no response");
    resp.data
      .sort((a, b) => a.index - b.index)
      .forEach((item) => vectors.push(Float32Array.from(item.embedding)));
    if (pace && i + 1 < batches.length) {
      console.log(`  batch ${i + 1}/${batches.length} done (${vectors.length}/${texts.length} chunks)`);
      await new Promise((res) => setTimeout(res, BATCH_INTERVAL_S * 1000));
    }
  }
  return vectors;
}

function chunkRows(rel: string, blob: string, symbols: Symbol[]): Row[] {
  return symbols.map((sym) => ({
    id: `${rel}::${sym.name}::${blob.slice(0, 12)}`,
    file: rel,
    kind: sym.kind,
    name: sym.name,
    signature: sym.signature,
    start_line: sym.startLine,
    end_line: sym.endLine,
    text: sym.source.slice(0, MAX_CHUNK_CHARS),
  }));
}

// Use the real library types for LanceDB — a hand-rolled structural shim
// drifts from createTable's overloaded signature (Record<string, unknown>[])
// and .add()'s generic `Data` constraint.
function sqlQuote(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

async function lanceTable(db: LanceConnection): Promise<LanceTable | null> {
  const names = await db.tableNames();
  return names.includes(TABLE_NAME) ? await db.openTable(TABLE_NAME) : null;
}

// -------------------------------------------------------------------- index

interface Args {
  mapOnly: boolean;
  query: string | null;
  top: number;
  stats: boolean;
  keyEnv: string;
}

async function runIndex(args: Args): Promise<number> {
  const started = Date.now();
  mkdirSync(POOL_PATH, { recursive: true });
  const manifest = existsSync(MANIFEST_PATH)
    ? (JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as ManifestFile)
    : { embedded: {}, embed_model: EMBED_MODEL };
  const embeddedHashes = manifest.embedded ?? {};

  // Load both tree-sitter dialect wamms and route per extension. The
  // @vscode/tree-sitter-wasm package ships prebuilt wams in the web-tree-sitter
  // 0.26-compatible dylink format; tree-sitter-wasms does not.
  const { Parser, Language } = await import("web-tree-sitter");
  await Parser.init();
  const tsWasm = fileURLToPath(new URL("node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm", ROOT_URL));
  const tsxWasm = fileURLToPath(new URL("node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-tsx.wasm", ROOT_URL));
  const tsLang = await Language.load(tsWasm);
  const tsxLang = await Language.load(tsxWasm);

  const perFile: Record<string, FileMap> = {};
  const newHashes: Record<string, string> = {};
  const changed: string[] = [];

  for (const rel of trackedSourceFiles()) {
    const data = readFileSync(ROOT + rel);
    const blob = gitBlobHash(data);
    newHashes[rel] = blob;
    const parser = new Parser();
    parser.setLanguage(rel.endsWith(".tsx") ? tsxLang : tsLang);
    const parsed = parseFile(parser, ROOT + rel);
    perFile[rel] = { ...parsed, blob };
    if (embeddedHashes[rel] !== blob) changed.push(rel);
  }
  const removed = Object.keys(embeddedHashes).filter((rel) => !(rel in newHashes));

  writeFileSync(MAP_PATH, renderMap(perFile), "utf8");
  const totalSymbols = Object.values(perFile).reduce((sum, e) => sum + e.symbols.length, 0);
  console.log(`repo map: ${Object.keys(perFile).length} files, ${totalSymbols} symbols -> .tmp/context-pools/repo_map.txt`);

  if (!args.mapOnly && (changed.length || removed.length)) {
    const lancedb = await import("@lancedb/lancedb");
    const { base, key } = gatewayConfig(args.keyEnv);
    const db = await lancedb.connect(LANCE_DIR);
    const tbl = await lanceTable(db);
    const stale = [...changed, ...removed];
    if (tbl && stale.length) {
      const predicate = `file IN (${stale.map(sqlQuote).join(", ")})`;
      await tbl.delete(predicate);
    }
    const rows: Row[] = [];
    for (const rel of changed) {
      const entry = perFile[rel];
      if (entry) rows.push(...chunkRows(rel, entry.blob, entry.symbols));
    }
    if (rows.length) {
      const vectors = await embedTexts(base, key, rows.map((r) => r.text));
      rows.forEach((r, i) => (r.vector = vectors[i]));
      const payload = rows as unknown as Record<string, unknown>[];
      if (!tbl) {
        await db.createTable(TABLE_NAME, payload, { mode: "overwrite" });
      } else {
        await tbl.add(payload);
      }
      console.log(`lance: ${rows.length} chunks embedded (${changed.length} changed, ${removed.length} removed files)`);
    }
  } else if (args.mapOnly) {
    console.log("lance: skipped (--map-only)");
  } else {
    console.log("lance: up to date (no file changes)");
  }

  // Manifest reflects the current tree (newHashes) regardless of whether any
  // embeddings ran — a map-only run still marks the parsed files so the next
  // `pnpm index` only embeds the diff. embed_model is recorded for traceability.
  const embeddedManifest: ManifestFile = { embedded: newHashes, embed_model: EMBED_MODEL };
  writeFileSync(MANIFEST_PATH, JSON.stringify(embeddedManifest, null, 2), "utf8");
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return 0;
}

async function runQuery(args: Args): Promise<number> {
  const lancedb = await import("@lancedb/lancedb");
  const { base, key } = gatewayConfig(args.keyEnv);
  const db = await lancedb.connect(LANCE_DIR);
  const tbl = await lanceTable(db);
  if (!tbl) throw new Error("no index yet — run: pnpm index");
  const vector = (await embedTexts(base, key, [args.query as string], false))[0];
  if (!vector) throw new Error("embed: empty response for query");
  // tbl.search(...) returns VectorQuery | Query; vectorSearch always returns
  // VectorQuery so .distanceType is available without a runtime shape test.
  const hits = await tbl.vectorSearch(vector).distanceType("cosine").limit(args.top).toArray();
  for (const hit of hits as { _distance: number; file: string; start_line: number; kind: string; name: string; signature: string }[]) {
    const score = 1 - hit._distance;
    console.log(`${score.toFixed(3)}  ${hit.file}:${hit.start_line}  [${hit.kind}] ${hit.name}`);
    console.log(`       ${hit.signature.slice(0, 120)}`);
  }
  return 0;
}

async function runStats(): Promise<number> {
  const manifest = existsSync(MANIFEST_PATH)
    ? (JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as ManifestFile)
    : { embedded: {}, embed_model: EMBED_MODEL };
  console.log(`manifest files: ${Object.keys(manifest.embedded ?? {}).length}`);
  console.log(`repo map: ${existsSync(MAP_PATH) ? readFileSync(MAP_PATH, "utf8").length : 0} bytes`);
  if (existsSync(LANCE_DIR)) {
    const lancedb = await import("@lancedb/lancedb");
    const db = await lancedb.connect(LANCE_DIR);
    const tbl = await lanceTable(db);
    console.log(`lance rows: ${tbl ? await tbl.countRows() : 0}`);
  } else {
    console.log("lance rows: 0 (no table)");
  }
  return 0;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { mapOnly: false, query: null, top: 8, stats: false, keyEnv: "AGENCY_GATEWAY_API_KEY" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--map-only") args.mapOnly = true;
    else if (arg === "--query") args.query = argv[++i] ?? null;
    else if (arg === "--top") args.top = Number.parseInt(argv[++i] ?? "8", 10);
    else if (arg === "--stats") args.stats = true;
    else if (arg === "--key-env") args.keyEnv = argv[++i] ?? "AGENCY_GATEWAY_API_KEY";
    else if (arg === "--help" || arg === "-h") {
      console.log(`usage: pnpm index [--map-only|--query "str" --top N --key-env KEY|--stats]`);
      process.exit(0);
    } else console.error(`unknown flag: ${arg}`);
  }
  return args;
}

async function main(): Promise<number> {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  if (args.stats) return runStats();
  if (args.query) return runQuery(args);
  return runIndex(args);
}

main().then(process.exit).catch((err: unknown) => {
  const msg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ""}` : String(err);
  console.error(msg);
  process.exit(1);
});
