# @powersync/cli

CLI for PowerSync

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@powersync/cli.svg)](https://npmjs.org/package/@powersync/cli)
[![Downloads/week](https://img.shields.io/npm/dw/@powersync/cli.svg)](https://npmjs.org/package/@powersync/cli)

<!-- toc -->
* [@powersync/cli](#powersynccli)
* [General instructions](#general-instructions)
* [Usage](#usage)
* [Known Limitations](#known-limitations)
* [Commands](#commands)
<!-- tocstop -->

# General instructions

The PowerSync CLI manages config in a **config directory** (default `powersync/`). You scaffold that directory with **init**, bind it to an instance with **link**, then deploy or run against that instance.

## How it works

- **Config directory** – Contains `service.yaml` (instance config: connections, client auth, etc.), `sync.yaml` (sync rules), and optionally `cli.yaml` (link to a Cloud or self-hosted instance). Use `--directory` to point to another folder.
- **Linking** – **link cloud** or **link self-hosted** writes (or updates) `cli.yaml` so later commands use that instance without passing IDs or API URLs each time.
- **YAML and `!env`** – All PowerSync YAML files (`service.yaml`, `sync.yaml`, `cli.yaml`) support the **`!env`** custom tag. A value like `!env MY_VAR` is resolved from the `MY_VAR` environment variable when the CLI or runtime reads the config. You can cast with `::number` or `::boolean`, e.g. `!env PS_PORT::number`. Use this to keep secrets and environment-specific values out of the repo.

## Init: Cloud project

Scaffold a Cloud config directory, then link and deploy:

```sh
# Scaffold Cloud template into powersync/
powersync init cloud

# Optional: use a different directory
powersync init cloud --directory my-powersync

# Optional: add .vscode settings for YAML !env tag support (schema/validation)
powersync init cloud --vscode
```

Then edit `powersync/service.yaml` (name, region, replication connection, optional client_auth). **For Cloud, use `!env` for all secrets** (e.g. database passwords, JWT secrets, client auth keys) so they are read from the environment at deploy time and never stored in the file:

```yaml
# Example: connection secret from environment
password:
  secret: !env POWERSYNC_DATABASE_PASSWORD
```

Log in, link to an instance (create a new one or use an existing ID), and deploy:

```sh
powersync login
powersync link cloud --create --org-id=<org-id> --project-id=<project-id>
# or link to existing: powersync link cloud --org-id=... --project-id=... --instance-id=...
powersync deploy
```

## Init: Self-hosted project

Scaffold a self-hosted config directory and configure it for your instance:

```sh
# Scaffold self-hosted template into powersync/
powersync init self-hosted

# Optional: different directory or .vscode settings for !env
powersync init self-hosted --directory my-powersync --vscode
```

Then edit `powersync/service.yaml` with your self-hosted instance details (replication, storage, client_auth, etc.). Use `!env` for secrets and environment-specific values (URIs, passwords, JWT secrets, etc.). For local development with Docker, use **`powersync docker configure`** then **`powersync docker start`** (see the [docker plugin](../plugins/docker/README.md)).

```sh
# Link to an existing self-hosted API
powersync link self-hosted --api-url https://powersync.example.com
```

# Usage

For self-hosted instances with Docker, use **`powersync docker configure`** then **`powersync docker start`**. Use **`powersync docker reset`** only when you need to start from a clean state (stop and remove, then start). See the [docker plugin](../plugins/docker/README.md) for details.

<!-- usage -->
```sh-session
$ npm install -g @powersync/cli
$ powersync COMMAND
running command...
$ powersync (--version)
@powersync/cli/0.0.0 darwin-arm64 node-v22.22.0
$ powersync --help [COMMAND]
USAGE
  $ powersync COMMAND
...
```
<!-- usagestop -->

# Known Limitations

- **Login secure storage**: Secure storage for auth tokens is only supported on macOS (via Keychain). On Windows and Linux, `powersync login` will not persist credentials; use the `TOKEN` environment variable instead for Cloud commands.

# Commands

<!-- commands -->
* [`powersync deploy`](#powersync-deploy)
* [`powersync destroy`](#powersync-destroy)
* [`powersync docker`](#powersync-docker)
* [`powersync docker configure`](#powersync-docker-configure)
* [`powersync docker reset`](#powersync-docker-reset)
* [`powersync docker start`](#powersync-docker-start)
* [`powersync docker stop`](#powersync-docker-stop)
* [`powersync fetch`](#powersync-fetch)
* [`powersync fetch config`](#powersync-fetch-config)
* [`powersync fetch instances`](#powersync-fetch-instances)
* [`powersync fetch status`](#powersync-fetch-status)
* [`powersync generate`](#powersync-generate)
* [`powersync generate schema`](#powersync-generate-schema)
* [`powersync generate token`](#powersync-generate-token)
* [`powersync help [COMMAND]`](#powersync-help-command)
* [`powersync init`](#powersync-init)
* [`powersync init cloud`](#powersync-init-cloud)
* [`powersync init self-hosted`](#powersync-init-self-hosted)
* [`powersync link`](#powersync-link)
* [`powersync link cloud`](#powersync-link-cloud)
* [`powersync link self-hosted`](#powersync-link-self-hosted)
* [`powersync login`](#powersync-login)
* [`powersync logout`](#powersync-logout)
* [`powersync migrate`](#powersync-migrate)
* [`powersync plugins`](#powersync-plugins)
* [`powersync plugins add PLUGIN`](#powersync-plugins-add-plugin)
* [`powersync plugins:inspect PLUGIN...`](#powersync-pluginsinspect-plugin)
* [`powersync plugins install PLUGIN`](#powersync-plugins-install-plugin)
* [`powersync plugins link PATH`](#powersync-plugins-link-path)
* [`powersync plugins remove [PLUGIN]`](#powersync-plugins-remove-plugin)
* [`powersync plugins reset`](#powersync-plugins-reset)
* [`powersync plugins uninstall [PLUGIN]`](#powersync-plugins-uninstall-plugin)
* [`powersync plugins unlink [PLUGIN]`](#powersync-plugins-unlink-plugin)
* [`powersync plugins update`](#powersync-plugins-update)
* [`powersync pull`](#powersync-pull)
* [`powersync pull config`](#powersync-pull-config)
* [`powersync stop`](#powersync-stop)
* [`powersync validate`](#powersync-validate)

## `powersync deploy`

Push local config to the linked Cloud instance (connections + sync rules).

```
USAGE
  $ powersync deploy [--directory <value>] [--instance-id <value> --org-id <value> --project-id <value>]

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID. Manually passed if the current context has not been linked.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  Push local config to the linked Cloud instance (connections + sync rules).

  Push local config (service.yaml, sync rules) to the linked PowerSync Cloud instance. Tests connections and sync rules
  first; requires a linked project. Cloud only.
```

_See code: [src/commands/deploy.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/deploy.ts)_

## `powersync destroy`

Permanently destroy the linked Cloud instance.

```
USAGE
  $ powersync destroy [--confirm yes] [--directory <value>] [--instance-id <value> --org-id <value>
    --project-id <value>]

FLAGS
  --confirm=<option>  Set to "yes" to confirm destruction of the instance.
                      <options: yes>

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID. Manually passed if the current context has not been linked.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  Permanently destroy the linked Cloud instance.

  Permanently delete the linked PowerSync Cloud instance and its data. Requires --confirm=yes. Cloud only.
```

_See code: [src/commands/destroy.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/destroy.ts)_

## `powersync docker`

Manage self-hosted PowerSync with Docker Compose (configure, reset, start, stop).

```
USAGE
  $ powersync docker [--directory <value>] [--api-url <value>]

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  PowerSync API URL. Resolved: flag → API_URL environment variable → cli.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

DESCRIPTION
  Manage self-hosted PowerSync with Docker Compose (configure, reset, start, stop).

  Scaffold and run a self-hosted PowerSync stack via Docker. Use `docker configure` to create powersync/docker/, then
  `docker reset` (stop+remove then start) or `docker start` / `docker stop`.
```

## `powersync docker configure`

Configures a self hosted project with Docker Compose services.

```
USAGE
  $ powersync docker configure --database postgres|external --storage postgres|external [--directory <value>]
    [--api-url <value>]

FLAGS
  --database=<option>  (required) Database module for replication source.
                       <options: postgres|external>
  --storage=<option>   (required) Storage module for PowerSync bucket metadata.
                       <options: postgres|external>

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  PowerSync API URL. Resolved: flag → API_URL environment variable → cli.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

DESCRIPTION
  Configures a self hosted project with Docker Compose services.

  Configures a self hosted project with Docker Compose services.
  Docker configuration is located in ./powersync/docker/.
  Configured projects can be started with "powersync docker start".
```

## `powersync docker reset`

Reset the self-hosted PowerSync stack (stop and remove, then start).

```
USAGE
  $ powersync docker reset [--directory <value>] [--api-url <value>]

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  PowerSync API URL. Resolved: flag → API_URL environment variable → cli.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

DESCRIPTION
  Reset the self-hosted PowerSync stack (stop and remove, then start).

  Run `docker compose down` then `docker compose up -d --wait`: stops and removes containers, then starts the stack and
  waits for services (including PowerSync) to be healthy. Use when you want a clean bring-up (e.g. after config
  changes). Use `powersync fetch status` to debug running instances.
```

## `powersync docker start`

Start the self-hosted PowerSync stack via Docker Compose.

```
USAGE
  $ powersync docker start [--directory <value>] [--api-url <value>]

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  PowerSync API URL. Resolved: flag → API_URL environment variable → cli.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

DESCRIPTION
  Start the self-hosted PowerSync stack via Docker Compose.

  Runs `docker compose up -d --wait` for the project docker/ compose file; waits for services (including PowerSync) to
  be healthy. Use `powersync fetch status` to debug running instances.
```

## `powersync docker stop`

Stop a PowerSync Docker Compose project by name.

```
USAGE
  $ powersync docker stop [--directory <value>] [--api-url <value>] [--project-name <value>] [--remove]
    [--remove-volumes]

FLAGS
  --project-name=<value>  Docker Compose project name to stop (e.g. powersync_myapp). If omitted and run from a project
                          directory, uses plugins.docker.project_name from cli.yaml. Pass this to stop from any
                          directory without loading the project.
  --remove                Remove containers after stopping (docker compose down). By default only stop (docker compose
                          stop).
  --remove-volumes        Remove named volumes (docker compose down -v). Use to reset database/storage so init scripts
                          run again on next reset. Implies --remove.

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  PowerSync API URL. Resolved: flag → API_URL environment variable → cli.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

DESCRIPTION
  Stop a PowerSync Docker Compose project by name.

  Run `docker compose -p <project-name> stop` (containers are not removed by default). Does not require the project
  directory or a compose file, so you can run it from anywhere (e.g. after a reset conflict). Use --project-name or run
  from a project with cli.yaml to choose which project to stop. Use --remove to also remove the containers. Use
  --remove-volumes to also remove volumes (e.g. to re-run DB init scripts on next reset).
```

## `powersync fetch`

List instances, fetch config, or fetch instance diagnostics.

```
USAGE
  $ powersync fetch

DESCRIPTION
  List instances, fetch config, or fetch instance diagnostics.

  Subcommands: list Cloud instances in org/project (fetch instances), print instance config as YAML/JSON (fetch config),
  or show instance diagnostics (fetch status).
```

_See code: [src/commands/fetch/index.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/fetch/index.ts)_

## `powersync fetch config`

Print linked Cloud instance config (YAML or JSON).

```
USAGE
  $ powersync fetch config [--output json|yaml] [--directory <value>] [--instance-id <value> --org-id <value>
    --project-id <value>]

FLAGS
  --output=<option>  [default: yaml] Output format: yaml or json.
                     <options: json|yaml>

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID. Manually passed if the current context has not been linked.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  Print linked Cloud instance config (YAML or JSON).

  Retrieve the current instance config from PowerSync Cloud and print as YAML or JSON. Cloud only.
```

_See code: [src/commands/fetch/config.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/fetch/config.ts)_

## `powersync fetch instances`

List Cloud instances in the current org/project.

```
USAGE
  $ powersync fetch instances [--org-id <value>] [--project-id <value>] [--output human|json] [--output-file <value>]

FLAGS
  --org-id=<value>       Optional Organization ID. Defaults to all organizations.
  --output=<option>      [default: human] Output format: human or json.
                         <options: human|json>
  --output-file=<value>  Optionally Write instance information to a file
  --project-id=<value>   Optional Project ID. Defaults to all projects in the org.

DESCRIPTION
  List Cloud instances in the current org/project.

  List PowerSync Cloud instances in the current org and project. Use with a linked directory or pass --org-id and
  --project-id. Cloud only.
```

_See code: [src/commands/fetch/instances.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/fetch/instances.ts)_

## `powersync fetch status`

Show instance diagnostics (connections, sync rules, replication).

```
USAGE
  $ powersync fetch status [--output human|json|yaml] [--api-url <value> | --instance-id <value> | --org-id
    <value> | --project-id <value>] [--directory <value>]

FLAGS
  --output=<option>  [default: human] Output format: human-readable, json, or yaml.
                     <options: human|json|yaml>

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  [Self-hosted] PowerSync API URL. When set, context is treated as self-hosted (exclusive with
                     --instance-id). Resolved: flag → API_URL → cli.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  [Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud
                         (exclusive with --api-url). Resolved: flag → INSTANCE_ID → cli.yaml.
  --org-id=<value>       [Cloud] Organization ID. Resolved: flag → ORG_ID → cli.yaml.
  --project-id=<value>   [Cloud] Project ID. Resolved: flag → PROJECT_ID → cli.yaml.

DESCRIPTION
  Show instance diagnostics (connections, sync rules, replication).

  Fetch instance diagnostics: connection status, active and deploying sync rules, replication state. Output as
  human-readable, JSON, or YAML. Cloud and self-hosted.
```

_See code: [src/commands/fetch/status.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/fetch/status.ts)_

## `powersync generate`

Generate client schema or development token.

```
USAGE
  $ powersync generate

DESCRIPTION
  Generate client schema or development token.

  Generate client artifacts: schema (from instance schema + sync rules) or a development token for connecting clients.
  Cloud and self-hosted where supported.
```

_See code: [src/commands/generate/index.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/generate/index.ts)_

## `powersync generate schema`

Generate client schema file from instance schema and sync rules.

```
USAGE
  $ powersync generate schema --output dart|dotNet|flutterFlow|js|jsLegacy|kotlin|swift|ts --output-path <value>
    [--api-url <value> | --instance-id <value> | --org-id <value> | --project-id <value>] [--directory <value>]

FLAGS
  --output=<option>      (required) [default: type] Output type: dart, dotNet, flutterFlow, js, jsLegacy, kotlin, swift,
                         ts
                         <options: dart|dotNet|flutterFlow|js|jsLegacy|kotlin|swift|ts>
  --output-path=<value>  (required) Path to output the schema file.

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  [Self-hosted] PowerSync API URL. When set, context is treated as self-hosted (exclusive with
                     --instance-id). Resolved: flag → API_URL → cli.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  [Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud
                         (exclusive with --api-url). Resolved: flag → INSTANCE_ID → cli.yaml.
  --org-id=<value>       [Cloud] Organization ID. Resolved: flag → ORG_ID → cli.yaml.
  --project-id=<value>   [Cloud] Project ID. Resolved: flag → PROJECT_ID → cli.yaml.

DESCRIPTION
  Generate client schema file from instance schema and sync rules.

  Generate a client-side schema file from the instance database schema and sync rules. Supports multiple output types
  (e.g. type, dart). Requires a linked instance. Cloud and self-hosted.
```

_See code: [src/commands/generate/schema.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/generate/schema.ts)_

## `powersync generate token`

Generate a development JWT for client connections.

```
USAGE
  $ powersync generate token --subject <value> [--expires-in-seconds <value>] [--kid <value>] [--api-url <value> |
    --instance-id <value> | --org-id <value> | --project-id <value>] [--directory <value>]

FLAGS
  --expires-in-seconds=<value>  [default: 43200] Expiration time in seconds. Default is 43,200 (12 hours).
  --kid=<value>                 [Self-hosted only] Key ID of the key to use for signing the token. If not provided, the
                                first key will be used.
  --subject=<value>             (required) Subject of the token.

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  [Self-hosted] PowerSync API URL. When set, context is treated as self-hosted (exclusive with
                     --instance-id). Resolved: flag → API_URL → cli.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  [Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud
                         (exclusive with --api-url). Resolved: flag → INSTANCE_ID → cli.yaml.
  --org-id=<value>       [Cloud] Organization ID. Resolved: flag → ORG_ID → cli.yaml.
  --project-id=<value>   [Cloud] Project ID. Resolved: flag → PROJECT_ID → cli.yaml.

DESCRIPTION
  Generate a development JWT for client connections.

  Generate a JWT for development clients to connect to PowerSync. Cloud: uses instance dev-token API
  (allow_temporary_tokens must be enabled). Self-hosted: signs with shared secret from config. Requires --subject;
  optional --expires-in-seconds.
```

_See code: [src/commands/generate/token.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/generate/token.ts)_

## `powersync help [COMMAND]`

Display help for powersync.

```
USAGE
  $ powersync help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for powersync.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.37/src/commands/help.ts)_

## `powersync init`

Scaffold a PowerSync config directory from a template.

```
USAGE
  $ powersync init

DESCRIPTION
  Scaffold a PowerSync config directory from a template.

  Scaffold a PowerSync config directory from a template. Use init cloud or init self-hosted. For Cloud, edit
  service.yaml then run link cloud and deploy.
```

_See code: [src/commands/init/index.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/init/index.ts)_

## `powersync init cloud`

Scaffold a PowerSync Cloud config directory from a template.

```
USAGE
  $ powersync init cloud [--directory <value>]

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

DESCRIPTION
  Scaffold a PowerSync Cloud config directory from a template.

  Copy a Cloud template into a config directory (default powersync/). Edit service.yaml then run link cloud and deploy.
```

_See code: [src/commands/init/cloud.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/init/cloud.ts)_

## `powersync init self-hosted`

Scaffold a PowerSync self-hosted config directory from a template.

```
USAGE
  $ powersync init self-hosted [--directory <value>]

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

DESCRIPTION
  Scaffold a PowerSync self-hosted config directory from a template.

  Copy a self-hosted template into a config directory (default powersync/). Configure service.yaml with your self-hosted
  instance details.
```

_See code: [src/commands/init/self-hosted.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/init/self-hosted.ts)_

## `powersync link`

Bind this directory to a Cloud or self-hosted instance (writes cli.yaml).

```
USAGE
  $ powersync link

DESCRIPTION
  Bind this directory to a Cloud or self-hosted instance (writes cli.yaml).

  Write cli.yaml so this directory's config is bound to a PowerSync instance. Once linked, commands use that instance
  without passing IDs. Use link cloud or link self-hosted.
```

_See code: [src/commands/link/index.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/link/index.ts)_

## `powersync link cloud`

Link to a PowerSync Cloud instance (or create one with --create).

```
USAGE
  $ powersync link cloud --org-id <value> --project-id <value> [--create] [--instance-id <value>] [--directory
    <value>]

FLAGS
  --create               Create a new Cloud instance in the given org and project, then link. Do not supply
                         --instance-id when using --create.
  --instance-id=<value>  PowerSync Cloud instance ID. Omit when using --create. Resolved: flag → INSTANCE_ID →
                         cli.yaml.
  --org-id=<value>       (required) Organization ID. Resolved: flag → ORG_ID → cli.yaml.
  --project-id=<value>   (required) Project ID. Resolved: flag → PROJECT_ID → cli.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

DESCRIPTION
  Link to a PowerSync Cloud instance (or create one with --create).

  Write or update cli.yaml with a Cloud instance (instance-id, org-id, project-id). Use --create to create a new
  instance from service.yaml name/region and link it; omit --instance-id when using --create.
```

_See code: [src/commands/link/cloud.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/link/cloud.ts)_

## `powersync link self-hosted`

Link to a self-hosted PowerSync instance by API URL.

```
USAGE
  $ powersync link self-hosted --api-url <value> [--directory <value>]

FLAGS
  --api-url=<value>  (required) Self-hosted PowerSync API base URL (e.g. https://powersync.example.com).

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

DESCRIPTION
  Link to a self-hosted PowerSync instance by API URL.

  Links a self hosted PowerSync instance by API URL.
  API Keys can be specified via input or specified in the TOKEN environment variable.
```

_See code: [src/commands/link/self-hosted.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/link/self-hosted.ts)_

## `powersync login`

Store auth token in secure storage for Cloud commands.

```
USAGE
  $ powersync login

DESCRIPTION
  Store auth token in secure storage for Cloud commands.

  Store a PowerSync auth token (PAT) in secure storage so later Cloud commands run without passing a token. Use TOKEN
  env var for CI or scripts instead.
```

_See code: [src/commands/login.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/login.ts)_

## `powersync logout`

Remove stored auth token from secure storage.

```
USAGE
  $ powersync logout

DESCRIPTION
  Remove stored auth token from secure storage.

  Remove the stored PowerSync auth token from secure storage. Cloud commands will no longer use stored credentials until
  you run login again.
```

_See code: [src/commands/logout.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/logout.ts)_

## `powersync migrate`

Convert self-hosted config to Cloud format (not yet implemented).

```
USAGE
  $ powersync migrate [--directory <value>] [--api-url <value>]

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  PowerSync API URL. Resolved: flag → API_URL environment variable → cli.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

DESCRIPTION
  Convert self-hosted config to Cloud format (not yet implemented).

  Convert a self-hosted service.yaml to PowerSync Cloud format. Self-hosted only. (Not yet implemented.)
```

_See code: [src/commands/migrate.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/migrate.ts)_

## `powersync plugins`

List installed plugins.

```
USAGE
  $ powersync plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ powersync plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.55/src/commands/plugins/index.ts)_

## `powersync plugins add PLUGIN`

Installs a plugin into powersync.

```
USAGE
  $ powersync plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into powersync.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the POWERSYNC_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the POWERSYNC_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ powersync plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ powersync plugins add myplugin

  Install a plugin from a github url.

    $ powersync plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ powersync plugins add someuser/someplugin
```

## `powersync plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ powersync plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ powersync plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.55/src/commands/plugins/inspect.ts)_

## `powersync plugins install PLUGIN`

Installs a plugin into powersync.

```
USAGE
  $ powersync plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into powersync.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the POWERSYNC_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the POWERSYNC_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ powersync plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ powersync plugins install myplugin

  Install a plugin from a github url.

    $ powersync plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ powersync plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.55/src/commands/plugins/install.ts)_

## `powersync plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ powersync plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ powersync plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.55/src/commands/plugins/link.ts)_

## `powersync plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ powersync plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ powersync plugins unlink
  $ powersync plugins remove

EXAMPLES
  $ powersync plugins remove myplugin
```

## `powersync plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ powersync plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.55/src/commands/plugins/reset.ts)_

## `powersync plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ powersync plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ powersync plugins unlink
  $ powersync plugins remove

EXAMPLES
  $ powersync plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.55/src/commands/plugins/uninstall.ts)_

## `powersync plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ powersync plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ powersync plugins unlink
  $ powersync plugins remove

EXAMPLES
  $ powersync plugins unlink myplugin
```

## `powersync plugins update`

Update installed plugins.

```
USAGE
  $ powersync plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.55/src/commands/plugins/update.ts)_

## `powersync pull`

Download Cloud config into local service.yaml and sync.yaml.

```
USAGE
  $ powersync pull

DESCRIPTION
  Download Cloud config into local service.yaml and sync.yaml.

  Download current config from PowerSync Cloud into local YAML files. Use pull config; pass --instance-id, --org-id,
  --project-id to link first if not already linked.
```

_See code: [src/commands/pull/index.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/pull/index.ts)_

## `powersync pull config`

Download Cloud config and sync rules into local service.yaml and sync.yaml.

```
USAGE
  $ powersync pull config [--directory <value>] [--instance-id <value> --org-id <value> --project-id <value>]

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID. Manually passed if the current context has not been linked.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  Download Cloud config and sync rules into local service.yaml and sync.yaml.

  Fetch instance config and sync rules from PowerSync Cloud and write to service.yaml and sync.yaml in the config
  directory. Writes cli.yaml if you pass --instance-id, --org-id, --project-id. Cloud only.
```

_See code: [src/commands/pull/config.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/pull/config.ts)_

## `powersync stop`

Stop the linked Cloud instance (restart with deploy).

```
USAGE
  $ powersync stop [--confirm yes] [--directory <value>] [--instance-id <value> --org-id <value>
    --project-id <value>]

FLAGS
  --confirm=<option>  Set to "yes" to confirm stopping the instance.
                      <options: yes>

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID. Manually passed if the current context has not been linked.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  Stop the linked Cloud instance (restart with deploy).

  Deactivate the linked PowerSync Cloud instance. Requires --confirm=yes. Restart later with powersync deploy. Cloud
  only.
```

_See code: [src/commands/stop.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/stop.ts)_

## `powersync validate`

Validate config schema, connections, and sync rules before deploy.

```
USAGE
  $ powersync validate [--output human|json|yaml] [--api-url <value> | --instance-id <value> | --org-id
    <value> | --project-id <value>] [--directory <value>]

FLAGS
  --output=<option>  [default: human] Output format: human-readable, json, or yaml.
                     <options: human|json|yaml>

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  [Self-hosted] PowerSync API URL. When set, context is treated as self-hosted (exclusive with
                     --instance-id). Resolved: flag → API_URL → cli.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  [Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud
                         (exclusive with --api-url). Resolved: flag → INSTANCE_ID → cli.yaml.
  --org-id=<value>       [Cloud] Organization ID. Resolved: flag → ORG_ID → cli.yaml.
  --project-id=<value>   [Cloud] Project ID. Resolved: flag → PROJECT_ID → cli.yaml.

DESCRIPTION
  Validate config schema, connections, and sync rules before deploy.

  Run validation checks on local config: config schema, database connections, and sync rules. Requires a linked
  instance. Works with Cloud and self-hosted.
```

_See code: [src/commands/validate.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/validate.ts)_
<!-- commandsstop -->
