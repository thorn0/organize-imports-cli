#!/usr/bin/env node

import path from "node:path";
import chalk from "chalk";
import { parseSync as parseEditorConfig } from "editorconfig";
import ts from "typescript";

/** @type {Map<string, ts.CompilerOptions>} */
const compilerOptionsCache = new Map();

/**
 * @typedef {{ file: string, text: string, version: number, cwd: string }} ServiceState
 * @typedef {{ service: ts.LanguageService, state: ServiceState }} ServiceEntry
 */

/** @type {Map<string, ServiceEntry>} */
const languageServices = new Map();

if (process.argv.length < 3) {
  console.error("No files specified.");
  process.exit(1);
} else if (process.argv.includes("--help")) {
  printUsage();
} else {
  const args = process.argv.slice(2);
  main(
    args.filter((a) => a !== "--list-different"),
    args.includes("--list-different"),
  );
}

/**
 * @param {string[]} filePaths
 * @param {boolean} listDifferent
 */
function main(filePaths, listDifferent) {
  const noop = () => {};
  const write = listDifferent
    ? noop
    : process.stdout.write.bind(process.stdout);
  const writeLine = listDifferent ? noop : console.log.bind(console);

  writeLine(chalk.yellowBright("Organizing imports..."));

  /** @type {{filePath: string, content: string}[]} */
  const pendingWrites = [];
  let anyDifferent = false;

  for (const { filePath, tsconfigPath } of collectEntries(filePaths)) {
    write(chalk.gray(filePath));

    const original = ts.sys.readFile(filePath);
    if (original === undefined) {
      writeLine("");
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    if (original.includes("// organize-imports-ignore")) {
      writeLine(" (skipped)");
      continue;
    }

    const organized = organizeImports(filePath, original, tsconfigPath);
    const unchanged =
      original === organized ||
      (listDifferent &&
        serializeImports(original) === serializeImports(organized));

    if (unchanged) {
      writeLine("");
      continue;
    }

    anyDifferent = true;
    if (listDifferent) {
      console.log(filePath);
    } else {
      writeLine(" (modified)");
      pendingWrites.push({ filePath, content: organized });
    }
  }

  // Commit the batch only after every input was read and organized successfully
  // — one bad file must not leave earlier ones rewritten.
  for (const { filePath, content } of pendingWrites) {
    ts.sys.writeFile(filePath, content);
  }

  if (listDifferent && anyDifferent) process.exit(2);
  writeLine(chalk.yellowBright("Done!"));
}

/**
 * Expands any `tsconfig*.json` argument to the files it declares, tagged with
 * that tsconfig so its compiler options are used instead of ones rediscovered
 * by walking up from each file.
 * @param {string[]} paths
 * @returns {Generator<{filePath: string, tsconfigPath?: string}>}
 */
function* expandPaths(paths) {
  for (const p of paths) {
    if (/^tsconfig.*\.json$/i.test(path.basename(p))) {
      const { config } = ts.readConfigFile(p, ts.sys.readFile);
      const { fileNames, options } = ts.parseJsonConfigFileContent(
        config,
        ts.sys,
        path.dirname(p),
      );
      compilerOptionsCache.set(p, {
        ...options,
        allowJs: true,
        allowNonTsExtensions: true,
      });
      for (const filePath of fileNames) yield { filePath, tsconfigPath: p };
    } else {
      yield { filePath: p };
    }
  }
}

/**
 * Deduplicates entries by resolved path, preferring an occurrence tagged with
 * a tsconfig over a bare-path one regardless of argv order.
 * @param {string[]} paths
 * @returns {Iterable<{filePath: string, tsconfigPath?: string}>}
 */
function collectEntries(paths) {
  /** @type {Map<string, {filePath: string, tsconfigPath?: string}>} */
  const entries = new Map();
  for (const item of expandPaths(paths)) {
    const key = path.resolve(item.filePath);
    const existing = entries.get(key);
    if (!existing || (!existing.tsconfigPath && item.tsconfigPath)) {
      entries.set(key, item);
    }
  }
  return entries.values();
}

/**
 * @param {string} filePath
 * @param {string} fileContent
 * @param {string} [tsconfigPath] If set, used instead of auto-discovering one.
 * @returns {string}
 */
function organizeImports(filePath, fileContent, tsconfigPath) {
  tsconfigPath ??= ts.findConfigFile(path.dirname(filePath), ts.sys.fileExists);
  const compilerOptions = getCompilerOptions(tsconfigPath);
  const { formatOptions, userPreferences, explicitNewLine } =
    readFormatSettings(filePath, fileContent);

  const { service, state } = getLanguageService(tsconfigPath, compilerOptions);
  state.file = filePath;
  state.text = fileContent;
  state.cwd = path.dirname(filePath);
  state.version++;

  const [changes] = service.organizeImports(
    { type: "file", fileName: filePath },
    formatOptions,
    userPreferences,
  );

  const text = changes
    ? applyTextChanges(fileContent, changes.textChanges)
    : fileContent;

  // When editorconfig pins end_of_line, normalize the whole file to it;
  // otherwise unchanged regions stay byte-for-byte identical.
  if (!explicitNewLine) return text;
  const lf = text.replace(/\r\n/g, "\n");
  return explicitNewLine === "\r\n" ? lf.replace(/\n/g, "\r\n") : lf;
}

/**
 * One language service per tsconfig (keyed by path; `""` for no-tsconfig runs)
 * — reused across files so the heavy setup (lib.d.ts load, module resolution
 * cache) is paid once. The host reads state via closure so each call can swap
 * the current file, content, and cwd without rebuilding the service.
 * @param {string | undefined} tsconfigPath
 * @param {ts.CompilerOptions} compilerOptions
 * @returns {ServiceEntry}
 */
function getLanguageService(tsconfigPath, compilerOptions) {
  const key = tsconfigPath ?? "";
  const cached = languageServices.get(key);
  if (cached) return cached;

  /** @type {ServiceState} */
  const state = { file: "", text: "", version: 0, cwd: "" };
  /** @type {ts.LanguageServiceHost} */
  const host = {
    getScriptFileNames: () => [state.file],
    getScriptVersion: () => String(state.version),
    getScriptSnapshot: (fp) => {
      if (fp === state.file) return ts.ScriptSnapshot.fromString(state.text);
      const text = ts.sys.readFile(fp);
      return text === undefined
        ? undefined
        : ts.ScriptSnapshot.fromString(text);
    },
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: ts.getDefaultLibFileName,
    getCurrentDirectory: () => state.cwd,
    getNewLine: () => ts.sys.newLine,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    getDirectories: ts.sys.getDirectories,
    directoryExists: ts.sys.directoryExists,
  };
  const entry = { service: ts.createLanguageService(host), state };
  languageServices.set(key, entry);
  return entry;
}

/**
 * @param {string} text
 * @param {readonly ts.TextChange[]} changes
 * @returns {string}
 */
function applyTextChanges(text, changes) {
  for (const { span, newText } of [...changes].sort(
    (a, b) => b.span.start - a.span.start,
  )) {
    text =
      text.slice(0, span.start) +
      newText +
      text.slice(span.start + span.length);
  }
  return text;
}

/**
 * @param {string | undefined} tsconfigPath
 * @returns {ts.CompilerOptions}
 */
function getCompilerOptions(tsconfigPath) {
  if (!tsconfigPath) return { allowJs: true, allowNonTsExtensions: true };
  const cached = compilerOptionsCache.get(tsconfigPath);
  if (cached) return cached;
  const { config } = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    path.dirname(tsconfigPath),
  );
  const result = { ...options, allowJs: true, allowNonTsExtensions: true };
  compilerOptionsCache.set(tsconfigPath, result);
  return result;
}

