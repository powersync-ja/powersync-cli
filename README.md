# PowerSync CLI

Monorepo for the PowerSync CLI and related tooling. Built with [pnpm](https://pnpm.io) workspaces and [OCLIF](https://oclif.io).

## Requirements

- **Node**: LTS v24+ (see [.nvmrc](./.nvmrc); use `nvm use` to switch)
- **Package manager**: pnpm

## Packages

| Package                                                  | Description                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [**@powersync/cli**](./packages/cli)                     | PowerSync CLI — manage instances, config, sync rules, and more                         |
| [**@powersync/plugin-docker**](./packages/plugin-docker) | CLI plugin — run self-hosted PowerSync with Docker Compose (init, deploy, start, stop) |

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

### Self-hosted with Docker

From the repo root, scaffold and run a self-hosted PowerSync stack with Docker Compose:

```bash
pnpm powersync docker init --database postgres --storage postgres
pnpm powersync docker deploy
```

See [@powersync/plugin-docker](./packages/plugin-docker/README.md) for details.

## Links

- [CLI package README](./packages/cli/README.md) — install, usage, and command reference
