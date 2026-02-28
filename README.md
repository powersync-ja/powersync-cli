# PowerSync CLI

Monorepo for the PowerSync CLI and related tooling. Built with [pnpm](https://pnpm.io) workspaces and [OCLIF](https://oclif.io).

## Requirements

- **Node**: LTS v24+ (see [.nvmrc](./.nvmrc); use `nvm use` to switch)
- **Package manager**: pnpm

## Monorepo structure

The workspace is split into the main CLI, shared **packages**, and optional **plugins**:

| Package                                                        | Path                   | Description                                                                                 |
| -------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| [**@powersync/cli**](./cli)                                    | `cli/`                 | Main CLI — manage instances, config, sync config, cloud and self-hosted                     |
| [**PowerSync CLI Config Studio**](./packages/editor)           | `packages/editor/`     | Monaco-based UI that edits `service.yaml`/`sync.yaml` and ships with the config-edit plugin |
| [**@powersync/cli-core**](./packages/cli-core)                 | `packages/cli-core/`   | Core types and base commands shared by the CLI and plugins                                  |
| [**@powersync/cli-schemas**](./packages/schemas)               | `packages/schemas/`    | Shared config schemas (cli.yaml, service.yaml, etc.)                                        |
| [**@powersync/cli-plugin-config-edit**](./plugins/config-edit) | `plugins/config-edit/` | CLI plugin that sets `POWERSYNC_DIRECTORY` and serves the Config Studio with `vite preview` |
| [**@powersync/cli-plugin-docker**](./plugins/docker)           | `plugins/docker/`      | Docker plugin — self-hosted PowerSync with Compose (configure, reset, start, stop)          |

```
├── cli/                    # @powersync/cli — main CLI (commands, cloud/self-hosted, templates)
├── packages/
│   ├── cli-core/           # @powersync/cli-core — base commands & YAML utils (used by CLI + plugins)
│   ├── editor/             # CLI Config Studio — Monaco web app that edits service.yaml/sync.yaml
│   └── schemas/            # @powersync/cli-schemas — config validation (LinkConfig, CLIConfig)
├── plugins/
│   ├── config-edit/        # @powersync/cli-plugin-config-edit — serves the Config Studio preview
│   └── docker/             # @powersync/cli-plugin-docker — docker configure, reset, start, stop
├── examples/               # Sample projects initialized with the CLI (see examples/README.md)
│   ├── cloud/
│   └── self-hosted/
└── docs/
    ├── usage.md            # General CLI usage (Cloud, self-hosted, linking, auth)
    └── usage-docker.md     # Docker plugin (configure, reset, start, stop, templates)
```

- **cli** depends on **cli-core**, **cli-schemas**, and loads both the docker and config-edit plugins.
- **cli-core** depends on **schemas**. It provides `SelfHostedInstanceCommand`, YAML helpers (`!env`), and shared types for plugins.
- **packages/editor** builds the Config Studio assets consumed by the config-edit plugin and embeds schemas from `@powersync/cli-schemas`.
- **@powersync/cli-plugin-config-edit** depends on **cli-core** and serves the built editor from `plugins/config-edit/editor-dist` via `vite preview`.
- **@powersync/cli-plugin-docker** (in **plugins/docker**) depends on **cli-core** and **cli-schemas**. No dependency on the CLI package.

Workspace roots are listed in [pnpm-workspace.yaml](./pnpm-workspace.yaml): `cli`, `packages/*`, `plugins/*`.

## OCLIF plugins

We rely on standard [OCLIF plugin loading](https://oclif.io/docs/plugins/) so plugins can register new commands or hook into command execution. The main CLI ships with a Docker plugin under [plugins/docker](./plugins/docker), and any other OCLIF-compatible plugin can be installed the same way.

For PowerSync-specific plugins, the optional [@powersync/cli-core](./packages/cli-core) package exposes base command helpers and shared types. The Docker plugin consumes these helpers and adds Docker-focused commands as a reference implementation.

Users can manage their own installed plugins dynamically at runtime. Run `powersync plugins --help` for install, uninstall, and inspection options.

## Getting started

```bash
nvm use          # use Node from .nvmrc (optional)
pnpm install
pnpm build
```

Run the CLI from the repo root:

```bash
powersync --help
```

### Self-hosted with Docker

From the repo root, create the Docker layout and run the stack:

```bash
powersync docker configure
powersync docker start
```

See [plugins/docker](./plugins/docker/README.md) and [docs/usage-docker.md](./docs/usage-docker.md) for details.

### Configuration editor

Open the Monaco-based Config Studio that edits `service.yaml`/`sync.yaml` directly inside your project:

```bash
pnpm build                                  # ensures packages/editor copies its dist to plugins/config-edit/editor-dist
powersync edit config --directory ./powersync --host 0.0.0.0 --port 3000
```

- The command above is provided by **@powersync/cli-plugin-config-edit** and automatically sets `POWERSYNC_DIRECTORY` to the directory you pass with `--directory` before serving the editor through `vite preview`.
- Features include YAML schema validation, Monaco-powered completions, unsaved-change tracking, reset/save controls, and an error panel for schema violations.
- For local UI work (without running the CLI command) point `POWERSYNC_DIRECTORY` at a project and start the dev server: `POWERSYNC_DIRECTORY=/path/to/project pnpm --filter editor dev`.
- Architecture, scripts, and troubleshooting tips live in [packages/editor/README.md](./packages/editor/README.md).

## Examples

The [**examples/**](./examples) folder contains basic projects initialized with the CLI. See [examples/README.md](./examples/README.md) for the full list and links to each example's README.

## Documentation

- [**Usage**](./docs/usage.md) — How the CLI works: Cloud and self-hosted, linking, auth, supplying instance info
- [**Usage (Docker)**](./docs/usage-docker.md) — Docker plugin: configure, reset, start, stop, templates, flags
- [**CLI documentation conventions**](./docs/cli-documentation-conventions.md) — How we document commands (description, summary, examples, flags, topics)
- [CLI package README](./cli/README.md) — Install, usage, and command reference
