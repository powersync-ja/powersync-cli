# How the CLI Works

The PowerSync CLI operates against **PowerSync instances**. How you point the CLI at instances depends on whether you intend to work with local config management or run one-off commands on an instance which's configuration is managed by other means - e.g. the PowerSync dashboard.

## Local configuration

It is possible to manage and deploy updates to instances entirely from the CLI. Local files are used to store the configuration state in a folder relative to your current working directory. By default this folder is `powersync/`. It holds schema, service config, sync config, and other YAML config. You can use a different folder via the `--directory` flag when required.

## Linking to an existing instance

You can **explicitly link** your local config to a cloud or self-hosted project. Running `powersync link [cloud|self-hosted]` creates a persisted **link file** (e.g. `powersync/cli.yaml`) that stores the instance information. Once linked, cloud commands in that directory use this context so you don’t need to pass IDs every time.

## Supplying instance information without local config

For commands that don’t require locally stored config (or when you don’t want to use it), you can supply **instance information** in either of these ways:

- **Inline as flags**
  - **Cloud:** `--instance-id`, `--project-id`, and optionally `--org-id`. If `--org-id` (and `ORG_ID`) are omitted, the CLI uses the token’s single organization when the token has access to exactly one; if the token has multiple orgs, you must pass `--org-id` (or set `ORG_ID`).
  - **Self-hosted:** `--api-url` (API key is not accepted via flags; use link command or `PS_ADMIN_TOKEN` env var)
- **Environment variables**
  - **Cloud:** `INSTANCE_ID`, `PROJECT_ID`, and optionally `ORG_ID` (same default behaviour as above when omitted)
  - **Self-hosted:** `API_URL`, `PS_ADMIN_TOKEN` (token used as API key)

That lets you run one-off or scripted operations (e.g. generating a development token, generating client side schemas) without creating or using a `powersync/` folder or a link file.

**Cloud and self-hosted:** These same patterns (local config folder, linking via a link file, and supplying instance information via flags or environment variables) apply to both PowerSync Cloud instances and self-hosted instances. Self-hosted instances use the same link file and resolution order; only the way you authenticate or target the instance may differ.

## Configuring multiple instances (e.g. dev, staging, production)

When you have development, staging, and production instances, you can structure your project in a few ways:

**Multiple directories, each linked to one instance**

Use separate config directories (e.g. `powersync`, `powersync-dev`, `powersync-staging`). Each directory has its own `cli.yaml` pointing at a different instance. Use `--directory` to run commands against a specific environment:

```bash
powersync deploy --directory=powersync          # production (linked in powersync/cli.yaml)
powersync deploy --directory=powersync-dev     # dev (linked in powersync-dev/cli.yaml)
powersync deploy --directory=powersync-staging # staging (linked in powersync-staging/cli.yaml)

# Optional targeted deploys:
powersync deploy service-config --directory=powersync   # service.yaml only (keeps cloud sync config)
powersync deploy sync-config --directory=powersync      # sync-config.yaml only
```

**Alternate sync config file**

These commands accept **`--sync-config-file-path=/path/to/sync.yaml`** instead of **`sync-config.yaml`** in the project directory: **`powersync deploy`**, **`powersync deploy sync-config`**, **`powersync validate`**, **`powersync generate schema`**. Other commands (e.g. **`deploy service-config`**, **`generate token`**, **`destroy`**, **`status`**) do not expose this flag.

**Single directory and link file, with `!env` substitution**

Use a single `powersync/` folder and a single `cli.yaml`, and use the **`!env`** custom tag in your YAML to substitute values from the environment. That way you can keep one set of config files and one link file, while varying things like instance IDs, API URLs, or database URLs per environment (e.g. production database URL from an env var). Both the link file and the main config (e.g. `service.yaml`) can use `!env` so that the same repo works for dev, staging, and prod by changing only environment variables.

Example in **cli.yaml** (cloud — instance resolved from env):

```yaml
type: cloud
instance_id: !env MY_INSTANCE_ID_VAR
org_id: !env MY_ORG_ID_VAR
project_id: !env MY_PROJECT_ID_VAR
```

Or for self-hosted:

```yaml
type: self-hosted
api_url: !env API_URL
api_key: !env PS_ADMIN_TOKEN
```

In **service.yaml** (or other config), use `!env` for secrets and environment-specific values such as database URLs:

```yaml
# database connection example
#   uri: !env PS_DATA_SOURCE_URI
#   password: !env PS_DATABASE_PASSWORD
```

You can cast to number or boolean with `::number` or `::boolean`, e.g. `!env PS_PORT::number`.

The sections below split usage by **Cloud** and **Self-hosted**, then provide reference for authentication and supplying instance information.

---

# Cloud usage

