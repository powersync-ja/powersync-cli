# @powersync/plugin-docker

PowerSync CLI plugin that adds a **docker** topic for self-hosted instances: **init**, **deploy**, **start**, and **stop** using Docker Compose.

## Commands

All commands live under **`powersync docker`**:

- **`powersync docker init`** – Create **powersync/docker/** with database and storage modules (see **Templates** below). Requires **`--database`** and **`--storage`**. Creates **docker-compose.yaml**, **.env** (with defaults), and merges service snippets into **service.yaml** (preserving `!env` so the container resolves vars from **.env**). Writes **link.yaml** with `plugins.docker.project_name` for deploy/start/stop.
- **`powersync docker deploy`** – Start or recreate containers (`docker compose up -d --force-recreate`). Images are pulled if missing.
- **`powersync docker start`** – Start the stack (`docker compose up -d`).
- **`powersync docker stop`** – Stop the stack (`docker compose down`).

Run **`powersync docker`** with no subcommand to see help.

All commands use the same project and directory resolution as the main CLI (e.g. `--directory powersync`). They require a self-hosted PowerSync project (**service.yaml** with `_type: self-hosted`). Linking (**link.yaml** / API_URL / PS_TOKEN) is optional.

## Templates (composable modules)

Templates are organized by **category** and **implementation**:

- **`templates/database/`** – Replication source (e.g. **postgres**).
- **`templates/storage/`** – PowerSync bucket metadata (e.g. **postgres**).
- **`templates/backend/`** – (Reserved for future use.)

Each implementation provides:

- A **compose partial** **`<impl>.<category>.compose.yaml`** (e.g. `postgres.database.compose.yaml`, `postgres.storage.compose.yaml`). Storage modules define their own service(s) (e.g. `pg-storage`).
- A **service snippet** **`<impl>.<category>.service.yaml`** – YAML merged into the project **service.yaml** (replication and storage sections). Snippets use the **`!env`** custom tag (e.g. `uri: !env PS_DATA_SOURCE_URI`) so the PowerSync container resolves values from **docker/.env** at runtime.
- **`template.env`** – Env vars for that module. Init merges these into **powersync/docker/.env**.

**`powersync docker init`** copies the selected modules into **powersync/docker/modules/**, generates **docker-compose.yaml** (include of both partials + PowerSync service with **env_file: .env**), writes **.env** (merged from template.env snippets + PowerSync vars), and merges the service snippets into **service.yaml** (preserving `!env` tags).

### Example

```bash
powersync docker init --database postgres --storage postgres
```

Creates **powersync/docker/** with:

- **modules/database-postgres/** – `postgres.database.compose.yaml` (pg-db), `postgres.database.service.yaml` snippet, **template.env**.
- **modules/storage-postgres/** – `postgres.storage.compose.yaml` (pg-storage), `postgres.storage.service.yaml` snippet, **template.env**.
- **docker-compose.yaml** – `include:` of both partials + PowerSync service (depends on pg-db and pg-storage; uses **env_file: .env**).
- **.env** – Merged from template.env snippets and PowerSync vars (defaults; no manual setup required for basic use).

Also merges the database and storage snippets into **powersync/service.yaml** (replication and storage with `!env` preserved) and creates/updates **link.yaml** with `plugins.docker.project_name` (derived from the config directory name, or use **`--project-name`**).

## Usage

1. From the repo root, run **`powersync docker init --database postgres --storage postgres`** to create **powersync/docker/**.
2. Run **`powersync docker deploy`** to start the stack (or **`powersync docker start`** / **`powersync docker stop`** later).

No need to edit **.env** for default setups; the PowerSync service reads **docker/.env** via **env_file** and resolves **!env** in **service.yaml** at runtime.

## Flags

- **`--directory`** – Config directory (default: `powersync`).
- **`--database`** – Database module for **docker init** (e.g. `postgres`). Required for init.
- **`--storage`** – Storage module for **docker init** (e.g. `postgres`). Required for init.
- **`--project-name`** – Docker Compose project name for init (default: derived from config directory name).
- **`--compose-dir`** – Compose directory relative to config (default: `docker`). Used by deploy, start, stop.
- **`--api-url`** – PowerSync API URL (optional; for consistency with other self-hosted commands).

## Building blocks

This plugin uses **@powersync/cli-core**, which provides:

- **`SelfHostedInstanceCommand`** – Base class with `loadProject()` and `parseConfig()` for project dir, link config, and **service.yaml**.
- Types: **`SelfHostedProject`**, **`SelfHostedInstanceCommandFlags`**, **`EnsureConfigOptions`**.
- **`HelpGroup`**, **`InstanceCommand`**, **`PowerSyncCommand`**.
- YAML helpers: **`parseYamlFile`**, **`parseYamlString`**, **`parseYamlDocumentPreserveTags`**, **`stringifyYaml`** (for `!env`-aware parsing).

Import from **`@powersync/cli-core`** when authoring your own self-hosted plugins.
