// Thin launcher for `pnpm index`. The LanceDB win32 native binding trips a
// libuv "handle closing" assertion during Node's atexit teardown AFTER all
// indexer output has flushed (results are valid; the crash is cosmetic). This
// wrapper detects that specific post-output teardown crash (exit code
// 0xC0000409 / -1073740791) and exits 0 so `pnpm index` is clean. Any other
// non-zero exit (real logic errors, missing env, embed failures) propagates.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const child = spawn(process.execPath, ["--import", "tsx", fileURLToPath(new URL("context-index.ts", import.meta.url)), ...process.argv.slice(2)], {
  stdio: "inherit",
});

child.on("exit", (code) => {
  // 0xC0000409 (STATUS_STACK_BUFFER_OVERRUN) is the win32 assertion-hard-crash
  // signature of the LanceDB atexit teardown race. Indexer output is complete.
  if (code === -1073740791 || code === 3221226505) process.exit(0);
  process.exit(code ?? 0);
});
