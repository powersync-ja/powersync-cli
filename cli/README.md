# powersync

CLI for PowerSync

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@powersync/cli.svg)](https://npmjs.org/package/@powersync/cli)
[![Downloads/week](https://img.shields.io/npm/dw/@powersync/cli.svg)](https://npmjs.org/package/@powersync/cli)

<!-- toc -->

- [powersync](#powersync)
- [Getting Started](#getting-started)
- [Overview](#overview)
- [Cloud](#cloud)
- [Self-hosted](#self-hosted)
- [powersync/service.yaml (self-hosted instance config)](#powersyncserviceyaml-self-hosted-instance-config)
- [powersync/cli.yaml (self-hosted)](#powersynccliyaml-self-hosted)
- [Known Limitations](#known-limitations)
- [OCLIF plugins](#oclif-plugins)
- [list installed plugins](#list-installed-plugins)
- [install a published plugin](#install-a-published-plugin)
- [link a local plugin during development](#link-a-local-plugin-during-development)
- [inspect a plugin](#inspect-a-plugin)
- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

# Getting Started

Install globally or run via `npx`:

```bash
npm install -g powersync
```

```bash
npx powersync --version
```

# Overview

The PowerSync CLI lets you manage PowerSync instances and run commands (generate schemas, tokens, validate config, fetch status, and more). Support is split into two modes:

- **Cloud** – Full support for [PowerSync Cloud](https://powersync.com). You can create new instances, deploy and pull config from the Dashboard, and run all Cloud commands. Authenticate with **`powersync login`** (or the `PS_ADMIN_TOKEN` env var), then use **`powersync init cloud`** / **`powersync link cloud`** or **`powersync pull instance`** to work with projects.
- **Self-hosted** – Limited support for your own PowerSync Service. You link to an existing running instance and can run a subset of commands (e.g. **`powersync fetch status`**, **`powersync generate schema`**, **`powersync validate`**). The CLI does not create, deploy to, or pull config from self-hosted instances; you manage the server and its config yourself. We also expose a [PowerSync Docker topic](../plugins/docker/README.md) for local self-hosted development.

The sections below go into detail for [Cloud](#cloud) and [Self-hosted](#self-hosted).

# Cloud

The CLI supports **PowerSync Cloud** for creating instances, deploying config, pulling config, and running commands. Cloud workflows use a **config directory** (default `powersync/`) containing **`service.yaml`**, **`sync-config.yaml`**, and optionally **`cli.yaml`** (the link file written by **powersync link cloud**). All PowerSync YAML files support the **`!env`** custom tag (e.g. `!env MY_VAR` or `!env MY_VAR::number`) for secrets and environment-specific values.

## Login

Cloud commands require a PowerSync **personal access token (PAT)**. You can authenticate in two ways:

**1. Interactive login (recommended for local use)**  
Run **`powersync login`**. You can either open a browser to create a token in the [PowerSync Dashboard](https://dashboard.powersync.com/account/access-tokens/create) or paste an existing token.

- If secure storage is available, the token is saved there (for example, macOS Keychain).
- If secure storage is unavailable, the CLI asks for confirmation before storing the token in plaintext at **`$XDG_CONFIG_HOME/powersync/config.yaml`** (or **`~/.config/powersync/config.yaml`** when `XDG_CONFIG_HOME` is unset).
- If you decline, login exits without storing a token.

**2. Environment variable (CI, scripts, or non-persistent use)**  
Set **`PS_ADMIN_TOKEN`** to your PAT. The CLI uses **`PS_ADMIN_TOKEN`** when set; otherwise it uses the token from **`powersync login`**. Example:

```sh
export PS_ADMIN_TOKEN=your-personal-access-token
powersync fetch instances --project-id=<project-id>
```

To stop using stored credentials, run **`powersync logout`**. This clears the stored token from the active backend (secure storage or config-file fallback).

## Creating a new instance

Run **`powersync init cloud`** to scaffold the config directory. Configure **`service.yaml`** (name, region, replication, optional client auth) and sync config; use **`!env`** for all secrets. Then run **`powersync link cloud --create`** with `--project-id` to create the instance and write **`cli.yaml`**. (Add `--org-id` only if your token has access to multiple organizations.) After that you can run **`powersync deploy`** and manage config from the project (or switch to managing it externally if you prefer).

```sh
powersync init cloud
  # then edit powersync/service.yaml and sync config
powersync login
powersync link cloud --create --project-id=<project-id>   # add --org-id if token has multiple orgs
powersync deploy
```

Use `--directory` for a different config folder. The **powersync init cloud** command has a `--vscode` flag to configure your workspace for YAML custom tag support.

## Cloud secrets format (`service.yaml`)

For Cloud config, secret-backed fields use an object shape. For example, the replication connection password is configured as `replication.connections[].password`.

Use `secret: !env ...` when you want to provide the value from an environment variable during deploy:

```yaml
replication:
  connections:
    - type: postgresql
      password:
        secret: !env POWERSYNC_DATABASE_PASSWORD
```

After an initial deploy, you can keep using the same stored value by switching to `secret_ref` and referencing the default password secret:

```yaml
replication:
  connections:
    - type: postgresql
      password:
        secret_ref: default_password
```

This avoids re-supplying the raw password in subsequent deploys while reusing the previously stored secret.

## Using an existing instance (pull)

Run **`powersync pull instance`** with the instance identifiers (from the PowerSync Dashboard URL or **`powersync fetch instances`**). This creates the config directory, writes **`cli.yaml`**, and downloads **`service.yaml`** and **`sync-config.yaml`**. Edit as needed, then run **`powersync deploy`**.

```sh
powersync login
powersync pull instance --project-id=<project-id> --instance-id=<instance-id>   # add --org-id if multiple orgs
  # then edit powersync/service.yaml and sync-config.yaml as needed
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

Then tell the CLI which token to use when running commands. Run **`powersync link self-hosted --api-url <url>`** to write **`cli.yaml`** with the API URL, and either set the **`PS_ADMIN_TOKEN`** environment variable or set **`api_key`** in **`cli.yaml`**:

```yaml
# powersync/cli.yaml (self-hosted)
type: self-hosted
api_url: https://powersync.example.com
api_key: !env PS_ADMIN_TOKEN # or a literal value matching one of the tokens in service.yaml
```

The CLI resolves **`!env PS_ADMIN_TOKEN`** from the `PS_ADMIN_TOKEN` environment variable at runtime. If both are set, the environment variable takes precedence.

## Creating a self-hosted project and limitations

Run **`powersync init self-hosted`** to scaffold a config directory. Edit **`service.yaml`** with your instance details and use **`!env`** for secrets. This gives you a **partial** project: the CLI does not create or provision a self-hosted instance. You must already have a running PowerSync API. The CLI cannot deploy config to or pull config from a self-hosted instance; you manage **`service.yaml`** and **`sync-config.yaml`** on the server yourself. Use the CLI to link (**`powersync link self-hosted --api-url <url>`**), then run the supported commands (e.g. **`powersync fetch status`**, **`powersync generate schema`**) against that API.

```sh
powersync init self-hosted
  # then edit powersync/service.yaml
powersync link self-hosted --api-url https://powersync.example.com
powersync fetch status
```

Use `--directory` for a different config folder.

## PowerSync Docker topic for local development

We expose a [PowerSync Docker topic](../plugins/docker/README.md) for running a self-hosted stack locally. Use **`powersync docker configure`** then **`powersync docker start`** to run the stack. Use **`powersync docker reset`** only when you need to start from a clean state (stop and remove, then start).

## Command support

Only some CLI commands work with self-hosted instances. Supported commands include **`powersync fetch status`**, **`powersync generate schema`**, **`powersync generate token`**, **`powersync validate`**, and **`powersync link self-hosted`**. Cloud-only commands such as **`powersync deploy`**, **`powersync destroy`**, **`powersync pull instance`**, **`powersync fetch config`**, and **`powersync fetch instances`** do not apply to self-hosted.

# Known Limitations

- **Plaintext fallback storage**: When secure storage is unavailable, login can store the token in plaintext config (`$XDG_CONFIG_HOME/powersync/config.yaml` or `~/.config/powersync/config.yaml`) only after explicit confirmation.

# OCLIF plugins

The CLI honors standard [OCLIF plugin behavior](https://oclif.io/docs/plugins/), so plugins can register commands or hook into command lifecycles. The bundled PowerSync Docker topic (`@powersync/cli-plugin-docker`) is implemented this way and serves as a reference.

For PowerSync-specific plugins, the optional `@powersync/cli-core` package exposes base command helpers and shared types; the PowerSync Docker topic consumes these helpers to add its Docker-focused commands.

You can manage plugins dynamically at runtime:

```sh
# list installed plugins
powersync plugins

# install a published plugin
powersync plugins install @example/powersync-plugin-foo

# link a local plugin during development
powersync plugins link ../my-plugin

# inspect a plugin
powersync plugins:inspect @example/powersync-plugin-foo
```

# Usage

<!-- usage -->

```sh-session
$ npm install -g powersync
$ powersync COMMAND
running command...
$ powersync (--version)
powersync/0.0.0 darwin-arm64 node-v24.13.0
$ powersync --help [COMMAND]
USAGE
  $ powersync COMMAND
...
```

<!-- usagestop -->

## Environment variables

You can supply instance and auth context via environment variables (useful for CI or scripts):

- **`PS_ADMIN_TOKEN`** — PowerSync personal access token for Cloud commands. [Learn more](https://docs.powersync.com/usage/tools/cli#personal-access-token).
- **`ORG_ID`** — Organization ID (optional for Cloud). Omit when your token has a single organization; required when it has multiple.
- **`PROJECT_ID`** — Project ID (Cloud).
- **`INSTANCE_ID`** — Instance ID (Cloud). Get IDs from the [PowerSync Dashboard](https://dashboard.powersync.com) or **`powersync fetch instances`**.
- **`API_URL`** — Self-hosted PowerSync API base URL (e.g. `https://powersync.example.com`).

Example (Cloud):

```sh
PS_ADMIN_TOKEN=your-token PROJECT_ID=456 INSTANCE_ID=789 powersync fetch status
```

See [docs/usage.md](../docs/usage.md) for full usage and resolution order (flags, env, cli.yaml).

# Commands

<!-- commands -->

- [`powersync autocomplete [SHELL]`](#powersync-autocomplete-shell)
- [`powersync commands`](#powersync-commands)
- [`powersync deploy`](#powersync-deploy)
- [`powersync deploy service-config`](#powersync-deploy-service-config)
- [`powersync deploy sync-config`](#powersync-deploy-sync-config)
- [`powersync destroy`](#powersync-destroy)
- [`powersync docker configure`](#powersync-docker-configure)
- [`powersync docker reset`](#powersync-docker-reset)
- [`powersync docker start`](#powersync-docker-start)
- [`powersync docker stop`](#powersync-docker-stop)
- [`powersync fetch config`](#powersync-fetch-config)
- [`powersync fetch instances`](#powersync-fetch-instances)
- [`powersync fetch status`](#powersync-fetch-status)
- [`powersync generate schema`](#powersync-generate-schema)
- [`powersync generate token`](#powersync-generate-token)
- [`powersync help [COMMAND]`](#powersync-help-command)
- [`powersync init cloud`](#powersync-init-cloud)
- [`powersync init self-hosted`](#powersync-init-self-hosted)
- [`powersync link cloud`](#powersync-link-cloud)
- [`powersync link self-hosted`](#powersync-link-self-hosted)
- [`powersync login`](#powersync-login)
- [`powersync logout`](#powersync-logout)
- [`powersync migrate sync-rules`](#powersync-migrate-sync-rules)
- [`powersync plugins`](#powersync-plugins)
- [`powersync plugins add PLUGIN`](#powersync-plugins-add-plugin)
- [`powersync plugins:inspect PLUGIN...`](#powersync-pluginsinspect-plugin)
- [`powersync plugins install PLUGIN`](#powersync-plugins-install-plugin)
- [`powersync plugins link PATH`](#powersync-plugins-link-path)
- [`powersync plugins remove [PLUGIN]`](#powersync-plugins-remove-plugin)
- [`powersync plugins reset`](#powersync-plugins-reset)
- [`powersync plugins uninstall [PLUGIN]`](#powersync-plugins-uninstall-plugin)
- [`powersync plugins unlink [PLUGIN]`](#powersync-plugins-unlink-plugin)
- [`powersync plugins update`](#powersync-plugins-update)
- [`powersync pull instance`](#powersync-pull-instance)
- [`powersync status`](#powersync-status)
- [`powersync stop`](#powersync-stop)
- [`powersync validate`](#powersync-validate)

## `powersync autocomplete [SHELL]`

Display autocomplete installation instructions.

```
USAGE
  $ powersync autocomplete [SHELL] [-r]

ARGUMENTS
  [SHELL]  (zsh|bash|powershell) Shell type

FLAGS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

DESCRIPTION
  Display autocomplete installation instructions.

EXAMPLES
  $ powersync autocomplete

  $ powersync autocomplete bash

  $ powersync autocomplete zsh

  $ powersync autocomplete powershell

  $ powersync autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v3.2.40/src/commands/autocomplete/index.ts)_

## `powersync commands`

List all powersync commands.

```
USAGE
  $ powersync commands [--json] [-c id|plugin|summary|type... | --tree] [--deprecated] [-x | ] [--hidden]
    [--no-truncate | ] [--sort id|plugin|summary|type | ]

FLAGS
  -c, --columns=<option>...  Only show provided columns (comma-separated).
                             <options: id|plugin|summary|type>
  -x, --extended             Show extra columns.
      --deprecated           Show deprecated commands.
      --hidden               Show hidden commands.
      --no-truncate          Do not truncate output.
      --sort=<option>        [default: id] Property to sort by.
                             <options: id|plugin|summary|type>
      --tree                 Show tree of commands.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List all powersync commands.
```

_See code: [@oclif/plugin-commands](https://github.com/oclif/plugin-commands/blob/v4.1.40/src/commands/commands.ts)_

## `powersync deploy`

[Cloud only] Deploy local config to the linked Cloud instance (connections + auth + sync config).

```
USAGE
  $ powersync deploy [--deploy-timeout <value>] [--directory <value>] [--instance-id <value> --project-id
    <value>] [--org-id <value>]

FLAGS
  --deploy-timeout=<value>  [default: 300] Seconds to wait after scheduling a deploy before timing out while polling
                            status (default 300 seconds).

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID (optional). Defaults to the token’s single org when only one is available; pass
                         explicitly if the token has multiple orgs.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  [Cloud only] Deploy local config to the linked Cloud instance (connections + auth + sync config).

  Deploy local config (service.yaml, sync config) to the linked PowerSync Cloud instance.
  Validates connections and sync config before deploying.
  See also powersync deploy sync-config to deploy only sync config changes.
  See also powersync deploy service-config to deploy only service config changes.

EXAMPLES
  $ powersync deploy

  $ powersync deploy --instance-id=<id> --project-id=<id>
```

_See code: [src/commands/deploy/index.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/deploy/index.ts)_

## `powersync deploy service-config`

[Cloud only] Deploy only local service config to the linked Cloud instance.

```
USAGE
  $ powersync deploy service-config [--deploy-timeout <value>] [--directory <value>] [--instance-id <value> --project-id
    <value>] [--org-id <value>]

FLAGS
  --deploy-timeout=<value>  [default: 300] Seconds to wait after scheduling a deploy before timing out while polling
                            status (default 300 seconds).

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID (optional). Defaults to the token’s single org when only one is available; pass
                         explicitly if the token has multiple orgs.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  [Cloud only] Deploy only local service config to the linked Cloud instance.

  Deploy only service config changes (without sync config updates).

EXAMPLES
  $ powersync deploy service-config

  $ powersync deploy service-config --instance-id=<id> --project-id=<id>
```

_See code: [src/commands/deploy/service-config.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/deploy/service-config.ts)_

## `powersync deploy sync-config`

[Cloud only] Deploy only local sync config to the linked Cloud instance.

```
USAGE
  $ powersync deploy sync-config [--deploy-timeout <value>] [--directory <value>] [--instance-id <value> --project-id
    <value>] [--org-id <value>]

FLAGS
  --deploy-timeout=<value>  [default: 300] Seconds to wait after scheduling a deploy before timing out while polling
                            status (default 300 seconds).

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID (optional). Defaults to the token’s single org when only one is available; pass
                         explicitly if the token has multiple orgs.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  [Cloud only] Deploy only local sync config to the linked Cloud instance.

  Deploy only sync config changes.

EXAMPLES
  $ powersync deploy sync-config

  $ powersync deploy sync-config --instance-id=<id> --project-id=<id>
```

_See code: [src/commands/deploy/sync-config.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/deploy/sync-config.ts)_

## `powersync destroy`

[Cloud only] Permanently destroy the linked Cloud instance.

```
USAGE
  $ powersync destroy [--confirm yes] [--directory <value>] [--instance-id <value> --project-id <value>]
    [--org-id <value>]

FLAGS
  --confirm=<option>  Set to "yes" to confirm destruction of the instance.
                      <options: yes>

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID (optional). Defaults to the token’s single org when only one is available; pass
                         explicitly if the token has multiple orgs.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  [Cloud only] Permanently destroy the linked Cloud instance.

  Permanently delete the linked PowerSync Cloud instance and its data. Requires --confirm=yes.

EXAMPLES
  $ powersync destroy

  $ powersync destroy --confirm=yes
```

_See code: [src/commands/destroy.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/destroy.ts)_

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
  --api-url=<value>  PowerSync API URL. Resolved: flag → cli.yaml → API_URL environment variable.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

DESCRIPTION
  Configures a self hosted project with Docker Compose services.

  Configures a self hosted project with Docker Compose services.
  Docker configuration is located in ./powersync/docker/.
  Configured projects can be started with "powersync docker start".

EXAMPLES
  $ powersync docker configure

  $ powersync docker configure --database=postgres --storage=postgres
```

## `powersync docker reset`

Reset the self-hosted PowerSync stack (stop and remove, then start).

```
USAGE
  $ powersync docker reset [--directory <value>] [--api-url <value>]

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  PowerSync API URL. Resolved: flag → cli.yaml → API_URL environment variable.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

DESCRIPTION
  Reset the self-hosted PowerSync stack (stop and remove, then start).

  Run `docker compose down` then `docker compose up -d --wait`: stops and removes containers, then starts the stack and
  waits for services (including PowerSync) to be healthy. Use when you want a clean bring-up (e.g. after config
  changes). Use `powersync fetch status` to debug running instances.

EXAMPLES
  $ powersync docker reset
```

## `powersync docker start`

Start the self-hosted PowerSync stack via Docker Compose.

```
USAGE
  $ powersync docker start [--directory <value>] [--api-url <value>]

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  PowerSync API URL. Resolved: flag → cli.yaml → API_URL environment variable.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

DESCRIPTION
  Start the self-hosted PowerSync stack via Docker Compose.

  Runs `docker compose up -d --wait` for the project docker/ compose file; waits for services (including PowerSync) to
  be healthy. Use `powersync fetch status` to debug running instances.

EXAMPLES
  $ powersync docker start
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
  --api-url=<value>  PowerSync API URL. Resolved: flag → cli.yaml → API_URL environment variable.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

DESCRIPTION
  Stop a PowerSync Docker Compose project by name.

  Run `docker compose -p <project-name> stop` (containers are not removed by default). Does not require the project
  directory or a compose file, so you can run it from anywhere (e.g. after a reset conflict). Use --project-name or run
  from a project with cli.yaml to choose which project to stop. Use --remove to also remove the containers. Use
  --remove-volumes to also remove volumes (e.g. to re-run DB init scripts on next reset).

EXAMPLES
  $ powersync docker stop

  $ powersync docker stop --project-name=powersync_myapp --remove
```

## `powersync fetch config`

[Cloud only] Print linked Cloud instance config (YAML or JSON).

```
USAGE
  $ powersync fetch config [--output json|yaml] [--directory <value>] [--instance-id <value> --project-id <value>]
    [--org-id <value>]

FLAGS
  --output=<option>  [default: yaml] Output format: yaml or json.
                     <options: json|yaml>

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID (optional). Defaults to the token’s single org when only one is available; pass
                         explicitly if the token has multiple orgs.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  [Cloud only] Print linked Cloud instance config (YAML or JSON).

  Retrieve the current instance config from PowerSync Cloud and print as YAML or JSON.

EXAMPLES
  $ powersync fetch config

  $ powersync fetch config --output=json
```

_See code: [src/commands/fetch/config.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/fetch/config.ts)_

## `powersync fetch instances`

[Cloud only] List Cloud instances in the current org/project.

```
USAGE
  $ powersync fetch instances [--org-id <value>] [--output human|json] [--output-file <value>] [--project-id <value>]

FLAGS
  --org-id=<value>       Optional Organization ID. Defaults to all organizations.
  --output=<option>      [default: human] Output format: human or json.
                         <options: human|json>
  --output-file=<value>  Optionally write instance information to a file.
  --project-id=<value>   Optional Project ID. Defaults to all projects in the org.

DESCRIPTION
  [Cloud only] List Cloud instances in the current org/project.

  List PowerSync Cloud instances, grouped by organization and project.

EXAMPLES
  $ powersync fetch instances

  $ powersync fetch instances --project-id=<id> --output=json
```

_See code: [src/commands/fetch/instances.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/fetch/instances.ts)_

## `powersync fetch status`

Show instance diagnostics (connections, sync config, replication).

```
USAGE
  $ powersync fetch status [--output human|json|yaml] [--api-url <value> | --instance-id <value> | --org-id
    <value> | --project-id <value>] [--directory <value>]

FLAGS
  --output=<option>  [default: human] Output format: human-readable, json, or yaml.
                     <options: human|json|yaml>

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  [Self-hosted] PowerSync API URL. When set, context is treated as self-hosted (exclusive with
                     --instance-id). Resolved: flag → cli.yaml → API_URL.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  [Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud
                         (exclusive with --api-url). Resolved: flag → cli.yaml → INSTANCE_ID.
  --org-id=<value>       [Cloud] Organization ID (optional). Defaults to the token’s single org when only one is
                         available; pass explicitly if the token has multiple orgs. Resolved: flag → cli.yaml → ORG_ID.
  --project-id=<value>   [Cloud] Project ID. Resolved: flag → cli.yaml → PROJECT_ID.

DESCRIPTION
  Show instance diagnostics (connections, sync config, replication).

  Fetch instance diagnostics: connection status, active and deploying sync config, replication state. Output as
  human-readable, JSON, or YAML. Cloud and self-hosted.

EXAMPLES
  $ powersync fetch status

  $ powersync fetch status --output=json

  $ powersync fetch status --instance-id=<id> --project-id=<id>
```

_See code: [src/commands/fetch/status.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/fetch/status.ts)_

## `powersync generate schema`

Generate client schema file from instance schema and sync config.

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
                     --instance-id). Resolved: flag → cli.yaml → API_URL.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  [Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud
                         (exclusive with --api-url). Resolved: flag → cli.yaml → INSTANCE_ID.
  --org-id=<value>       [Cloud] Organization ID (optional). Defaults to the token’s single org when only one is
                         available; pass explicitly if the token has multiple orgs. Resolved: flag → cli.yaml → ORG_ID.
  --project-id=<value>   [Cloud] Project ID. Resolved: flag → cli.yaml → PROJECT_ID.

DESCRIPTION
  Generate client schema file from instance schema and sync config.

  Generate a client-side schema file from the instance database schema and sync config. Supports multiple output types
  (e.g. type, dart). Requires a linked instance. Cloud and self-hosted.

EXAMPLES
  $ powersync generate schema --output=ts --output-path=schema.ts

  $ powersync generate schema --output=dart --output-path=lib/schema.dart --instance-id=<id> --project-id=<id>
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
                     --instance-id). Resolved: flag → cli.yaml → API_URL.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  [Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud
                         (exclusive with --api-url). Resolved: flag → cli.yaml → INSTANCE_ID.
  --org-id=<value>       [Cloud] Organization ID (optional). Defaults to the token’s single org when only one is
                         available; pass explicitly if the token has multiple orgs. Resolved: flag → cli.yaml → ORG_ID.
  --project-id=<value>   [Cloud] Project ID. Resolved: flag → cli.yaml → PROJECT_ID.

DESCRIPTION
  Generate a development JWT for client connections.

  Generate a JWT for development clients to connect to PowerSync. Cloud: uses instance dev-token API
  (allow_temporary_tokens must be enabled). Self-hosted: signs with shared secret from config. Requires --subject;
  optional --expires-in-seconds.

EXAMPLES
  $ powersync generate token --subject=user-123

  $ powersync generate token --subject=user-123 --expires-in-seconds=3600
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

## `powersync init cloud`

Scaffold a PowerSync Cloud config directory from a template.

```
USAGE
  $ powersync init cloud [--directory <value>] [--vscode]

FLAGS
  --vscode  Configure the workspace with .vscode settings for YAML custom tags (!env).

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

DESCRIPTION
  Scaffold a PowerSync Cloud config directory from a template.

  Copy a Cloud template into a config directory (default powersync/). Edit service.yaml then run link cloud and deploy.

EXAMPLES
  $ powersync init cloud

  $ powersync init cloud --directory=powersync --vscode
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
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

DESCRIPTION
  Scaffold a PowerSync self-hosted config directory from a template.

  Copy a self-hosted template into a config directory (default powersync/). Configure service.yaml with your self-hosted
  instance details.

EXAMPLES
  $ powersync init self-hosted

  $ powersync init self-hosted --directory=powersync --vscode
```

_See code: [src/commands/init/self-hosted.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/init/self-hosted.ts)_

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
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

DESCRIPTION
  Link to a PowerSync Cloud instance (or create one with --create).

  Write or update cli.yaml with a Cloud instance (instance-id, org-id, project-id). Use --create to create a new
  instance from service.yaml name/region and link it; omit --instance-id when using --create. Org ID is optional when
  the token has a single organization.

EXAMPLES
  $ powersync link cloud --project-id=<project-id>

  $ powersync link cloud --create --project-id=<project-id>

  $ powersync link cloud --instance-id=<id> --project-id=<project-id> --org-id=<org-id>
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
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

DESCRIPTION
  Link to a self-hosted PowerSync instance by API URL.

  Links a self hosted PowerSync instance by API URL.
  API Keys can be specified via input or specified in the PS_ADMIN_TOKEN environment variable.

EXAMPLES
  $ powersync link self-hosted --api-url=https://powersync.example.com
```

_See code: [src/commands/link/self-hosted.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/link/self-hosted.ts)_

## `powersync login`

Store auth token for Cloud commands.

```
USAGE
  $ powersync login

DESCRIPTION
  Store auth token for Cloud commands.

  Store a PowerSync auth token (PAT) in secure storage so later Cloud commands run without passing a token. If secure
  storage is unavailable, login can optionally store it in a local config file. Use PS_ADMIN_TOKEN env var for CI or
  scripts instead.

EXAMPLES
  $ powersync login
```

_See code: [src/commands/login.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/login.ts)_

## `powersync logout`

Remove stored auth token.

```
USAGE
  $ powersync logout

DESCRIPTION
  Remove stored auth token.

  Remove the stored PowerSync auth token from secure storage or local fallback config storage. Cloud commands will no
  longer use stored credentials until you run login again.

EXAMPLES
  $ powersync logout
```

_See code: [src/commands/logout.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/logout.ts)_

## `powersync migrate sync-rules`

Migrates Sync Rules to Sync Streams

```
USAGE
  $ powersync migrate sync-rules [--input-file <value>] [--output-file <value>] [--directory <value>]

FLAGS
  --input-file=<value>   Path to the input sync rules file. Defaults to the project sync-config.yaml file.
  --output-file=<value>  Path to the output sync streams file. Defaults to overwrite the input file.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

DESCRIPTION
  Migrates Sync Rules to Sync Streams

  Migrates Sync Rules to Sync Streams
```

_See code: [src/commands/migrate/sync-rules.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/migrate/sync-rules.ts)_

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

## `powersync pull instance`

Pull an existing Cloud instance: link and download config into local service.yaml and sync-config.yaml.

```
USAGE
  $ powersync pull instance [--directory <value>] [--instance-id <value> --project-id <value>] [--org-id <value>]

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID (optional). Defaults to the token’s single org when only one is available; pass
                         explicitly if the token has multiple orgs.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  Pull an existing Cloud instance: link and download config into local service.yaml and sync-config.yaml.

  Fetch an existing Cloud instance by ID: create the config directory if needed, write cli.yaml, and download
  service.yaml and sync-config.yaml. Pass --instance-id and --project-id when the directory is not yet linked; --org-id
  is optional when the token has a single organization. Cloud only.

EXAMPLES
  $ powersync pull instance

  $ powersync pull instance --instance-id=<id> --project-id=<id>

  $ powersync pull instance --instance-id=<id> --project-id=<id> --org-id=<org-id>
```

_See code: [src/commands/pull/instance.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/pull/instance.ts)_

## `powersync status`

Show instance diagnostics (connections, sync config, replication).

```
USAGE
  $ powersync status [--output human|json|yaml] [--api-url <value> | --instance-id <value> | --org-id
    <value> | --project-id <value>] [--directory <value>]

FLAGS
  --output=<option>  [default: human] Output format: human-readable, json, or yaml.
                     <options: human|json|yaml>

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  [Self-hosted] PowerSync API URL. When set, context is treated as self-hosted (exclusive with
                     --instance-id). Resolved: flag → cli.yaml → API_URL.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  [Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud
                         (exclusive with --api-url). Resolved: flag → cli.yaml → INSTANCE_ID.
  --org-id=<value>       [Cloud] Organization ID (optional). Defaults to the token’s single org when only one is
                         available; pass explicitly if the token has multiple orgs. Resolved: flag → cli.yaml → ORG_ID.
  --project-id=<value>   [Cloud] Project ID. Resolved: flag → cli.yaml → PROJECT_ID.

DESCRIPTION
  Show instance diagnostics (connections, sync config, replication).

  Fetch instance diagnostics: connection status, active and deploying sync config, replication state. Output as
  human-readable, JSON, or YAML. Cloud and self-hosted.

EXAMPLES
  $ powersync status

  $ powersync status --output=json

  $ powersync status --instance-id=<id> --project-id=<id>
```

_See code: [src/commands/status.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/status.ts)_

## `powersync stop`

[Cloud only] Stop the linked Cloud instance (restart with deploy).

```
USAGE
  $ powersync stop [--confirm yes] [--directory <value>] [--instance-id <value> --project-id <value>]
    [--org-id <value>]

FLAGS
  --confirm=<option>  Set to "yes" to confirm stopping the instance.
                      <options: yes>

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID (optional). Defaults to the token’s single org when only one is available; pass
                         explicitly if the token has multiple orgs.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  [Cloud only] Stop the linked Cloud instance (restart with deploy).

  Deactivate the linked PowerSync Cloud instance. Requires --confirm=yes. Restart later with powersync deploy.

EXAMPLES
  $ powersync stop

  $ powersync stop --confirm=yes
```

_See code: [src/commands/stop.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/stop.ts)_

## `powersync validate`

Validate config schema, connections, and sync config before deploy.

```
USAGE
  $ powersync validate [--output human|json|yaml] [--api-url <value> | --instance-id <value> | --org-id
    <value> | --project-id <value>] [--directory <value>]

FLAGS
  --output=<option>  [default: human] Output format: human-readable, json, or yaml.
                     <options: human|json|yaml>

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  [Self-hosted] PowerSync API URL. When set, context is treated as self-hosted (exclusive with
                     --instance-id). Resolved: flag → cli.yaml → API_URL.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config. Defaults to "powersync". This is
                       required if multiple powersync config files are present in subdirectories of the current working
                       directory.

CLOUD_PROJECT FLAGS
  --instance-id=<value>  [Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud
                         (exclusive with --api-url). Resolved: flag → cli.yaml → INSTANCE_ID.
  --org-id=<value>       [Cloud] Organization ID (optional). Defaults to the token’s single org when only one is
                         available; pass explicitly if the token has multiple orgs. Resolved: flag → cli.yaml → ORG_ID.
  --project-id=<value>   [Cloud] Project ID. Resolved: flag → cli.yaml → PROJECT_ID.

DESCRIPTION
  Validate config schema, connections, and sync config before deploy.

  Run validation checks on local config: config schema, database connections, and sync config. Requires a linked
  instance. Works with Cloud and self-hosted.

EXAMPLES
  $ powersync validate

  $ powersync validate --output=json

  $ powersync validate --api-url=https://powersync.example.com
```

_See code: [src/commands/validate.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/validate.ts)_

<!-- commandsstop -->
