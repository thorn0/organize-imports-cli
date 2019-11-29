#!/usr/bin/env node

const {
    Project,
    IndentationText,
    NewLineKind,
    QuoteKind
  } = require("ts-morph"),
  tsconfig = require("tsconfig"),
  editorconfig = require("editorconfig"),
  chalk = require("chalk"),
  path = require("path");

if (process.argv.length < 3) {
  console.error("No files specified.");
  process.exit(1);
} else if (process.argv.includes("--help")) {
  printUsage();
} else {
  main(
    process.argv.slice(2).filter(arg => arg !== "--list-different"),
    process.argv.includes("--list-different")
  );
}

/**
 * @param {string[]} filePaths
 * @param {boolean} listDifferent
 */
function main(filePaths, listDifferent) {
  const logger = listDifferent
    ? {
        write() {},
        writeLine() {}
      }
    : {
        write: process.stdout.write.bind(process.stdout),
        writeLine: console.log.bind(console)
      };

  logger.writeLine(chalk`{yellowBright Organizing imports...}`);

  /**
   * @type {Record<string, {
   *   files: 'all' | import('ts-morph').SourceFile
   *   project: import('ts-morph').Project,
   *   detectNewLineKind: boolean,
   * }>}
   */
  const projects = {};
  let adHocProjectCounter = 0;

  for (const filePath of filePaths) {
    const tsConfigFilePath = tsconfig.findSync(path.dirname(filePath));
    const projectEntry = tsConfigFilePath && projects[tsConfigFilePath];

    if (projectEntry) {
      const sourceFile = projectEntry.project.getSourceFile(filePath);

      if (sourceFile) {
        if (projectEntry.files !== "all") {
          projectEntry.files.push(sourceFile);
        }
        continue;
      }
    }

    const ec = editorconfig.parseSync(filePath);
    const manipulationSettings = getManipulationSettings(ec);
    const detectNewLineKind = !!ec.end_of_line;

    if (tsConfigFilePath && !projectEntry) {
      const project = new Project({ tsConfigFilePath, manipulationSettings });

      if (path.basename(filePath).toLowerCase() === "tsconfig.json") {
        projects[tsConfigFilePath] = {
          files: "all",
          project,
          detectNewLineKind
        };
        continue;
      }

      const sourceFile = project.getSourceFile(filePath);

      if (sourceFile) {
        projects[tsConfigFilePath] = {
          files: [sourceFile],
          project,
          detectNewLineKind
        };
        continue;
      }
    }

    const adHocProject = new Project({
      manipulationSettings,
      compilerOptions: { allowJs: true }
    });

    projects["\0" + adHocProjectCounter++] = {
      files: [adHocProject.addExistingSourceFile(filePath)],
      project: adHocProject,
      detectNewLineKind
    };
  }

  for (const { files, project, detectNewLineKind } of Object.values(projects)) {
    const sourceFiles = files === "all" ? project.getSourceFiles() : files;

    let differentFiles = [],
      crLfWeight = 0;

    for (const sourceFile of sourceFiles) {
      logger.write(chalk`{gray ${sourceFile.getFilePath()}}`);

      const fullText = sourceFile.getFullText();

      if (fullText.includes("// organize-imports-ignore")) {
        logger.writeLine(" (skipped)");
        continue;
      }

      if (detectNewLineKind) {
        crLfWeight += fullText.includes("\r\n") ? 1 : -1;
      }

      const importsBefore = listDifferent && serializeImports(sourceFile);

      sourceFile.organizeImports();

      if (
        listDifferent
          ? importsBefore === serializeImports(sourceFile)
          : fullText === sourceFile.getFullText()
      ) {
        logger.writeLine("");
      } else {
        differentFiles.push(sourceFile.getFilePath());
        logger.writeLine(`\r${sourceFile.getFilePath()} (modified)`);
      }
    }

    if (differentFiles.length > 0) {
      if (listDifferent) {
        for (const filePath of differentFiles) {
          console.log(filePath);
        }
        process.exit(2);
      } else {
        if (crLfWeight !== 0) {
          project.manipulationSettings.set({
            newLineKind:
              crLfWeight > 0
                ? NewLineKind.CarriageReturnLineFeed
                : NewLineKind.LineFeed
          });
        }
        project.saveSync();
      }
    }
  }

  logger.writeLine(chalk`{yellowBright Done!}`);
}

function getManipulationSettings(ec) {
  return {
    indentationText:
      ec.indent_style === "tab"
        ? IndentationText.Tab
        : ec.tab_width === 2
        ? IndentationText.TwoSpaces
        : IndentationText.FourSpaces,
    newLineKind:
      ec.end_of_line === "crlf"
        ? NewLineKind.CarriageReturnLineFeed
        : NewLineKind.LineFeed,
    quoteKind: QuoteKind.Single
  };
}

function printUsage() {
  console.log(chalk`
Usage: organize-imports-cli [--list-different] files...

Files can be specific {yellow ts} and {yellow js} files or {yellow tsconfig.json}, in which case the whole project is processed.

Files containing the substring "{yellow // organize-imports-ignore}" are skipped.

The {yellow --list-different} flag prints a list of files with unorganized imports. No files are modified.
`);
}

/**
 * @param {import('ts-morph').SourceFile} sourceFile
 */
function serializeImports(sourceFile) {
  return sourceFile
    .getImportDeclarations()
    .map(importDeclaration => importDeclaration.getText())
    .join("")
    .replace(/'/g, '"')
    .replace(/\s+/g, "\t")
    .replace(/(\w)\t(\w)/g, "$1 $2")
    .replace(/\t/g, "");
}
