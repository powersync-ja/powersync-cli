# Pulling an Existing Project For Config

```bash
powersync login

# IDs taken from the PowerSync Dashboard URL
powersync pull config --org-id=5cc84a3ccudjfhgytw0c08b --project-id=6703fd8a3cfe3000hrydg463 --instance-id=688736sdfcfb46688f509bd0

# Make any required changes to the YAML files in the powersync/ directory.

# Deploy changes
powersync deploy
```

# Supplying Linking Information for Cloud Commands

Cloud commands (`deploy`, `destroy`, `stop`, `fetch config`, `pull config`) need instance, org, and project IDs. You can supply them in three ways; the CLI uses the first that is available:

1. **Flags** — `--instance-id`, `--org-id`, `--project-id` on the command
2. **link.yaml** — a `powersync/link.yaml` file in the project (written by `powersync link cloud`)
3. **Environment variables** — `INSTANCE_ID`, `ORG_ID`, `PROJECT_ID`

---

## Method 1: Flags (one-off or override)

Pass the IDs on each command. Useful for one-off runs or to override the current context.

```bash
powersync login

# Stop a specific instance without linking the directory (overrides link.yaml if present)
powersync stop --confirm=yes \
  --instance-id=688736sdfcfb46688f509bd0 \
  --org-id=5cc84a3ccudjfhgytw0c08b \
  --project-id=6703fd8a3cfe3000hrydg463
```

You can use a different project directory with `--directory`:

```bash
powersync stop --confirm=yes --directory=my-powersync --instance-id=... --org-id=... --project-id=...
```

---

## Method 2: link.yaml (persistent context)

Link the project once; later commands use the stored IDs. Best for day-to-day work in a single project.

```bash
powersync login

# Link this project to a Cloud instance (writes powersync/link.yaml)
powersync link cloud \
  --instance-id=688736sdfcfb46688f509bd0 \
  --org-id=5cc84a3ccudjfhgytw0c08b \
  --project-id=6703fd8a3cfe3000hrydg463

# No IDs needed on later commands
powersync stop --confirm=yes
powersync fetch config
```

If the project lives in a non-default directory:

```bash
powersync link cloud --directory=my-powersync --instance-id=... --org-id=... --project-id=...
powersync stop --confirm=yes --directory=my-powersync
```

---

## Method 3: Environment variables

Set IDs in the environment when you don’t want to link the directory or pass flags every time (e.g. CI or scripts).

```bash
export INSTANCE_ID=688736sdfcfb46688f509bd0
export ORG_ID=5cc84a3ccudjfhgytw0c08b
export PROJECT_ID=6703fd8a3cfe3000hrydg463

powersync stop --confirm=yes
powersync fetch config --output=json
```

Inline for a single command:

```bash
INSTANCE_ID=... ORG_ID=... PROJECT_ID=... powersync stop --confirm=yes
```

**Note:** Environment variables are only used when neither flags nor `link.yaml` provide linking information.
