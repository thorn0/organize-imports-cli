import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./run-cli.js";

test("glob pattern expands to matching files", () => {
  const { status, stderr, write } = runCli("cli/globs", ["src/**/*.ts"]);

  assert.equal(status, 0);
  assert.equal(stderr, "");
  assert.deepEqual(write.map((w) => w.filename).sort(), [
    "src/a.ts",
    "src/nested/b.ts",
  ]);
});

test("directory arg walks recursively for supported extensions", () => {
  const { status, stderr, write } = runCli("cli/globs", ["src"]);

  assert.equal(status, 0);
  assert.equal(stderr, "");
  assert.deepEqual(write.map((w) => w.filename).sort(), [
    "src/a.ts",
    "src/nested/b.ts",
    "src/other.js",
  ]);
});

test("dot as directory arg walks the current dir", () => {
  const { status, stderr, write } = runCli("cli/globs", ["."]);

  assert.equal(status, 0);
  assert.equal(stderr, "");
  assert.deepEqual(write.map((w) => w.filename).sort(), [
    "app/[slug]/page.ts",
    "src/a.ts",
    "src/nested/b.ts",
    "src/other.js",
  ]);
});

test("directory path containing glob metacharacters walks as a literal path", () => {
  const { status, stderr, write } = runCli("cli/globs", ["app/[slug]"]);

  assert.equal(status, 0);
  assert.equal(stderr, "");
  assert.deepEqual(
    write.map((w) => w.filename),
    ["app/[slug]/page.ts"],
  );
});

test("node_modules is skipped for glob patterns", () => {
  const { status, stderr } = runCli("cli/globs", ["**/dep.ts"]);

  assert.notEqual(status, 0);
  assert.match(stderr, /No files matching the pattern were found/);
});

test("glob matching nothing exits non-zero with an error", () => {
  const { status, stderr } = runCli("cli/globs", ["src/**/*.doesnotexist"]);

  assert.notEqual(status, 0);
  assert.match(stderr, /No files matching the pattern were found/);
  assert.match(stderr, /src\/\*\*\/\*\.doesnotexist/);
});

test("wildcard tsconfig path falls through to the glob branch", () => {
  const { status, stderr } = runCli("cli/globs", ["*/tsconfig.json"]);

  assert.notEqual(status, 0);
  assert.match(stderr, /No files matching the pattern were found/);
});
