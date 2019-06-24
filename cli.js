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
  console.log("Usage: organize-imports-cli files...");
} else {
  main(process.argv.slice(2));
}

function main(filePaths) {
  console.log(chalk`{yellowBright Organizing imports...}`);

  const projects = {};

  for (const filePath of filePaths) {
    const tsConfigFilePath = tsconfig.findSync(path.dirname(filePath));

    if (!tsConfigFilePath) {
      console.error(chalk`{redBright Cannot find tsconfig.json for ${filePath}}`);
      process.exit(2);
    }

    if (!projects[tsConfigFilePath]) {
      const manipulationSettings = getManipulationSettings(filePath);
      projects[tsConfigFilePath] = {
        filePaths: [filePath],
        project: new Project({ tsConfigFilePath, manipulationSettings }),
        processAllFiles:
          path.basename(filePath).toLowerCase() === "tsconfig.json"
      };
    } else {
      projects[tsConfigFilePath].filePaths.push(filePath);
    }
  }

  for (const [
    tsConfigFilePath,
    { filePaths, project, processAllFiles }
  ] of Object.entries(projects)) {
    console.log(chalk`{whiteBright Project:} ${tsConfigFilePath}`);

    const sourceFiles = processAllFiles
      ? project.getSourceFiles()
      : filePaths.map(filePath => project.getSourceFile(filePath));

    for (const sourceFile of sourceFiles) {
      process.stdout.write(chalk`{gray ${sourceFile.getFilePath()}}`);

      const fullText = sourceFile.getFullText();

      if (fullText.includes("// organize-imports-ignore")) {
        console.log(" (skipped)");
        continue;
      }

      sourceFile.organizeImports();

      console.log(
        fullText === sourceFile.getFullText()
          ? ""
          : `\r${sourceFile.getFilePath()} (modified)`
      );
    }

    project.saveSync();
  }

  console.log(chalk`{yellowBright Done!}`);
}

function getManipulationSettings(filePath) {
  const ec = editorconfig.parseSync(filePath);
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
