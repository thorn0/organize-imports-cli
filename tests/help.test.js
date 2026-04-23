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
Usage: organize-imports-cli [--list-different] files...

Files can be specific ts and js files or tsconfig.json, in which case the whole project is processed.

Files containing the substring "// organize-imports-ignore" are skipped.

The --list-different flag prints a list of files with unorganized imports. No files are modified.

`,
  );
});
