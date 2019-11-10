"use strict";

// Based on https://github.com/prettier/prettier/blob/master/tests_integration/runPrettier.js

const fs = require("fs");
const path = require("path");
const stripAnsi = require("strip-ansi");
const escapeStringRegexp = require("escape-string-regexp");

const rootDir = "../";
const pkg = require(path.join(rootDir, "package.json"));
const cli = path.join(rootDir, pkg.bin);

/**
 * @param {string} dir
 * @param {string[]=} args
 * @param {*=} options
 */
function runCli(dir, args = [], options = {}) {
  dir = normalizeDir(dir);

  let status;
  let stdout = "";
  let stderr = "";

  jest.spyOn(process, "exit").mockImplementation(exitCode => {
    if (status === undefined) {
      status = exitCode || 0;
    }
  });

  jest
    .spyOn(process.stdout, "write")
    .mockImplementation(text => appendStdout(text));

  jest
    .spyOn(process.stderr, "write")
    .mockImplementation(text => appendStderr(text));

  jest
    .spyOn(console, "log")
    .mockImplementation(text => appendStdout(text + "\n"));

  jest
    .spyOn(console, "warn")
    .mockImplementation(text => appendStderr(text + "\n"));

  jest
    .spyOn(console, "error")
    .mockImplementation(text => appendStderr(text + "\n"));

  jest.spyOn(Date, "now").mockImplementation(() => 0);

  const write = [];

  jest.spyOn(fs, "writeFileSync").mockImplementation((filename, content) => {
    write.push({
      filename: path.relative(dir, filename),
      content
    });
  });

  const origStatSync = fs.statSync;

  jest.spyOn(fs, "statSync").mockImplementation(filename => {
    if (path.basename(filename) === `virtualDirectory`) {
      return origStatSync(path.join(__dirname, __filename));
    }
    return origStatSync(filename);
  });

  const originalCwd = process.cwd();
  const originalArgv = process.argv;
  const originalExitCode = process.exitCode;
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  const originalEnv = process.env;

  process.chdir(dir);
  process.stdin.isTTY = !!options.isTTY;
  process.stdout.isTTY = !!options.stdoutIsTTY;
  process.argv = ["path/to/node", "path/to/bin"].concat(args);
  process.env = { ...process.env, ...options.env };

  jest.resetModules();

  try {
    require(cli);
    status = (status === undefined ? process.exitCode : status) || 0;
  } catch (error) {
    status = 1;
    stderr += error.message;
  } finally {
    process.chdir(originalCwd);
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    process.stdin.isTTY = originalStdinIsTTY;
    process.stdout.isTTY = originalStdoutIsTTY;
    process.env = originalEnv;
    jest.restoreAllMocks();
  }

  const result = { status, stdout, stderr, write };

  const testResult = (testOptions = {}) => {
    const dirRegExp = RegExp(`\\b${escapeStringRegexp(dir)}\\b`, "g");
    Object.keys(result).forEach(name => {
      test(`(${name})`, () => {
        const value =
          // \r is trimmed from jest snapshots by default;
          // manually replacing this character with /*CR*/ to test its true presence
          // If ignoreLineEndings is specified, \r is simply deleted instead
          typeof result[name] === "string"
            ? stripAnsi(result[name])
                .replace(/\r/g, options.ignoreLineEndings ? "" : "/*CR*/\n")
                .replace(dirRegExp, "<dir>")
            : result[name];
        if (name in testOptions) {
          if (name === "status" && testOptions[name] === "non-zero") {
            expect(value).not.toEqual(0);
          } else {
            expect(value).toEqual(testOptions[name]);
          }
        } else {
          expect(value).toMatchSnapshot();
        }
      });
    });

    return result;
  };

  return { test: testResult, ...result };

  function appendStdout(text) {
    if (status === undefined) {
      stdout += text;
    }
  }
  function appendStderr(text) {
    if (status === undefined) {
      stderr += text;
    }
  }
}

function normalizeDir(dir) {
  return path.resolve(__dirname, dir).replace(/\\/g, "/");
}

module.exports = runCli;
