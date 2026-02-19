# PowerSync CLI

Monorepo for the PowerSync CLI and related tooling. Built with [pnpm](https://pnpm.io) workspaces and [OCLIF](https://oclif.io).

## Requirements

- **Node**: LTS v24+ (see [.nvmrc](./.nvmrc); use `nvm use` to switch)
- **Package manager**: pnpm

## Monorepo structure

The workspace is split into the main CLI, shared **packages**, and optional **plugins**:

| Package                                              | Path                 | Description                                                                        |
| ---------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| [**@powersync/cli**](./cli)                          | `cli/`               | Main CLI — manage instances, config, sync config, cloud and self-hosted             |
| [**@powersync/cli-core**](./packages/cli-core)       | `packages/cli-core/` | Core types and base commands shared by the CLI and plugins                         |
| [**@powersync/cli-schemas**](./packages/schemas)     | `packages/schemas/`  | Shared config schemas (cli.yaml, service.yaml, etc.)                              |
| [**@powersync/cli-plugin-docker**](./plugins/docker) | `plugins/docker/`    | Docker plugin — self-hosted PowerSync with Compose (configure, reset, start, stop) |

```
├── cli/                    # @powersync/cli — main CLI (commands, cloud/self-hosted, templates)
├── packages/
│   ├── cli-core/           # @powersync/cli-core — base commands & YAML utils (used by CLI + plugins)
│   └── schemas/            # @powersync/cli-schemas — config validation (LinkConfig, CLIConfig)
├── plugins/
│   └── docker/             # @powersync/cli-plugin-docker — docker configure, reset, start, stop
├── examples/               # Sample projects initialized with the CLI (see examples/README.md)
│   ├── cloud/
│   └── self-hosted/
└── docs/
    ├── usage.md            # General CLI usage (Cloud, self-hosted, linking, auth)
    └── usage-docker.md     # Docker plugin (configure, reset, start, stop, templates)
```

- **cli** depends on **cli-core**, **cli-schemas**, and **@powersync/cli-plugin-docker**. It loads the docker plugin and re-exports base command types from cli-core.
- **plugin-docker** (in **plugins/docker**) depends on **cli-core** and **cli-schemas**. No dependency on the CLI package.
- **cli-core** depends on **schemas**. It provides `SelfHostedInstanceCommand`, YAML helpers (`!env`), and shared types for plugins.

Workspace roots are listed in [pnpm-workspace.yaml](./pnpm-workspace.yaml): `cli`, `packages/*`, `plugins/*`.

## Getting started

```bash
nvm use          # use Node from .nvmrc (optional)
pnpm install
pnpm build
```

Run the CLI from the repo root:

```bash
powersync --help   # if @powersync/cli is a workspace dependency
```

### Self-hosted with Docker

From the repo root, create the Docker layout and run the stack:

```bash
powersync docker configure --database postgres --storage postgres
powersync docker start
```

See [plugins/docker](./plugins/docker/README.md) and [docs/usage-docker.md](./docs/usage-docker.md) for details.

## Examples

The [**examples/**](./examples) folder contains basic projects initialized with the CLI. See [examples/README.md](./examples/README.md) for the full list and links to each example's README.

## Documentation

- [**Usage**](./docs/usage.md) — How the CLI works: Cloud and self-hosted, linking, auth, supplying instance info
- [**Usage (Docker)**](./docs/usage-docker.md) — Docker plugin: configure, reset, start, stop, templates, flags
- [CLI package README](./cli/README.md) — Install, usage, and command reference
