mmand) point `POWERSYNC_DIRECTORY` at a project and start the dev server: `POWERSYNC_DIRECTORY=/path/to/project pnpm --filter editor dev`.

- Architecture, scripts, and troubleshooting tips live in [packages/editor/README.md](./packages/editor/README.md).

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
