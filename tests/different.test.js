const runCli = require("./run-cli");

describe("--list-different", () => {
  runCli("cli/different", ["--list-different", "file1.js", "file2.js"]).test();
});
