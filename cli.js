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
  main(process.argv.slice(2));
}

function main(filePaths) {
  console.log(chalk`{yellowBright Organizing imports...}`);

  const projects = {};
  let adHocProjectCounter = 0;

  for (const filePath of filePaths) {
    const tsConfigFilePath = tsconfig.findSync(path.dirname(filePath));

    if (projects[tsConfigFilePath]) {
      projects[tsConfigFilePath].filePaths.push(filePath);
    } else {
      const ec = editorconfig.parseSync(filePath);
      const manipulationSettings = getManipulationSettings(ec);
      if (!tsConfigFilePath) {
        const adHocProject = new Project({
          manipulationSettings,
          compilerOptions: { allowJs: true }
        });
        adHocProject.addExistingSourceFile(filePath);
        projects[adHocProjectCounter++] = {
          filePaths: [filePath],
          project: adHocProject,
          detectNewLineKind: !!ec.end_of_line
        };
      } else {
        projects[tsConfigFilePath] = {
          filePaths: [filePath],
          project: new Project({ tsConfigFilePath, manipulationSettings }),
          processAllFiles:
            path.basename(filePath).toLowerCase() === "tsconfig.json",
          detectNewLineKind: !!ec.end_of_line
        };
      }
    }
  }

  for (const {
    filePaths,
    project,
    processAllFiles,
    detectNewLineKind
  } of Object.values(projects)) {
    const sourceFiles = processAllFiles
      ? project.getSourceFiles()
      : filePaths.map(filePath => project.getSourceFile(filePath));

    let changeCounter = 0,
      crLfWeight = 0;

    for (const sourceFile of sourceFiles) {
      process.stdout.write(chalk`{gray ${sourceFile.getFilePath()}}`);

      const fullText = sourceFile.getFullText();

      if (fullText.includes("// organize-imports-ignore")) {
        console.log(" (skipped)");
        continue;
      }

      if (detectNewLineKind) {
        crLfWeight += fullText.includes("\r\n") ? 1 : -1;
      }

      sourceFile.organizeImports();

      if (fullText === sourceFile.getFullText()) {
        console.log("");
      } else {
        changeCounter++;
        console.log(`\r${sourceFile.getFilePath()} (modified)`);
      }
    }

    if (changeCounter > 0) {
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

  console.log(chalk`{yellowBright Done!}`);
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
Usage: organize-imports-cli files...

Files can be specific {yellow ts} and {yellow js} files or {yellow tsconfig.json}, in which case the whole project is processed.

Files containing the substring "{yellow // organize-imports-ignore}" are skipped.
`);
}
