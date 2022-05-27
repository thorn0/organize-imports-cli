const runCli = require("./run-cli");

describe("grouped imports", () => {
  runCli("cli/grouped", ["file.js"]).test();
});
