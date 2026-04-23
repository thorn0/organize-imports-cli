import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(__dirname, "..", "cli.js");

const toPosix = /** @param {string} s */ (s) => s.replaceAll(path.sep, "/");

/**
 * Runs the CLI against a copy of the given fixture directory and returns
 * everything the tests care about: exit status, stdout, stderr, and a list of
 * files whose content the CLI rewrote.
 *
 * @param {string | null} fixtureDir Directory under `tests/` to copy into
 *   a tmpdir before running. Pass `null` when the CLI won't touch any files.
 * @param {string[]} [args]   Extra CLI args.
 */
export function runCli(fixtureDir, args = []) {
  const source =
    fixtureDir == null ? null : path.resolve(__dirname, fixtureDir);
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "organize-imports-cli-"),
  );

  try {
    if (source) {
      fs.cpSync(source, tmpDir, { recursive: true });
    }

    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: tmpDir,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    const write = [];
    if (source) {
      for (const entry of fs.readdirSync(tmpDir, {
        recursive: true,
        withFileTypes: true,
      })) {
        if (!entry.isFile()) continue;
        const rel = path.relative(
          tmpDir,
          path.join(entry.parentPath, entry.name),
        );
        const after = fs.readFileSync(path.join(tmpDir, rel), "utf8");
        const origPath = path.join(source, rel);
        const before = fs.existsSync(origPath)
          ? fs.readFileSync(origPath, "utf8")
          : null;
        if (after !== before) {
          write.push({ filename: toPosix(rel), content: after });
        }
      }
    }

    const scrub = /** @param {string} s */ (s) =>
      stripVTControlCharacters(toPosix(s)).replaceAll(toPosix(tmpDir), "<dir>");

    return {
      status: result.status,
      stdout: scrub(result.stdout),
      stderr: scrub(result.stderr),
      write,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
