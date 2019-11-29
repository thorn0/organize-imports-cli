const runCli = require("./run-cli");

describe("exclude in tsconfig", () => {
  runCli("cli/exclude", ["included.ts", "excluded.ts"]).test();
});
