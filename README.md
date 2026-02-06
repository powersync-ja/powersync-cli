# PowerSync CLI

Monorepo for the PowerSync CLI and related tooling. Built with [pnpm](https://pnpm.io) workspaces and [OCLIF](https://oclif.io).

## Requirements

- **Node**: LTS v24+ (see [.nvmrc](./.nvmrc); use `nvm use` to switch)
- **Package manager**: pnpm

## Packages

| Package                                                  | Description                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [**@powersync/cli**](./cli)                              | PowerSync CLI — manage instances, config, sync rules, and more                         |
| [**@powersync/cli-core**](./packages/cli-core)           | Core types and base commands shared by the CLI and plugins                             |
| [**@powersync/plugin-docker**](./packages/plugin-docker) | CLI plugin — run self-hosted PowerSync with Docker Compose (init, deploy, start, stop) |
| [**@powersync/cli-schemas**](./packages/schemas)         | Shared config schemas (link.yaml, service.yaml, etc.)                                  |

## Package structure

```
├── cli/                    # @powersync/cli — main CLI (commands, cloud/self-hosted)
├── packages/
│   ├── cli-core/           # @powersync/cli-core — base commands & YAML utils (used by CLI + plugins)
│   ├── plugin-docker/      # @powersync/plugin-docker — docker init, deploy, start, stop
│   └── schemas/            # @powersync/cli-schemas — config validation (LinkConfig, CLIConfig)
└── docs/
    ├── usage.md            # General CLI usage (Cloud, self-hosted, linking, auth)
    └── usage-docker.md     # Docker plugin only (init, deploy, start, stop)
```

- **cli** depends on **cli-core**, **plugin-docker**, and **schemas**. It loads the docker plugin and re-exports base command types from cli-core.
- **plugin-docker** depends on **cli-core** (and **schemas** via cli-core). No dependency on the CLI package, so there is no circular dependency.
- **cli-core** depends on **schemas**. It provides `SelfHostedInstanceCommand`, YAML helpers (`!env`), and shared types for plugins.

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

## Documentation

- [**Usage**](./docs/usage.md) — How the CLI works: Cloud and self-hosted, linking, auth, supplying instance info
- [**Usage (Docker)**](./docs/usage-docker.md) — Docker plugin only: init, deploy, start, stop, templates, flags
- [CLI package README](./cli/README.md) — Install, usage, and command reference
