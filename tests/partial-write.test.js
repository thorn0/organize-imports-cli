import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./run-cli.js";

test("missing-file error does not leave earlier files rewritten", () => {
  const { status, stderr, write } = runCli("cli/partial-write", [
    "fileA.js",
    "missing.js",
  ]);

  assert.notEqual(status, 0);
  assert.match(stderr, /missing\.js/);
  assert.deepEqual(write, []);
});
