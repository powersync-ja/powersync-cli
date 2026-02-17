# @powersync/cli

CLI for PowerSync

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@powersync/cli.svg)](https://npmjs.org/package/@powersync/cli)
[![Downloads/week](https://img.shields.io/npm/dw/@powersync/cli.svg)](https://npmjs.org/package/@powersync/cli)

<!-- toc -->
* [@powersync/cli](#powersynccli)
* [Overview](#overview)
* [Cloud](#cloud)
* [Self-hosted](#self-hosted)
* [Known Limitations](#known-limitations)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Overview

The PowerSync CLI lets you manage PowerSync instances and run commands (generate schemas, tokens, validate config, fetch status, and more). Support is split into two modes:

- **Cloud** – Full support for [PowerSync Cloud](https://powersync.com). You can create new instances, deploy and pull config from the Dashboard, and run all Cloud commands. Authenticate with **`powersync login`** (or the `TOKEN` env var), then use **`powersync init cloud`** / **`powersync link cloud`** or **`powersync pull instance`** to work with projects.
- **Self-hosted** – Limited support for your own PowerSync Service. You link to an existing running instance and can run a subset of commands (e.g. **`powersync fetch status`**, **`powersync generate schema`**, **`powersync validate`**). The CLI does not create, deploy to, or pull config from self-hosted instances; you manage the server and its config yourself. A [Docker plugin](../plugins/docker/README.md) is available for local self-hosted development.

The sections below go into detail for [Cloud](#cloud) and [Self-hosted](#self-hosted).

# Cloud

The CLI supports **PowerSync Cloud** for creating instances, deploying config, pulling config, and running commands. Cloud workflows use a **config directory** (default `powersync/`) containing **`service.yaml`**, **`sync.yaml`**, and optionally **`cli.yaml`** (the link file written by **powersync link cloud**). All PowerSync YAML files support the **`!env`** custom tag (e.g. `!env MY_VAR` or `!env MY_VAR::number`) for secrets and environment-specific values.

## Login

Cloud commands require a PowerSync **personal access token (PAT)**. You can authenticate in two ways:

**1. Interactive login (recommended for local use)**  
Run **`powersync login`**. You can either open a browser to create a token in the [PowerSync Dashboard](https://dashboard.powersync.com/account/access-tokens/create) or paste an existing token. On **macOS**, the token is stored in Keychain so you don’t need to pass it again. On **Windows and Linux**, secure storage is not yet supported—use the **`TOKEN`** environment variable instead (see below).

**2. Environment variable (CI, scripts, or when not using macOS)**  
Set **`TOKEN`** to your PAT. The CLI uses **`TOKEN`** when set; otherwise it uses the token from **`powersync login`**. Example:

```sh
export TOKEN=your-personal-access-token
powersync fetch instances --project-id=<project-id>
```

To stop using stored credentials, run **`powersync logout`**.

## Creating a new instance

Run **`powersync init cloud`** to scaffold the config directory. Configure **`service.yaml`** (name, region, replication, optional client auth) and sync rules; use **`!env`** for all secrets. Then run **`powersync link cloud --create`** with `--project-id` to create the instance and write **`cli.yaml`**. (Add `--org-id` only if your token has access to multiple organizations.) After that you can run **`powersync deploy`** and manage config from the project (or switch to managing it externally if you prefer).

```sh
powersync init cloud
  # then edit powersync/service.yaml and sync rules
powersync login
powersync link cloud --create --project-id=<project-id>   # add --org-id if token has multiple orgs
powersync deploy
```

Use `--directory` for a different config folder. The **powersync init cloud** command has a `--vscode` flag to configure your workspace for YAML custom tag support.

## Using an existing instance (pull)

Run **`powersync pull instance`** with the instance identifiers (from the PowerSync Dashboard URL or **`powersync fetch instances`**). This creates the config directory, writes **`cli.yaml`**, and downloads **`service.yaml`** and **`sync.yaml`**. Edit as needed, then run **`powersync deploy`**.

```sh
powersync login
powersync pull instance --project-id=<project-id> --instance-id=<instance-id>   # add --org-id if multiple orgs
  # then edit powersync/service.yaml and sync.yaml as needed
powersync deploy
```

To refresh local config after external edits from the cloud when already linked, run **`powersync pull instance`** again.

## Running commands against externally managed instances

You can run CLI commands (e.g. **`powersync generate schema`**, **`powersync generate token`**, **`powersync fetch status`**) against a Cloud instance whose configuration is managed elsewhere—for example in the PowerSync Dashboard. No local config directory or link file is required.

Specify the instance using **environment variables** or **CLI flags** (flags take precedence): `--instance-id` and `--project-id` (or `INSTANCE_ID`, `PROJECT_ID`). **`--org-id` is optional**: when omitted, the CLI uses the token’s single organization if the token has access to exactly one; if the token has multiple orgs, you must pass **`--org-id`** (or set `ORG_ID`).

```sh
powersync login
powersync generate schema --instance-id=<id> --project-id=<project-id> --output-path=schema.ts --output=ts   # add --org-id if multiple orgs
  # or with env vars (set ORG_ID only if your token has multiple orgs):
export PROJECT_ID=<project-id>
export INSTANCE_ID=<instance-id>
powersync generate schema --output-path=schema.ts --output=ts
```

**Tip:** To avoid passing instance params on every command, run **`powersync link cloud`** (e.g. `powersync link cloud --instance-id=<id> --project-id=<project-id>`) once. The CLI writes `cli.yaml` in the current directory, and subsequent commands use that instance without flags or env vars.

# Self-hosted

The CLI can run a subset of commands against **self-hosted** PowerSync instances (your own API). Self-hosted support is more limited than Cloud: you link to an existing running API and use the same config directory concept, but only certain commands apply (e.g. **`powersync fetch status`**, **`powersync generate schema`**, **`powersync generate token`**, **`powersync validate`**). There is no **deploy** or **pull instance** for self-hosted; you manage config on the server yourself.

## Authentication

For any self-hosted instance (local or remote), you must link the running API to the CLI and configure an API key. On the **server** (your PowerSync instance config), define the tokens that are valid in **`service.yaml`**:

```yaml
  # powersync/service.yaml (self-hosted instance config)
api:
  tokens:
    - dev-token-do-not-use-in-production # or use !env MY_API_TOKEN for secrets
```

Then tell the CLI which token to use when running commands. Run **`powersync link self-hosted --api-url <url>`** to write **`cli.yaml`** with the API URL, and either set the **`TOKEN`** environment variable or set **`api_key`** in **`cli.yaml`**:

```yaml
  # powersync/cli.yaml (self-hosted)
type: self-hosted
api_url: https://powersync.example.com
api_key: !env TOKEN # or a literal value matching one of the tokens in service.yaml
```

The CLI resolves **`!env TOKEN`** from the `TOKEN` environment variable at runtime. If both are set, the environment variable takes precedence.

## Creating a self-hosted project and limitations

Run **`powersync init self-hosted`** to scaffold a config directory. Edit **`service.yaml`** with your instance details and use **`!env`** for secrets. This gives you a **partial** project: the CLI does not create or provision a self-hosted instance. You must already have a running PowerSync API. The CLI cannot deploy config to or pull config from a self-hosted instance; you manage **`service.yaml`** and **`sync.yaml`** on the server yourself. Use the CLI to link (**`powersync link self-hosted --api-url <url>`**), then run the supported commands (e.g. **`powersync fetch status`**, **`powersync generate schema`**) against that API.

```sh
powersync init self-hosted
  # then edit powersync/service.yaml
powersync link self-hosted --api-url https://powersync.example.com
powersync fetch status
```

Use `--directory` for a different config folder.

## Docker plugin for local development

We provide a [Docker plugin](../plugins/docker/README.md) for running a self-hosted stack locally. Use **`powersync docker configure`** then **`powersync docker start`** to run the stack. Use **`powersync docker reset`** only when you need to start from a clean state (stop and remove, then start).

## Command support

Only some CLI commands work with self-hosted instances. Supported commands include **`powersync fetch status`**, **`powersync generate schema`**, **`powersync generate token`**, **`powersync validate`**, and **`powersync link self-hosted`**. Cloud-only commands such as **`powersync deploy`**, **`powersync destroy`**, **`powersync pull instance`**, **`powersync fetch config`**, and **`powersync fetch instances`** do not apply to self-hosted.

# Known Limitations

- **Login secure storage**: Secure storage for auth tokens is only supported on macOS (via Keychain). On Windows and Linux, `powersync login` will not persist credentials; use the `TOKEN` environment variable instead for Cloud commands.

# Usage

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
* [`powersync init base`](#powersync-init-base)
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
* [`powersync pull instance`](#powersync-pull-instance)
* [`powersync stop`](#powersync-stop)
* [`powersync validate`](#powersync-validate)

## `powersync deploy`

Push local config to the linked Cloud instance (connections + sync rules).

```
USAGE
  $ powersync deploy [--directory <value>] [--instance-id <value> --project-id <value>] [--org-id <value>]

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID (optional). Defaults to the token’s single org when only one is available; pass
                         explicitly if the token has multiple orgs.
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
  $ powersync destroy [--confirm yes] [--directory <value>] [--instance-id <value> --project-id <value>]
    [--org-id <value>]

FLAGS
  --confirm=<option>  Set to "yes" to confirm destruction of the instance.
                      <options: yes>

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID (optional). Defaults to the token’s single org when only one is available; pass
                         explicitly if the token has multiple orgs.
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
  $ powersync docker configure [--directory <value>] [--api-url <value>] [--database postgres|external|none]
    [--storage postgres|external|none]

FLAGS
  --database=<option>  Database module for replication source. Omit to be prompted.
                       <options: postgres|external|none>
  --storage=<option>   Storage module for PowerSync bucket metadata. Omit to be prompted.
                       <options: postgres|external|none>

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
  $ powersync fetch config [--output json|yaml] [--directory <value>] [--instance-id <value> --project-id <value>]
    [--org-id <value>]

FLAGS
  --output=<option>  [default: yaml] Output format: yaml or json.
                     <options: json|yaml>

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID (optional). Defaults to the token’s single org when only one is available; pass
                         explicitly if the token has multiple orgs.
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

  List PowerSync Cloud instances. Use with a linked directory or optionally pass --org-id and --project-id to filter
  (omit to list all orgs and projects). Cloud only.
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
  --org-id=<value>       [Cloud] Organization ID (optional). Defaults to the token’s single org when only one is
                         available; pass explicitly if the token has multiple orgs. Resolved: flag → ORG_ID → cli.yaml.
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
  --org-id=<value>       [Cloud] Organization ID (optional). Defaults to the token’s single org when only one is
                         available; pass explicitly if the token has multiple orgs. Resolved: flag → ORG_ID → cli.yaml.
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
  --org-id=<value>       [Cloud] Organization ID (optional). Defaults to the token’s single org when only one is
                         available; pass explicitly if the token has multiple orgs. Resolved: flag → ORG_ID → cli.yaml.
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

## `powersync init base`

```
USAGE
  $ powersync init base [--directory <value>] [--vscode]

FLAGS
  --vscode  Configure the workspace with .vscode settings for YAML custom tags (!env).

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.
```

_See code: [src/commands/init/base.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/init/base.ts)_

## `powersync init cloud`

Scaffold a PowerSync Cloud config directory from a template.

```
USAGE
  $ powersync init cloud [--directory <value>] [--vscode]

FLAGS
  --vscode  Configure the workspace with .vscode settings for YAML custom tags (!env).

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
  $ powersync init self-hosted [--directory <value>] [--vscode]

FLAGS
  --vscode  Configure the workspace with .vscode settings for YAML custom tags (!env).

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
  $ powersync link cloud --project-id <value> [--create] [--instance-id <value>] [--org-id <value>] [--directory
    <value>]

FLAGS
  --create               Create a new Cloud instance in the given org and project, then link. Do not supply
                         --instance-id when using --create.
  --instance-id=<value>  PowerSync Cloud instance ID. Omit when using --create. Resolved: flag → INSTANCE_ID → cli.yaml.
  --org-id=<value>       Organization ID. Optional when the token has a single org; required when the token has multiple
                         orgs. Resolved: flag → ORG_ID → cli.yaml.
  --project-id=<value>   (required) Project ID. Resolved: flag → PROJECT_ID → cli.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

DESCRIPTION
  Link to a PowerSync Cloud instance (or create one with --create).

  Write or update cli.yaml with a Cloud instance (instance-id, org-id, project-id). Use --create to create a new
  instance from service.yaml name/region and link it; omit --instance-id when using --create. Org ID is optional when
  the token has a single organization.
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

  Download current config from PowerSync Cloud into local YAML files. Use pull instance; pass --instance-id and
  --project-id when the directory is not yet linked (--org-id is optional when the token has a single organization).
```

_See code: [src/commands/pull/index.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/pull/index.ts)_

## `powersync pull config`

Download Cloud config and sync rules into local service.yaml and sync.yaml.

```
USAGE
  $ powersync pull config [--directory <value>] [--instance-id <value> --project-id <value>] [--org-id <value>]

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID (optional). Defaults to the token’s single org when only one is available; pass
                         explicitly if the token has multiple orgs.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  Download Cloud config and sync rules into local service.yaml and sync.yaml.

  Fetch instance config and sync rules from PowerSync Cloud and write to service.yaml and sync.yaml in the config
  directory. Writes cli.yaml if you pass --instance-id, --org-id, --project-id. Cloud only.
```

_See code: [src/commands/pull/config.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/pull/config.ts)_

## `powersync pull instance`

Pull an existing Cloud instance: link and download config into local service.yaml and sync.yaml.

```
USAGE
  $ powersync pull instance [--directory <value>] [--instance-id <value> --project-id <value>] [--org-id <value>]

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID (optional). Defaults to the token’s single org when only one is available; pass
                         explicitly if the token has multiple orgs.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  Pull an existing Cloud instance: link and download config into local service.yaml and sync.yaml.

  Fetch an existing Cloud instance by ID: create the config directory if needed, write cli.yaml, and download
  service.yaml and sync.yaml. Pass --instance-id and --project-id when the directory is not yet linked; --org-id is
  optional when the token has a single organization. Cloud only.
```

_See code: [src/commands/pull/instance.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/pull/instance.ts)_

## `powersync stop`

Stop the linked Cloud instance (restart with deploy).

```
USAGE
  $ powersync stop [--confirm yes] [--directory <value>] [--instance-id <value> --project-id <value>]
    [--org-id <value>]

FLAGS
  --confirm=<option>  Set to "yes" to confirm stopping the instance.
                      <options: yes>

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID (optional). Defaults to the token’s single org when only one is available; pass
                         explicitly if the token has multiple orgs.
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
  --org-id=<value>       [Cloud] Organization ID (optional). Defaults to the token’s single org when only one is
                         available; pass explicitly if the token has multiple orgs. Resolved: flag → ORG_ID → cli.yaml.
  --project-id=<value>   [Cloud] Project ID. Resolved: flag → PROJECT_ID → cli.yaml.

DESCRIPTION
  Validate config schema, connections, and sync rules before deploy.

  Run validation checks on local config: config schema, database connections, and sync rules. Requires a linked
  instance. Works with Cloud and self-hosted.
```

_See code: [src/commands/validate.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/validate.ts)_
<!-- commandsstop -->
