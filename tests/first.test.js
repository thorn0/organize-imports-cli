const runCli = require("./run-cli");

describe("The first Test", () => {
  runCli("cli/first", ["file1.js"]).test();
});
