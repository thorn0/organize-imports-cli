import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./run-cli.js";

test("organizes imports in a single file", () => {
  const { status, stdout, stderr, write } = runCli("cli/first", ["file1.js"]);

  assert.equal(status, 0);
  assert.equal(stderr, "");
  assert.equal(stdout, "Organizing imports...\nfile1.js (modified)\nDone!\n");

  assert.deepEqual(write, [
    {
      filename: "file1.js",
      content: `import path from "path";\n\nconsole.log(path.resolve("."));\n`,
    },
  ]);
});
