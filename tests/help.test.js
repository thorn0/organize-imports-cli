const runCli = require("./run-cli");

describe("--help", () => {
  runCli(".", ["--help"]).test();
});
