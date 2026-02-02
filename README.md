# PowerSync CLI

Monorepo for the PowerSync CLI and related tooling. Built with [pnpm](https://pnpm.io) workspaces and [OCLIF](https://oclif.io).

## Requirements

- **Node**: LTS v24+ (see [.nvmrc](./.nvmrc); use `nvm use` to switch)
- **Package manager**: pnpm

## Packages

| Package                              | Description                                                    |
| ------------------------------------ | -------------------------------------------------------------- |
| [**@powersync/cli**](./packages/cli) | PowerSync CLI — manage instances, config, sync rules, and more |

## Getting started

```bash
nvm use          # use Node from .nvmrc (optional)
pnpm install
pnpm build
```

Run the CLI from the repo root:

```bash
pnpm powersync -- --help
pnpm exec powersync --help   # if @powersync/cli is a workspace dependency
```

## Links

- [CLI package README](./packages/cli/README.md) — install, usage, and command reference
