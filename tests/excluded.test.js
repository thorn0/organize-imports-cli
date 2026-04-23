import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./run-cli.js";

test("explicit file args bypass tsconfig exclude", () => {
  const { status, stdout, stderr, write } = runCli("cli/exclude", [
    "included.ts",
    "excluded.ts",
  ]);

  assert.equal(status, 0);
  assert.equal(stderr, "");
  assert.match(stdout, /included\.ts \(modified\)/);
  assert.match(stdout, /excluded\.ts \(modified\)/);

  const byName = Object.fromEntries(write.map((w) => [w.filename, w.content]));
  assert.deepEqual(Object.keys(byName).sort(), ["excluded.ts", "included.ts"]);
  assert.equal(
    byName["included.ts"],
    `import { log } from "./util";\n\nlog("bar");\n`,
  );
  assert.equal(
    byName["excluded.ts"],
    `import { log } from "./util";\n\nlog("foo");\n`,
  );
});
