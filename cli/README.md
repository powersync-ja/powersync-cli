# @powersync/cli

CLI for PowerSync

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@powersync/cli.svg)](https://npmjs.org/package/@powersync/cli)
[![Downloads/week](https://img.shields.io/npm/dw/@powersync/cli.svg)](https://npmjs.org/package/@powersync/cli)

<!-- toc -->

- [@powersync/cli](#powersynccli)
- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

# Usage

For self-hosted instances with Docker, use **`powersync docker init`** then **`powersync docker deploy`**. See the [docker plugin](../plugin-docker/README.md) for details.

<!-- usage -->

```sh-session
$ npm install -g @powersync/cli
$ powersync COMMAND
running command...
$ powersync (--version)
@powersync/cli/0.0.0 darwin-arm64 node-v24.13.0
$ powersync --help [COMMAND]
USAGE
  $ powersync COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`powersync deploy`](#powersync-deploy)
- [`powersync destroy`](#powersync-destroy)
- [`powersync fetch`](#powersync-fetch)
- [`powersync fetch config`](#powersync-fetch-config)
- [`powersync fetch instances`](#powersync-fetch-instances)
- [`powersync fetch status`](#powersync-fetch-status)
- [`powersync generate`](#powersync-generate)
- [`powersync generate schema`](#powersync-generate-schema)
- [`powersync generate token`](#powersync-generate-token)
- [`powersync help [COMMAND]`](#powersync-help-command)
- [`powersync init`](#powersync-init)
- [`powersync link`](#powersync-link)
- [`powersync link cloud`](#powersync-link-cloud)
- [`powersync link self-hosted`](#powersync-link-self-hosted)
- [`powersync login`](#powersync-login)
- [`powersync migrate`](#powersync-migrate)
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
- [`powersync pull`](#powersync-pull)
- [`powersync pull config`](#powersync-pull-config)
- [`powersync stop`](#powersync-stop)
- [`powersync validate`](#powersync-validate)

## `powersync deploy`

Deploy sync rules and configuration changes.

```
USAGE
  $ powersync deploy [--directory <value>] [--instance-id <value>] [--org-id <value>] [--project-id <value>]

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config (default: powersync).

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID. Manually passed if the current context has not been linked.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  Deploy sync rules and configuration changes.

  Deploys changes to the PowerSync management service. Cloud only.
```

_See code: [src/commands/deploy.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/deploy.ts)_

## `powersync destroy`

Destroy a PowerSync instance.

```
USAGE
  $ powersync destroy [--confirm yes] [--directory <value>] [--instance-id <value>] [--org-id <value>]
    [--project-id <value>]

FLAGS
  --confirm=<option>  Set to "yes" to confirm destruction of the instance.
                      <options: yes>

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config (default: powersync).

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID. Manually passed if the current context has not been linked.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  Destroy a PowerSync instance.

  Destroys the linked PowerSync Cloud instance. Cloud only.
```

_See code: [src/commands/destroy.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/destroy.ts)_

## `powersync fetch`

Fetch data from PowerSync (instances, config, status).

```
USAGE
  $ powersync fetch

DESCRIPTION
  Fetch data from PowerSync (instances, config, status).

  Commands to list instances, fetch config, or get diagnostics status.
```

_See code: [src/commands/fetch/index.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/fetch/index.ts)_

## `powersync fetch config`

Fetch config from cloud (output as yaml or json).

```
USAGE
  $ powersync fetch config [--output json|yaml] [--directory <value>] [--instance-id <value>] [--org-id <value>]
    [--project-id <value>]

FLAGS
  --output=<option>  [default: yaml] Output format: yaml or json.
                     <options: json|yaml>

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config (default: powersync).

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID. Manually passed if the current context has not been linked.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  Fetch config from cloud (output as yaml or json).

  Fetches instance config from PowerSync Cloud. Requires a linked project. Cloud only.
```

_See code: [src/commands/fetch/config.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/fetch/config.ts)_

## `powersync fetch instances`

List PowerSync Cloud instances.

```
USAGE
  $ powersync fetch instances

DESCRIPTION
  List PowerSync Cloud instances.

  Lists instances in the current org/project. Cloud only.
```

_See code: [src/commands/fetch/instances.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/fetch/instances.ts)_

## `powersync fetch status`

Fetch diagnostics status for an instance.

```
USAGE
  $ powersync fetch status [--output human|json|yaml] [--api-url <value>] [--instance-id <value>] [--org-id
    <value>] [--project-id <value>] [--directory <value>]

FLAGS
  --output=<option>  [default: human] Output format: human-readable, json, or yaml.
                     <options: human|json|yaml>

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  [Self-hosted] PowerSync API URL. When set, context is treated as self-hosted (exclusive with
                     --instance-id). Resolved: flag → API_URL → link.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config (default: powersync).

CLOUD_PROJECT FLAGS
  --instance-id=<value>  [Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud
                         (exclusive with --api-url). Resolved: flag → INSTANCE_ID → link.yaml.
  --org-id=<value>       [Cloud] Organization ID. Resolved: flag → ORG_ID → link.yaml.
  --project-id=<value>   [Cloud] Project ID. Resolved: flag → PROJECT_ID → link.yaml.

DESCRIPTION
  Fetch diagnostics status for an instance.

  Fetches diagnostics (connections, sync rules state, etc.). Routes to Management service (Cloud) or linked instance
  (self-hosted).
```

_See code: [src/commands/fetch/status.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/fetch/status.ts)_

## `powersync generate`

Generate artifacts (schema, token).

```
USAGE
  $ powersync generate

DESCRIPTION
  Generate artifacts (schema, token).

  Commands to generate client-side schema or development tokens.
```

_See code: [src/commands/generate/index.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/generate/index.ts)_

## `powersync generate schema`

Create client-side schemas.

```
USAGE
  $ powersync generate schema --output dart|dotNet|flutterFlow|js|jsLegacy|kotlin|swift|ts --output-path <value>
    [--api-url <value>] [--instance-id <value>] [--org-id <value>] [--project-id <value>] [--directory <value>]

FLAGS
  --output=<option>      (required) [default: type] Output type: dart, dotNet, flutterFlow, js, jsLegacy, kotlin, swift,
                         ts
                         <options: dart|dotNet|flutterFlow|js|jsLegacy|kotlin|swift|ts>
  --output-path=<value>  (required) Path to output the schema file.

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  [Self-hosted] PowerSync API URL. When set, context is treated as self-hosted (exclusive with
                     --instance-id). Resolved: flag → API_URL → link.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config (default: powersync).

CLOUD_PROJECT FLAGS
  --instance-id=<value>  [Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud
                         (exclusive with --api-url). Resolved: flag → INSTANCE_ID → link.yaml.
  --org-id=<value>       [Cloud] Organization ID. Resolved: flag → ORG_ID → link.yaml.
  --project-id=<value>   [Cloud] Project ID. Resolved: flag → PROJECT_ID → link.yaml.

DESCRIPTION
  Create client-side schemas.

  Generates client-side schema from instance schema and sync rules. Supported for Cloud and self-hosted.
```

_See code: [src/commands/generate/schema.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/generate/schema.ts)_

## `powersync generate token`

Create a client token for the PowerSync service.

```
USAGE
  $ powersync generate token --subject <value> [--expires-in-seconds <value>] [--kid <value>] [--api-url <value>]
    [--instance-id <value>] [--org-id <value>] [--project-id <value>] [--directory <value>]

FLAGS
  --expires-in-seconds=<value>  [default: 43200] Expiration time in seconds. Default is 43,200 (12 hours).
  --kid=<value>                 [Self-hosted only] Key ID of the key to use for signing the token. If not provided, the
                                first key will be used.
  --subject=<value>             (required) Subject of the token.

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  [Self-hosted] PowerSync API URL. When set, context is treated as self-hosted (exclusive with
                     --instance-id). Resolved: flag → API_URL → link.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config (default: powersync).

CLOUD_PROJECT FLAGS
  --instance-id=<value>  [Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud
                         (exclusive with --api-url). Resolved: flag → INSTANCE_ID → link.yaml.
  --org-id=<value>       [Cloud] Organization ID. Resolved: flag → ORG_ID → link.yaml.
  --project-id=<value>   [Cloud] Project ID. Resolved: flag → PROJECT_ID → link.yaml.

DESCRIPTION
  Create a client token for the PowerSync service.

  Generates a development token for connecting clients. Cloud and self-hosted (when shared secret is in config).
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

Create a new PowerSync project.

```
USAGE
  $ powersync init [--type cloud|self-hosted] [--directory <value>]

FLAGS
  --type=<option>  [default: cloud] Type of PowerSync instance to scaffold.
                   <options: cloud|self-hosted>

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config (default: powersync).

DESCRIPTION
  Create a new PowerSync project.

  Creates a new PowerSync project in the current directory. Supports --type=cloud or self-hosted.
```

_See code: [src/commands/init.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/init.ts)_

## `powersync link`

Link configuration to a PowerSync instance.

```
USAGE
  $ powersync link

DESCRIPTION
  Link configuration to a PowerSync instance.

  Associates a PowerSync instance with this directory's config. Use a subcommand for cloud or self-hosted.
```

_See code: [src/commands/link/index.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/link/index.ts)_

## `powersync link cloud`

Link to PowerSync Cloud (instance ID, org, project).

```
USAGE
  $ powersync link cloud --org-id <value> --project-id <value> [--create] [--instance-id <value>] [--directory
    <value>]

FLAGS
  --create               Create a new Cloud instance in the given org and project, then link. Do not supply
                         --instance-id when using --create.
  --instance-id=<value>  PowerSync Cloud instance ID. Omit when using --create.
  --org-id=<value>       (required) Organization ID.
  --project-id=<value>   (required) Project ID.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config (default: powersync).

DESCRIPTION
  Link to PowerSync Cloud (instance ID, org, project).

  Link this directory to a PowerSync Cloud instance.
```

_See code: [src/commands/link/cloud.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/link/cloud.ts)_

## `powersync link self-hosted`

Link to self-hosted PowerSync (API URL; API key from PS_TOKEN env).

```
USAGE
  $ powersync link self-hosted --api-url <value> [--directory <value>]

FLAGS
  --api-url=<value>  (required) Self-hosted PowerSync API base URL (e.g. https://powersync.example.com).

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config (default: powersync).

DESCRIPTION
  Link to self-hosted PowerSync (API URL; API key from PS_TOKEN env).

  Link this directory to a self-hosted PowerSync instance.
```

_See code: [src/commands/link/self-hosted.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/link/self-hosted.ts)_

## `powersync login`

Authenticate the CLI with PowerSync (e.g. PAT token).

```
USAGE
  $ powersync login

DESCRIPTION
  Authenticate the CLI with PowerSync (e.g. PAT token).

  Authenticate the CLI with PowerSync (e.g. PAT token).
```

_See code: [src/commands/login.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/login.ts)_

## `powersync migrate`

Migrate a self-hosted config to a cloud config.

```
USAGE
  $ powersync migrate [--directory <value>] [--api-url <value>]

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  PowerSync API URL. Resolved: flag → API_URL → link.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config (default: powersync).

DESCRIPTION
  Migrate a self-hosted config to a cloud config.

  Migrates a self-hosted instance configuration to PowerSync Cloud format. Self-hosted only.
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

Pull config; link if needed.

```
USAGE
  $ powersync pull

DESCRIPTION
  Pull config; link if needed.

  Pull config from PowerSync Cloud (optionally link first if not already linked).
```

_See code: [src/commands/pull/index.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/pull/index.ts)_

## `powersync pull config`

Pull config from cloud (link first if needed).

```
USAGE
  $ powersync pull config [--directory <value>] [--instance-id <value>] [--org-id <value>] [--project-id <value>]

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config (default: powersync).

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID. Manually passed if the current context has not been linked.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  Pull config from cloud (link first if needed).

  Pulls instance config from PowerSync Cloud and writes to local files. If not already linked, use --instance-id,
  --org-id, --project-id to link first. Cloud only.
```

_See code: [src/commands/pull/config.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/pull/config.ts)_

## `powersync stop`

Stop a PowerSync instance.

```
USAGE
  $ powersync stop [--confirm yes] [--directory <value>] [--instance-id <value>] [--org-id <value>]
    [--project-id <value>]

FLAGS
  --confirm=<option>  Set to "yes" to confirm stopping the instance.
                      <options: yes>

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config (default: powersync).

CLOUD_PROJECT FLAGS
  --instance-id=<value>  PowerSync Cloud instance ID. Manually passed if the current context has not been linked.
  --org-id=<value>       Organization ID. Manually passed if the current context has not been linked.
  --project-id=<value>   Project ID. Manually passed if the current context has not been linked.

DESCRIPTION
  Stop a PowerSync instance.

  Stops the linked PowerSync Cloud instance. Cloud only. The instance can be started again by running `powersync
  deploy`.
```

_See code: [src/commands/stop.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/stop.ts)_

## `powersync validate`

Validate configuration (sync rules, connection, etc.).

```
USAGE
  $ powersync validate [--output human|json|yaml] [--api-url <value>] [--instance-id <value>] [--org-id
    <value>] [--project-id <value>] [--directory <value>]

FLAGS
  --output=<option>  [default: human] Output format: human-readable, json, or yaml.
                     <options: human|json|yaml>

SELF_HOSTED_PROJECT FLAGS
  --api-url=<value>  [Self-hosted] PowerSync API URL. When set, context is treated as self-hosted (exclusive with
                     --instance-id). Resolved: flag → API_URL → link.yaml.

PROJECT FLAGS
  --directory=<value>  [default: powersync] Directory containing PowerSync config (default: powersync).

CLOUD_PROJECT FLAGS
  --instance-id=<value>  [Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud
                         (exclusive with --api-url). Resolved: flag → INSTANCE_ID → link.yaml.
  --org-id=<value>       [Cloud] Organization ID. Resolved: flag → ORG_ID → link.yaml.
  --project-id=<value>   [Cloud] Project ID. Resolved: flag → PROJECT_ID → link.yaml.

DESCRIPTION
  Validate configuration (sync rules, connection, etc.).

  Validates configuration. Supported for both Cloud and self-hosted.
```

_See code: [src/commands/validate.ts](https://github.com/powersync-ja/powersync-js/blob/v0.0.0/src/commands/validate.ts)_

<!-- commandsstop -->
