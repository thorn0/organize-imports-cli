const runCli = require("./run-cli");

describe("with --ignore-punctuation", () => {
  runCli("cli/punctuation", ["--list-different", "--ignore-punctuation", "file1.js", "file2.js"]).test();
});

describe("without --ignore-punctuation", () => {
    runCli("cli/punctuation", ["--list-different", "file1.js", "file2.js"]).test();
  });
  