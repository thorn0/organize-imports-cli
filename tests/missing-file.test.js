import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./run-cli.js";

test("missing explicit file exits non-zero with an error", () => {
  const { status, stderr } = runCli("cli/first", ["does-not-exist.js"]);

  assert.notEqual(status, 0);
  assert.match(stderr, /does-not-exist\.js/);
});
