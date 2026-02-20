# CLI documentation conventions

This document describes how we document commands and help text in the PowerSync CLI so that `powersync --help`, `powersync <command> --help`, and the generated README stay consistent.

## Command metadata (OCLIF)

- **`static description`** — Shown in command help and in the README. Use a clear one-line summary; add a second sentence or bullet if the command has important caveats (e.g. "Cloud only", "Requires --confirm=yes"). For topic commands (e.g. `fetch`, `init`), describe what the subcommands do.
- **`static summary`** — Short one-liner for the command list (e.g. in `powersync --help`). Prefer a terse summary; use `[Cloud only]` or `[Self-hosted only]` when applicable.
- **`static examples`** — Array of example invocations. Always include at least:
  - `'<%= config.bin %> <%= command.id %>'` (base form).
  - Additional entries for common flag combinations (e.g. `--confirm=yes`, `--output=json`, `--instance-id=<id> --project-id=<id>`).
    Use the oclif template so the bin name stays correct when the CLI is installed under a different name.

## Flag descriptions

- End with a period.
- Use sentence case (e.g. "Optionally write instance information to a file." not "Optionally Write...").
- For optional/override flags, mention resolution order when helpful (e.g. "Resolved: flag → INSTANCE_ID → cli.yaml.").

## Topics (package.json)

In `cli/package.json`, under `oclif.topics`, add an entry for each topic (e.g. `fetch`, `generate`, `init`, `link`, `pull`, `deploy`) with a description that directs users to run the topic command to see subcommands, e.g.:

```json
"fetch": { "description": "run \"powersync fetch\" to see a list of subcommands" }
```

## README

- The CLI README (`cli/README.md`) uses oclif markers: `<!-- toc -->`, `<!-- usage -->`, `<!-- commands -->`. Content between these is replaced by `oclif readme` (run on `prepack` and `version`). Do not hand-edit the generated command blocks.
- An **Environment variables** section (after the usage block) documents `TOKEN`, `ORG_ID`, `PROJECT_ID`, `INSTANCE_ID`, and `API_URL` for script/CI use, with a short example.

## Regenerating command docs

From the repo root:

```bash
pnpm build
cd cli && oclif readme
```

This updates the Commands section in `cli/README.md` from the built command metadata (description, summary, examples, flags).
