import { defineState } from "eve/context";
import { minimatch } from "minimatch";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants, promises as fs } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, normalize, relative, resolve as resolvePath } from "node:path";
import { z } from "zod";

/**
 * Host-native implementations for Luna's built-in file/shell tools.
 *
 * These replace the sandbox-backed defaults so the agent operates directly on
 * the developer machine / deployment host. Paths are resolved against the
 * host filesystem; "$HOME/" expansion works exactly like the default tools.
 */

interface ReadFileStamp {
  byteLength: number;
  contentHash: string;
  filePath: string;
}

const readFileState = defineState<Record<string, ReadFileStamp | undefined>>(
  "host-tools.read-file-state",
  () => ({}),
);

const MAX_LINE_LENGTH = 2000;
const READ_FILE_MAX_LINES = 2000;
const BASH_MAX_BUFFER = 1024 * 1024; // 1 MiB stdout/stderr each

export const bashInputSchema = z.strictObject({
  command: z.string().describe("The shell command to execute."),
});

export const bashOutputSchema = z.strictObject({
  exitCode: z.number(),
  stderr: z.string(),
  stdout: z.string(),
  truncated: z.boolean(),
});

export const readFileInputSchema = z.strictObject({
  filePath: z
    .string()
    .describe("The absolute path to the file to read. A leading $HOME is supported."),
  limit: z
    .number()
    .int()
    .min(1)
    .describe("Maximum number of lines to return. Defaults to 2000.")
    .optional(),
  offset: z
    .number()
    .int()
    .min(1)
    .describe("1-based line number to start from. Defaults to 1.")
    .optional(),
});

export const readFileOutputSchema = z.strictObject({
  content: z.string(),
  nextOffset: z.number().int().min(1).optional(),
  path: z.string(),
  totalLines: z.number().int().min(0),
  truncated: z.boolean(),
});

export const writeFileInputSchema = z.strictObject({
  content: z.string().describe("Complete replacement file contents."),
  filePath: z
    .string()
    .describe("The absolute path to the file to write. A leading $HOME is supported."),
});

export const writeFileOutputSchema = z.strictObject({
  existed: z.boolean(),
  path: z.string(),
});

export const globInputSchema = z.strictObject({
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .describe("Maximum number of results to return. Defaults to 100.")
    .optional(),
  path: z
    .string()
    .describe(
      "The directory to search in. Defaults to /workspace. Must be an absolute path or begin with $HOME/. Omit to use the default.",
    )
    .optional(),
  pattern: z
    .string()
    .describe('The glob pattern to match files against (e.g. "**/*.ts", "src/**/*.js").'),
});

export const globOutputSchema = z.strictObject({
  content: z.string(),
  count: z.number().int(),
  path: z.string(),
  truncated: z.boolean(),
});

export const grepInputSchema = z.strictObject({
  context: z
    .number()
    .int()
    .min(0)
    .describe(
      "Number of surrounding context lines to include before and after each match. Defaults to 0.",
    )
    .optional(),
  glob: z.string().describe('Filter files by glob pattern (e.g. "*.ts", "*.{ts,tsx}").').optional(),
  ignoreCase: z
    .boolean()
    .describe("Perform case-insensitive search. Defaults to false.")
    .optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .describe("Maximum number of matches to return per file. Defaults to 100.")
    .optional(),
  literal: z
    .boolean()
    .describe(
      "Treat the pattern as a literal string instead of a regular expression. Defaults to false.",
    )
    .optional(),
  path: z
    .string()
    .describe(
      "The directory or file to search in. Defaults to /workspace. Must be an absolute path or begin with $HOME/. Omit to use the default.",
    )
    .optional(),
  pattern: z
    .string()
    .describe(
      'The regex pattern to search for in file contents (e.g. "log.*Error", "function\\s+\\w+").',
    ),
});

export const grepOutputSchema = z.strictObject({
  content: z.string(),
  matchCount: z.number().int(),
  path: z.string(),
  truncated: z.boolean(),
});

export type BashInput = z.infer<typeof bashInputSchema>;
export type BashOutput = z.infer<typeof bashOutputSchema>;
export type ReadFileInput = z.infer<typeof readFileInputSchema>;
export type ReadFileOutput = z.infer<typeof readFileOutputSchema>;
export type WriteFileInput = z.infer<typeof writeFileInputSchema>;
export type WriteFileOutput = z.infer<typeof writeFileOutputSchema>;
export type GlobInput = z.infer<typeof globInputSchema>;
export type GlobOutput = z.infer<typeof globOutputSchema>;
export type GrepInput = z.infer<typeof grepInputSchema>;
export type GrepOutput = z.infer<typeof grepOutputSchema>;