/**
 * @param {string} filePath
 * @param {string} fileContent
 */
function readFormatSettings(filePath, fileContent) {
  const ec = parseEditorConfig(filePath);

  const explicitNewLine = /** @type {"\n" | "\r\n" | undefined} */ (
    { lf: "\n", crlf: "\r\n" }[/** @type {string} */ (ec.end_of_line)]
  );
  const newLineCharacter =
    explicitNewLine ?? (fileContent.includes("\r\n") ? "\r\n" : "\n");

  const tabWidth = typeof ec.tab_width === "number" ? ec.tab_width : 2;

  /** @type {ts.FormatCodeSettings} */
  const formatOptions = {
    ...ts.getDefaultFormatCodeSettings(newLineCharacter),
    convertTabsToSpaces: ec.indent_style !== "tab",
    tabSize: tabWidth,
    indentSize: typeof ec.indent_size === "number" ? ec.indent_size : tabWidth,
  };

  /** @type {ts.UserPreferences} */
  const userPreferences = { quotePreference: "single" };

  return { formatOptions, userPreferences, explicitNewLine };
}

/**
 * Canonicalizes just the import statements so pure whitespace/quote changes
 * don't count as "different" under --list-different.
 * @param {string} text
 */
function serializeImports(text) {
  const src = ts.createSourceFile("f.ts", text, ts.ScriptTarget.Latest);
  return src.statements
    .filter((s) => ts.isImportDeclaration(s) || ts.isImportEqualsDeclaration(s))
    .map((s) => s.getText(src))
    .join("")
    .replace(/['"`]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function printUsage() {
  const y = chalk.yellow;
  console.log(`
Usage: organize-imports-cli [--list-different] files...

Files can be specific ${y("ts")} and ${y("js")} files or ${y("tsconfig*.json")}, in which case the whole project is processed.

Files containing the substring "${y("// organize-imports-ignore")}" are skipped.

The ${y("--list-different")} flag prints a list of files with unorganized imports. No files are modified.
`);
}
