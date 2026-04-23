import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./run-cli.js";

test("--help prints usage", () => {
  const { status, stdout, stderr, write } = runCli(null, ["--help"]);

  assert.equal(status, 0);
  assert.equal(stderr, "");
  assert.deepEqual(write, []);
  assert.equal(
    stdout,
    `
Usage: organize-imports-cli [--list-different] paths...

Each path is one of:
  - a ts/js file (and related extensions: .tsx, .mts, .cts, .jsx, .mjs, .cjs)
  - a tsconfig*.json — the whole project is processed
  - a directory — walked recursively for the extensions above
  - a glob pattern — e.g. 'src/**/*.ts' (quote it so the shell doesn't expand it)

Directory walks and glob patterns skip node_modules.

Files containing the substring "// organize-imports-ignore" are skipped.

The --list-different flag prints a list of files with unorganized imports. No files are modified.

`,
  );
});
