# @powersync/cli-core

Core types, base commands, and utilities shared across the PowerSync CLI and its plugins.

> **Internal use:** This package is intended for internal use by the PowerSync CLI and its bundled plugins. It is not part of the public API.
>
> **Plugin authors:** You can use `@powersync/cli-core` to build your own PowerSync CLI plugins, but treat this package as **experimental and subject to change**. There are no stability guarantees between releases — APIs, types, and base classes may be renamed, restructured, or removed without a deprecation period.

## What's in this package

- Base command classes (`PowerSyncCommand`, `InstanceCommand`, `SelfHostedInstanceCommand`) for building CLI commands and plugins.
- Shared types (`SelfHostedProject`, `SelfHostedInstanceCommandFlags`, `EnsureConfigOptions`, etc.).
- YAML helpers (`parseYamlFile`, `parseYamlDocumentPreserveTags`, `stringifyYaml`) for `!env`-aware config parsing.
- Auth and project resolution utilities used by the CLI and official plugins.

## Usage in plugins

Import from `@powersync/cli-core` when authoring your own plugin:

```ts
import { SelfHostedInstanceCommand, PowerSyncCommand } from '@powersync/cli-core';
```

See `@powersync/cli-plugin-docker` for a reference implementation.
