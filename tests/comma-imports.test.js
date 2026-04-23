import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./run-cli.js";

test("does not rewrite already-organized comma-separated named imports", () => {
  const { status, stdout, stderr, write } = runCli("cli/comma-imports", [
    "file.js",
  ]);

  assert.equal(status, 0);
  assert.equal(stderr, "");
  assert.doesNotMatch(stdout, /\(modified\)/);
  assert.deepEqual(write, []);
});