Authentication is usually the first step. Use `powersync login` to store a token, or set the `PS_ADMIN_TOKEN` environment variable. Storage behavior depends on platform capabilities and your login choice; see [Authentication (Tokens)](#authentication-tokens) for details.

## Creating a new Cloud instance

Run **`powersync init cloud`** to scaffold a Cloud config directory (default `powersync/`). Configure **`service.yaml`** (name, region, replication connection, optional client auth) and sync config. Then run **`powersync link cloud --create`** with `--project-id` to create a new instance and set the linked instance for future commands. (Add `--org-id` only if your token has access to multiple organizations.) You can then run **`powersync deploy`** and other commands on the new instance and manage config using the local config files. You do not need to keep managing these config files—you can manage config externally (e.g. via the PowerSync Dashboard) if you prefer.

```bash
powersync login
powersync init cloud
# Edit powersync/service.yaml (name, region, connections, etc.) and sync config
powersync link cloud --create --project-id=<project-id>
# If your token has multiple orgs: add --org-id=<org-id>
powersync validate
powersync deploy

# Optional targeted deploys:
powersync deploy service-config
powersync deploy sync-config
```

Deploy command modes:

- `powersync deploy` — deploy both service config and sync config.
- `powersync deploy service-config` — deploy only service config changes, without updating sync config.
- `powersync deploy sync-config` — deploy only sync config changes.

The instance **name** and **region** are taken from your local `service.yaml`; set them before running `powersync link cloud --create` if you want a specific display name and region.

## Using an existing Cloud instance

For an instance that already exists (e.g. created in the Dashboard), there is no need to run **init** or create a placeholder config. Run **`powersync pull instance`** with the instance identifiers (from the PowerSync Dashboard URL or **`powersync fetch instances`**). The command creates the config directory if needed, writes **`cli.yaml`** (the link), and downloads **`service.yaml`** and **`sync-config.yaml`** from the cloud. Then edit the files as needed and run **`powersync deploy`** to push changes.

```bash
powersync login

# IDs from the PowerSync Dashboard URL or `powersync fetch instances`. Creates powersync/, cli.yaml, and downloads config.
powersync pull instance --project-id=<project-id> --instance-id=<instance-id>
# If your token has multiple orgs: add --org-id=<org-id>

# Edit the YAML files in powersync/ as needed
powersync validate
powersync deploy

# Optional targeted deploys:
powersync deploy service-config
powersync deploy sync-config
```

When you only changed one file, prefer a targeted deploy command to reduce unnecessary updates.

If the config directory already exists and is linked, you can run **`powersync pull instance`** without passing IDs to refresh the local config from the cloud.

## Executing commands on an instance (no local config management)

You can run commands against an instance whose configuration is managed elsewhere (e.g. the PowerSync Dashboard). Link the instance once so the CLI knows which one to use, or pass instance identifiers via flags or environment variables each time.

**Link an instance** (from a project directory; for an existing instance you can use **`powersync pull instance`** with IDs to create the directory and link in one step):

```bash
powersync login
powersync fetch instances # to see available instances and their IDs
powersync link cloud --instance-id=<id> --project-id=<project-id>
# If your token has multiple orgs: add --org-id=<id>
```

Then run commands without passing IDs again, for example:

```bash
powersync generate schema
powersync generate token
```

You can also supply `--instance-id` and `--project-id` (and `--org-id` only when your token has multiple orgs) or the corresponding environment variables on individual commands if you don’t want to link.

---

# Self-hosted usage

Use `powersync init self-hosted` to create a basic template for self-hosted configuration. The template is copied into your project directory (default `powersync/`). You need to **uncomment and specify your own config** (e.g. database connection, sync config) in the generated YAML files.

For deploying the service (e.g. to Docker or another hosting platform), see the [PowerSync self-hosting docs](https://docs.powersync.com/intro/self-hosting#self-hosting) and the [self-host-demo](https://github.com/powersync-ja/self-host-demo) repository for examples and patterns. We plan to support more of these actions from the CLI in the future.

Once your self-hosted instance is deployed and reachable, you can **link** it and run supported commands against it. The **api-url** is the URL that the running PowerSync instance is exposed from; this is configured by your deployment (e.g. Docker, Coolify, or your hosting platform).

```bash
powersync link self-hosted --api-url=https://your-powersync.example.com
# You will be prompted for the API key, or set PS_ADMIN_TOKEN so the link file can use !env PS_ADMIN_TOKEN
powersync generate schema
powersync generate token
# ... other supported commands
```

Use `--api-url` with link file or `API_URL` and `PS_ADMIN_TOKEN` when you prefer not to link; see [Supplying linking information](#supplying-linking-information-for-cloud-and-self-hosted-commands) below.

---

# Authentication (Tokens)

Cloud commands need an auth token (e.g. a PowerSync PAT). The CLI uses the first available source:

1. **Environment variable** — `PS_ADMIN_TOKEN`
2. **Stored via login**

- **Secure storage** when available (for example, macOS Keychain)
- **Config-file fallback** when secure storage is unavailable **and** you explicitly confirm at login

**Environment variable** — useful for CI, scripts, or one-off runs:

```bash
export PS_ADMIN_TOKEN=your-token-here
powersync stop --confirm=yes
```

Inline:

```bash
PS_ADMIN_TOKEN=your-token-here powersync fetch config --output=json
```

**Stored via login** — convenient for local use; token is reused by later commands:

```bash
powersync login
# You will be prompted for your token (not shown in shell history)
# Later commands use the stored token
powersync fetch config
```

If secure storage is not available, `powersync login` asks whether to store the token in plaintext at:

```bash
$XDG_CONFIG_HOME/powersync/config.yaml
# or, when XDG_CONFIG_HOME is not set:
~/.config/powersync/config.yaml
```

If you decline this prompt, login exits without storing a token. Use `PS_ADMIN_TOKEN` in that case.

`powersync logout` removes the stored token from whichever backend is active (secure storage or config-file fallback).

# Supplying Linking Information for Cloud and Self-Hosted Commands

Cloud and self-hosted commands need instance (and for Cloud, org and project) identifiers. **Cloud only:** `powersync deploy`, `powersync deploy service-config`, `powersync deploy sync-config`, `powersync destroy`, `powersync stop`, `powersync fetch config`, `powersync pull instance`. **Both:** `powersync status`, `powersync generate schema`, `powersync generate token`, `powersync validate`. The same three methods apply: the CLI uses the first that is available for each field (flags override environment variables, environment variables override link file). For Cloud, **org_id is optional**: when not set via flags, env, or link file, the CLI fetches the token’s organizations and uses the single org if there is exactly one; if the token has multiple orgs, the command errors and you must pass `--org-id` (or set `ORG_ID`).

1. **Flags**
   - **Cloud:** `--instance-id`, `--project-id` (required when using instance-id), `--org-id` (optional; defaults to token’s single org)
   - **Self-hosted:** `--api-url` only (API key from env or link file only)
2. **Environment variables**
   - **Cloud:** `INSTANCE_ID`, `PROJECT_ID`, and optionally `ORG_ID` (same default as above)

- **Self-hosted:** `API_URL`, `PS_ADMIN_TOKEN` (API key)

3. **cli.yaml** — a `powersync/cli.yaml` file in the project (written by `powersync link cloud` or `powersync link self-hosted`)

---

## Method 1: Flags (one-off or override)

Pass the identifiers on each command. Useful for one-off runs or to override the current context.

**Cloud:**

```bash
powersync login

# Stop a specific instance without linking the directory (overrides cli.yaml if present)
powersync stop --confirm=yes \
  --instance-id=688736sdfcfb46688f509bd0 \
  --project-id=6703fd8a3cfe3000hrydg463
# If your token has multiple orgs: add --org-id=<org-id>
```

**Self-hosted:** Set `PS_ADMIN_TOKEN` (or use a linked project with API key in cli.yaml), then:

```bash
powersync status --api-url=https://powersync.example.com
```

You can use a different project directory with `--directory`:

```bash
# Cloud (add --org-id=... only if your token has multiple orgs)
powersync stop --confirm=yes --directory=my-powersync --instance-id=... --project-id=...

# Self-hosted (API key from PS_ADMIN_TOKEN or cli.yaml)
powersync status --directory=my-powersync --api-url=https://...
```

---

## Method 2: cli.yaml (persistent context)

Link the project once; later commands use the stored IDs. Best for day-to-day work in a single project.

```bash
powersync login

# Link this project to a Cloud instance (writes powersync/cli.yaml)
powersync link cloud \
  --instance-id=688736sdfcfb46688f509bd0 \
  --project-id=6703fd8a3cfe3000hrydg463
# If your token has multiple orgs: add --org-id=5cc84a3ccudjfhgytw0c08b

# No IDs needed on later commands
powersync stop --confirm=yes
powersync status
```

If the project lives in a non-default directory:

```bash
powersync link cloud --directory=my-powersync --instance-id=... --project-id=...
powersync stop --confirm=yes --directory=my-powersync
```

---

## Method 3: Environment variables

Set identifiers in the environment when you don’t want to link the directory or pass flags every time (e.g. CI or scripts).

**Cloud:** (Most tokens have a single org; omit `ORG_ID`. Set it only if your token has multiple orgs.)

```bash
export INSTANCE_ID=688736sdfcfb46688f509bd0
export PROJECT_ID=6703fd8a3cfe3000hrydg463
# export ORG_ID=...   # only if your token has multiple orgs

powersync stop --confirm=yes
powersync fetch config --output=json
```

**Self-hosted:**

```bash
export API_URL=https://powersync.example.com
export PS_ADMIN_TOKEN=your-api-key

powersync status --output=json
```

Inline for a single command:

```bash
# Cloud (add ORG_ID=... only if your token has multiple orgs)
INSTANCE_ID=... PROJECT_ID=... powersync stop --confirm=yes

# Self-hosted
API_URL=https://... PS_ADMIN_TOKEN=... powersync status --output=json
```

**Note:** Environment variables are only used when neither flags nor `cli.yaml` provide linking information.