function normalizeModelPath(p: string): string {
  return normalize(p).replace(/\\/g, "/");
}

function resolveHostPath(filePath: string): string {
  if (filePath.startsWith("$HOME/")) {
    return resolvePath(homedir(), filePath.slice(6));
  }
  return resolvePath(filePath);
}

function createContentStamp(content: string, filePath: string): ReadFileStamp {
  return {
    byteLength: Buffer.byteLength(content, "utf8"),
    contentHash: createHash("sha256").update(content, "utf8").digest("hex"),
    filePath,
  };
}

function truncateLine(line: string): { text: string; truncated: boolean } {
  if (line.length <= MAX_LINE_LENGTH) {
    return { text: line, truncated: false };
  }
  return { text: line.slice(0, MAX_LINE_LENGTH), truncated: true };
}

function prefixLines(
  lines: string[],
  startOffset: number,
): { content: string; truncated: boolean } {
  let truncated = false;
  const prefixed = lines.map((raw, index) => {
    const { text, truncated: lineTruncated } = truncateLine(raw);
    if (lineTruncated) truncated = true;
    return `${startOffset + index}: ${text}`;
  });
  return { content: prefixed.join("\n"), truncated };
}

function normalizeBashOutput(
  output: string,
  maxBytes: number,
): { text: string; truncated: boolean } {
  const bytes = Buffer.byteLength(output, "utf8");
  if (bytes <= maxBytes) {
    return { text: output, truncated: false };
  }
  const buffer = Buffer.from(output, "utf8").subarray(0, maxBytes);
  let text = buffer.toString("utf8");
  text = text.replace(/.$/u, "");
  return { text, truncated: true };
}

export async function executeBash(input: BashInput): Promise<BashOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.command, {
      shell: true,
      cwd: process.cwd(),
      env: process.env,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, 300_000); // 5 minutes hard ceiling for a single command

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      const rawStdout = Buffer.concat(stdoutChunks).toString("utf8");
      const rawStderr = Buffer.concat(stderrChunks).toString("utf8");
      const out = normalizeBashOutput(rawStdout, BASH_MAX_BUFFER);
      const err = normalizeBashOutput(rawStderr, BASH_MAX_BUFFER);
      resolve({
        exitCode: code ?? 0,
        stdout: out.text,
        stderr: err.text,
        truncated: out.truncated || err.truncated,
      });
    });
  });
}

export async function executeReadFile(input: ReadFileInput): Promise<ReadFileOutput> {
  const resolved = resolveHostPath(input.filePath);
  const normalized = normalizeModelPath(resolved);
  const raw = await fs.readFile(resolved, "utf8");
  const allLines = raw.split(/\r?\n/u);
  const totalLines = allLines.length;
  const offset = Math.max(1, input.offset ?? 1);
  const limit = Math.min(READ_FILE_MAX_LINES, input.limit ?? READ_FILE_MAX_LINES);
  const startIndex = offset - 1;
  const endIndex = Math.min(startIndex + limit, totalLines);
  const slice = allLines.slice(startIndex, endIndex);
  const { content, truncated: lineTruncated } = prefixLines(slice, offset);
  const truncated = lineTruncated || endIndex < totalLines;

  const stamp = createContentStamp(raw, normalized);
  readFileState.update((state) => ({ ...state, [normalized]: stamp }));

  return {
    content,
    nextOffset: endIndex < totalLines ? endIndex + 1 : undefined,
    path: normalized,
    totalLines,
    truncated,
  };
}

