import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./run-cli.js";

// When a tsconfig arg expands to a set of files and one of those files is also
// passed explicitly, the CLI must process it once — not once per occurrence.
test("file appearing in both a tsconfig and an explicit arg is processed once", () => {
  const { status, stderr, stdout, write } = runCli("cli/dedup", [
    "tsconfig.json",
    "main.js",
  ]);

  assert.equal(status, 0);
  assert.equal(stderr, "");

  const modifiedLines = stdout.match(/main\.js \(modified\)/g) ?? [];
  assert.equal(modifiedLines.length, 1, stdout);

  assert.equal(write.length, 1);
  assert.equal(write[0].filename, "main.js");
});
