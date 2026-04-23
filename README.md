# organize-imports-cli

> VS Code's '[Organize imports](https://code.visualstudio.com/updates/v1_23#_javascript-and-typescript-organize-imports)' executable from command line

Plays nicely with [Prettier](https://prettier.io) and [lint-staged](https://github.com/okonet/lint-staged):

```json
"lint-staged": {
  "*.ts": [
    "organize-imports-cli",
    "prettier --write"
  ]
}
```

## Usage

```console
> organize-imports-cli [--list-different] paths...
```

Each path is one of:

- a `ts`/`js` file (and related extensions: `.tsx`, `.mts`, `.cts`, `.jsx`, `.mjs`, `.cjs`)
- a `tsconfig*.json` — the whole project is processed
- a directory — walked recursively for the extensions above
- a glob pattern — e.g. `'src/**/*.ts'` (quote it so the shell doesn't expand it)

Directory walks and glob patterns skip `node_modules`.

Files containing the substring `// organize-imports-ignore` are skipped.

The `--list-different` flag prints a list of files with unorganized imports. No files are modified.

## Requirements

Node.js ≥ 22.12.
