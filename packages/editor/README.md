# PowerSync CLI Config Studio

> **Private package — not published to npm.** This package is built and bundled into [`@powersync/cli-plugin-config-edit`](../../plugins/config-edit) during the build step (`pnpm --filter editor build` copies the output into `plugins/config-edit/editor-dist/`). It is served at runtime by that plugin when you run `powersync edit config`. It is not intended to be installed or used directly.

The PowerSync CLI Config Studio is the Monaco-powered editor that ships with the `powersync edit config` command. It exposes the two YAML files managed by the CLI (`service.yaml` and `sync-config.yaml`), enforces our official JSON Schemas, and lets you save the result back to your local PowerSync directory without touching the CLI manually.

## Feature highlights

- **Automatic file discovery** – the server functions locate `service.yaml` and `sync-config.yaml` using the JSON blob in `POWERSYNC_PROJECT_CONTEXT` (set by `powersync edit config`) and expose them over TanStack Start server functions.
- **Schema-aware authoring** – Monaco runs `monaco-yaml` with the schemas from `@powersync/cli-schemas`, so completions, hover docs, and validation all match the CLI contract.
- **Unsaved change tracking** – changes are stored in an RxJS subject so every route can see which files are pending saves, making the sidebar badges and the editor status consistent.
- **Actionable validation** – validation markers can be expanded into a details panel that highlights the line and reason that the schema rejected the content.
- **Reset + Save controls** – users can revert to the upstream file contents or persist the edited version. Saves round-trip through the server function to disk so the CLI immediately sees the change.

## How it works

1. The server layer in [`src/utils/files/files.functions.ts`](src/utils/files/files.functions.ts) reads and writes files with Node `fs`, while `SaveFileRequest` in [`src/utils/files/files.ts`](src/utils/files/files.ts) restricts which YAML files can be touched.
2. `useFiles` and `useTrackedFiles` in [`src/components/hooks/useFiles.ts`](src/components/hooks/useFiles.ts) fetch the latest copy of each file and maintain the in-memory diff state that powers the UI badges.
3. Monaco is configured in [`src/components/MonacoEditor.tsx`](src/components/MonacoEditor.tsx) to load schemas from [`src/utils/yaml-schemas.ts`](src/utils/yaml-schemas.ts) so validation, formatting, and completions follow the CLI spec.
4. The sidebar + editor experience lives under [`src/routes/files`](src/routes/files) with `/files` listing every detected config and `/files/$filename` rendering the Monaco instance plus validation details.

## Local development

> The editor talks directly to your filesystem. Always point `POWERSYNC_PROJECT_CONTEXT` at a test project unless you intend to edit production config files.

1. **Install dependencies**
   ```bash
   pnpm install
   ```
2. **Provide project context** – the editor expects `POWERSYNC_PROJECT_CONTEXT` (JSON) to describe the linked project. The safest way is to let the CLI set it for you:
   ```bash
   # from the repo root, uses the CLI command to set POWERSYNC_PROJECT_CONTEXT automatically
   pnpm --filter cli exec powersync edit config --directory /absolute/path/to/powersync --port 3000
   ```
   If you need to run `pnpm --filter editor dev`, export the same env yourself. A minimal self-hosted example:
   ```bash
   export POWERSYNC_PROJECT_CONTEXT='{"linkedProject":{"projectDirectory":"/absolute/path/to/powersync","linked":{"type":"self-hosted"}}}'
   pnpm --filter editor dev
   ```
   (For full validation, include the real linked metadata; using the CLI command above is preferred.)
   The dev server runs on http://localhost:3000 by default. Hot reloading works for both React components and server functions.
3. **Run tests (optional)**
   ```bash
   pnpm --filter editor test
   ```

## Building + distributing to the CLI

`pnpm --filter editor build` uses Vite/Nitro to emit the production build into `.output/` and then runs [`scripts/copy-editor-dist.mjs`](scripts/copy-editor-dist.mjs) to mirror the artifacts into `plugins/config-edit/editor-dist/`. That folder is what the CLI plugin serves when you run `powersync edit config`.

```bash
pnpm --filter editor build
# copies the contents of packages/editor/.output into plugins/config-edit/editor-dist
```

Need to preview the built bundle exactly like the CLI plugin does? Use Vite preview against the copied dist:

```bash
pnpm --filter @powersync/cli-plugin-config-edit exec \
   vite preview --host 127.0.0.1 --port 4173 --outDir editor-dist
```

## Using the editor through the CLI plugin

Once the workspace has been built (`pnpm build` at the repo root), the config-edit plugin exposes:

```bash
powersync edit config --directory ./powersync --port 3000
```

Behind the scenes the command defined in [`plugins/config-edit/src/commands/edit/config.ts`](../../plugins/config-edit/src/commands/edit/config.ts) sets `POWERSYNC_PROJECT_CONTEXT`, serves `editor-dist` with the Nitro server, and opens your browser automatically. Any changes saved in the editor are written straight to the directory you passed via `--directory`, so the main CLI can immediately consume the updated YAML. Pass `--host 0.0.0.0` only when you intentionally need the editor accessible from other hosts.

Refer back to this README whenever you need to adjust scripts, tweak validation behavior, or explain the editor flow to other contributors.
