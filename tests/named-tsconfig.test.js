import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./run-cli.js";

// The fixture's base `tsconfig.json` is intentionally unparseable so any
// accidental fallback via `findConfigFile` would surface as a crash.
test("uses the user-selected tsconfig, not a rediscovered one", () => {
  const { status, stderr, write } = runCli("cli/named-tsconfig", [
    "tsconfig.build.json",
  ]);

  assert.equal(status, 0);
  assert.equal(stderr, "");
  assert.deepEqual(write, [
    {
      filename: "main.ts",
      content: `import path from "path";\n\nconsole.log(path.resolve("."));\n`,
    },
  ]);
});

test("tsconfig selection wins over an earlier bare arg for the same file", () => {
  const { status, stderr, write } = runCli("cli/named-tsconfig", [
    "main.ts",
    "tsconfig.build.json",
  ]);

  assert.equal(status, 0);
  assert.equal(stderr, "");
  assert.deepEqual(write, [
    {
      filename: "main.ts",
      content: `import path from "path";\n\nconsole.log(path.resolve("."));\n`,
    },
  ]);
});
