# How the CLI Works

The PowerSync CLI operates against **PowerSync instances**. How you point the CLI at instances depends on whether you intend to work with local config management or run one-off commands on an instance which's configuration is managed by other means - e.g. the PowerSync dashboard.

## Local configuration

It is possible to manage and deploy updates to instances entirely from the CLI. Local files are used to store the configuration state in a folder relative to your current working directory. By default this folder is `powersync/`. It holds schema, sync rules, and other YAML config. You can use a different folder via the `--directory` flag when supported.

## Linking to a project

You can **explicitly link** your local config to a cloud or self-hosted project. Running `powersync link [cloud|self-hosted]` creates a persisted **link file** (e.g. `powersync/cli.yaml`) that stores the instance information. Once linked, cloud commands in that directory use this context so you don’t need to pass IDs every time. This is the usual workflow when you develop against a single instance and keep config on disk.

## Supplying instance information without local config

For commands that don’t require locally stored config (or when you don’t want to use it), you can supply **instance information** in either of these ways:

- **Inline as flags**
  - **Cloud:** `--instance-id`, `--org-id`, `--project-id`
  - **Self-hosted:** `--api-url` (API key is not accepted via flags; use link command or `TOKEN` env var)
- **Environment variables**
  - **Cloud:** `INSTANCE_ID`, `ORG_ID`, `PROJECT_ID`
  - **Self-hosted:** `API_URL`, `TOKEN` (token used as API key)

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
```

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
api_key: !env TOKEN
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

Authentication is usually the first step. Use `powersync login` to store a token in secure storage (e.g. macOS Keychain), or set the `TOKEN` environment variable if you prefer not to persist the token. See [Authentication (Tokens)](#authentication-tokens) for details.

## Creating a new Cloud instance

Run **`powersync init cloud`** to scaffold a Cloud config directory (default `powersync/`). Configure **`service.yaml`** (name, region, replication connection, optional client auth) and sync rules. Then run **`powersync link cloud --create`** with `--org-id` and `--project-id` to create a new instance and set the linked instance for future commands. You can then run **`powersync deploy`** and other commands on the new instance and manage config using the local config files. You do not need to keep managing these config files—you can manage config externally (e.g. via the PowerSync Dashboard) if you prefer.

```bash
powersync login
powersync init cloud
# Edit powersync/service.yaml (name, region, connections, etc.) and sync rules
powersync link cloud --create --org-id=<org-id> --project-id=<project-id>
powersync validate
powersync deploy
```

The instance **name** and **region** are taken from your local `service.yaml`; set them before running `powersync link cloud --create` if you want a specific display name and region.

## Using an existing Cloud instance

For an instance that already exists (e.g. created in the Dashboard), there is no need to run **init** or create a placeholder config. Run **`powersync pull instance`** with the instance identifiers (from the PowerSync Dashboard URL or **`powersync fetch instances`**). The command creates the config directory if needed, writes **`cli.yaml`** (the link), and downloads **`service.yaml`** and **`sync.yaml`** from the cloud. Then edit the files as needed and run **`powersync deploy`** to push changes.

```bash
powersync login

# IDs from the PowerSync Dashboard URL or `powersync fetch instances`. Creates powersync/, cli.yaml, and downloads config.
powersync pull instance --org-id=<org-id> --project-id=<project-id> --instance-id=<instance-id>

