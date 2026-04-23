import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./run-cli.js";

test("--list-different reports files and writes nothing", () => {
  const { status, stdout, stderr, write } = runCli("cli/different", [
    "--list-different",
    "file1.js",
    "file2.js",
  ]);

  assert.equal(status, 2);
  assert.equal(stderr, "");
  assert.deepEqual(write, []);
  assert.match(stdout, /\bfile1\.js\b/);
  assert.doesNotMatch(stdout, /\bfile2\.js\b/);
});
