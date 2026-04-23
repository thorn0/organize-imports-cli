import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./run-cli.js";

test("preserves leading-comment groups", () => {
  const { status, stdout, stderr, write } = runCli("cli/grouped", ["file.js"]);

  assert.equal(status, 0);
  assert.equal(stderr, "");
  assert.match(stdout, /file\.js \(modified\)/);

  // The fixture is committed with CRLF endings; with no .editorconfig in the
  // tmpdir the CLI preserves that style.
  assert.deepEqual(write, [
    {
      filename: "file.js",
      content: `// fs\r\nimport fs from "fs";\r\n// other\r\nimport path from "path";\r\nimport util from "util";\r\n\r\nconsole.log(path, fs, util);\r\n`,
    },
  ]);
});