# Edit the YAML files in powersync/ as needed
powersync validate
powersync deploy
```

If the config directory already exists and is linked, you can run **`powersync pull instance`** without passing IDs to refresh the local config from the cloud.

## Executing commands on an instance (no local config management)

You can run commands against an instance whose configuration is managed elsewhere (e.g. the PowerSync Dashboard). Link the instance once so the CLI knows which one to use, or pass instance identifiers via flags or environment variables each time.

**Link an instance** (from a project directory; for an existing instance you can use **`powersync pull instance`** with IDs to create the directory and link in one step):

```bash
powersync login
powersync link cloud --instance-id=<id> --org-id=<id> --project-id=<id>
```

Then run commands without passing IDs again, for example:

```bash
powersync generate schema
powersync generate token
```

You can also supply `--instance-id`, `--org-id`, and `--project-id` (or the corresponding environment variables) on individual commands if you don’t want to link.

---

# Self-hosted usage

Use `powersync init self-hosted` to create a basic template for self-hosted configuration. The template is copied into your project directory (default `powersync/`). You need to **uncomment and specify your own config** (e.g. database connection, sync rules) in the generated YAML files.

For deploying the service (e.g. to Docker or another hosting platform), see the [PowerSync self-hosting docs](https://docs.powersync.com/intro/self-hosting#self-hosting) and the [self-host-demo](https://github.com/powersync-ja/self-host-demo) repository for examples and patterns. We plan to support more of these actions from the CLI in the future.

Once your self-hosted instance is deployed and reachable, you can **link** it and run supported commands against it. The **api-url** is the URL that the running PowerSync instance is exposed from; this is configured by your deployment (e.g. Docker, Coolify, or your hosting platform).

```bash
powersync link self-hosted --api-url=https://your-powersync.example.com
# You will be prompted for the API key, or set TOKEN so the link file can use !env TOKEN
powersync generate schema
powersync generate token
# ... other supported commands
```

Use `--api-url` with link file or `API_URL` and `TOKEN` when you prefer not to link; see [Supplying linking information](#supplying-linking-information-for-cloud-and-self-hosted-commands) below.

---

# Authentication (Tokens)

Cloud commands need an auth token (e.g. a PowerSync PAT). You can supply it in two ways; the CLI uses the first that is available:

1. **Environment variable** — `TOKEN`
2. **Stored via login** — token saved by `powersync login` (secure storage, e.g. macOS Keychain)

**Environment variable** — useful for CI, scripts, or one-off runs:

```bash
export TOKEN=your-token-here
powersync stop --confirm=yes
```

Inline:

```bash
TOKEN=your-token-here powersync fetch config --output=json
```

**Stored via login** — convenient for local use; token is stored securely and reused:

```bash
powersync login
# You will be prompted for your token (not shown in shell history)
# Later commands use the stored token
powersync fetch config
```

Login is supported on macOS (other platforms coming soon). If you use another platform or prefer not to store the token, set `TOKEN` in the environment instead.

# Supplying Linking Information for Cloud and Self-Hosted Commands

Cloud and self-hosted commands need instance (and for Cloud, org and project) identifiers. **Cloud only:** `powersync deploy`, `powersync destroy`, `powersync stop`, `powersync fetch config`, `powersync pull instance`. **Both:** `powersync fetch status`, `powersync generate schema`, `powersync generate token`, `powersync validate`. The same three methods apply: the CLI uses the first that is available for each field (flags override environment variables, environment variables override link file):

1. **Flags**
   - **Cloud:** `--instance-id`, `--org-id`, `--project-id`
   - **Self-hosted:** `--api-url` only (API key from env or link file only)
2. **Environment variables**
   - **Cloud:** `INSTANCE_ID`, `ORG_ID`, `PROJECT_ID`
   - **Self-hosted:** `API_URL`, `TOKEN` (API key)
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
  --org-id=5cc84a3ccudjfhgytw0c08b \
  --project-id=6703fd8a3cfe3000hrydg463
```

**Self-hosted:** Set `TOKEN` (or use a linked project with API key in cli.yaml), then:

```bash
powersync fetch status --api-url=https://powersync.example.com
```

You can use a different project directory with `--directory`:

```bash
# Cloud
powersync stop --confirm=yes --directory=my-powersync --instance-id=... --org-id=... --project-id=...

# Self-hosted (API key from TOKEN or cli.yaml)
powersync fetch status --directory=my-powersync --api-url=https://...
```

---

## Method 2: cli.yaml (persistent context)

Link the project once; later commands use the stored IDs. Best for day-to-day work in a single project.

```bash
powersync login

# Link this project to a Cloud instance (writes powersync/cli.yaml)
powersync link cloud \
  --instance-id=688736sdfcfb46688f509bd0 \
  --org-id=5cc84a3ccudjfhgytw0c08b \
  --project-id=6703fd8a3cfe3000hrydg463

# No IDs needed on later commands
powersync stop --confirm=yes
powersync fetch status
```

If the project lives in a non-default directory:

```bash
powersync link cloud --directory=my-powersync --instance-id=... --org-id=... --project-id=...
powersync stop --confirm=yes --directory=my-powersync
```

---

## Method 3: Environment variables

Set identifiers in the environment when you don’t want to link the directory or pass flags every time (e.g. CI or scripts).

**Cloud:**

```bash
export INSTANCE_ID=688736sdfcfb46688f509bd0
export ORG_ID=5cc84a3ccudjfhgytw0c08b
export PROJECT_ID=6703fd8a3cfe3000hrydg463

powersync stop --confirm=yes
powersync fetch config --output=json
```

**Self-hosted:**

```bash
export API_URL=https://powersync.example.com
export TOKEN=your-api-key

powersync fetch status --output=json
```

Inline for a single command:

```bash
# Cloud
INSTANCE_ID=... ORG_ID=... PROJECT_ID=... powersync stop --confirm=yes

# Self-hosted
API_URL=https://... TOKEN=... powersync fetch status --output=json
```

**Note:** Environment variables are only used when neither flags nor `cli.yaml` provide linking information.