export async function executeWriteFile(input: WriteFileInput): Promise<WriteFileOutput> {
  const resolved = resolveHostPath(input.filePath);
  const normalized = normalizeModelPath(resolved);

  let existed = false;
  try {
    await fs.access(resolved, fsConstants.F_OK);
    existed = true;
  } catch {
    existed = false;
  }

  if (existed) {
    const currentRaw = await fs.readFile(resolved, "utf8");
    const currentStamp = createContentStamp(currentRaw, normalized);
    const storedStamp = readFileState.get()[normalized];

    if (storedStamp === undefined) {
      throw new Error(
        `You must read file ${input.filePath} before overwriting it. Use the read_file tool first.`,
      );
    }

    if (
      storedStamp.contentHash !== currentStamp.contentHash ||
      storedStamp.byteLength !== currentStamp.byteLength
    ) {
      throw new Error(
        `File ${input.filePath} has been modified since it was last read. Please read the file again before modifying it.`,
      );
    }

    await fs.writeFile(resolved, input.content, "utf8");
    readFileState.update((state) => ({
      ...state,
      [normalized]: createContentStamp(input.content, normalized),
    }));
    return { existed: true, path: normalized };
  }

  await fs.writeFile(resolved, input.content, "utf8");
  readFileState.update((state) => ({
    ...state,
    [normalized]: createContentStamp(input.content, normalized),
  }));
  return { existed: false, path: normalized };
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = resolvePath(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".eve") {
        continue;
      }
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

export async function executeGlob(input: GlobInput): Promise<GlobOutput> {
  const base = resolveHostPath(input.path ?? process.cwd());
  const limit = Math.min(1000, input.limit ?? 1000);
  const matches: string[] = [];
  let truncated = false;

  for await (const file of walk(base)) {
    const rel = normalizeModelPath(relative(base, file));
    const basenameMatch = minimatch(basename(file), input.pattern);
    const relativeMatch = minimatch(rel, input.pattern, { matchBase: true });
    if (basenameMatch || relativeMatch) {
      matches.push(normalizeModelPath(file));
      if (matches.length >= limit) {
        truncated = true;
        break;
      }
    }
  }

  return {
    content: matches.join("\n"),
    count: matches.length,
    path: normalizeModelPath(base),
    truncated,
  };
}

async function* filesToSearch(base: string, globFilter?: string): AsyncGenerator<string> {
  const stat = await fs.stat(base);
  if (stat.isFile()) {
    yield base;
    return;
  }
  for await (const file of walk(base)) {
    if (globFilter) {
      const rel = normalizeModelPath(relative(base, file));
      if (
        !minimatch(rel, globFilter, { matchBase: true }) &&
        !minimatch(basename(file), globFilter)
      ) {
        continue;
      }
    }
    yield file;
  }
}

export async function executeGrep(input: GrepInput): Promise<GrepOutput> {
  const base = resolveHostPath(input.path ?? process.cwd());
  const context = Math.min(10, Math.max(0, input.context ?? 0));
  const limitPerFile = Math.min(1000, input.limit ?? 1000);
  const regex = input.literal
    ? new RegExp(
        input.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        input.ignoreCase ? "giu" : "gu",
      )
    : new RegExp(input.pattern, input.ignoreCase ? "giu" : "gu");

  const lines: string[] = [];
  let totalMatches = 0;
  let truncated = false;

  for await (const file of filesToSearch(base, input.glob)) {
    if (
      file.endsWith(".png") ||
      file.endsWith(".jpg") ||
      file.endsWith(".jpeg") ||
      file.endsWith(".gif") ||
      file.endsWith(".webp") ||
      file.endsWith(".mp3") ||
      file.endsWith(".mp4")
    ) {
      continue;
    }

    let text: string;
    try {
      text = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }

    const fileLines = text.split(/\r?\n/u);
    let fileMatches = 0;

    for (let i = 0; i < fileLines.length; i++) {
      const line = fileLines[i] ?? "";
      if (!regex.test(line)) {
        regex.lastIndex = 0;
        continue;
      }
      regex.lastIndex = 0;

      fileMatches++;
      totalMatches++;

      const start = Math.max(0, i - context);
      const end = Math.min(fileLines.length, i + context + 1);
      for (let j = start; j < end; j++) {
        const marker = j === i ? ">" : " ";
        const display = truncateLine(fileLines[j] ?? "").text;
        lines.push(`${normalizeModelPath(file)}:${j + 1}:${marker} ${display}`);
      }

      if (fileMatches >= limitPerFile) {
        truncated = true;
        break;
      }
    }
  }

  return {
    content: lines.join("\n"),
    matchCount: totalMatches,
    path: normalizeModelPath(base),
    truncated,
  };
}

// Helper used by shell tools that need a temporary workspace directory on the host.
export function createTempDirectory(prefix = "luna-host-"): string {
  return resolvePath(tmpdir(), `${prefix}${randomUUID()}`);
}
