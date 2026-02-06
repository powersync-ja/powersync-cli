# Docker template modules

Composable pieces used by **`powersync docker init --database <name> --storage <name>`**. Init copies the selected modules into **powersync/docker/modules/** and generates a composed **docker-compose.yaml**, **.env**, and merged **service.yaml** snippets.

## File naming

- **Compose partials:** **`<impl>.<category>.compose.yaml`** (e.g. `postgres.database.compose.yaml`, `postgres.storage.compose.yaml`).
- **Service snippets:** **`<impl>.<category>.service.yaml`** (e.g. `postgres.database.service.yaml`, `postgres.storage.service.yaml`). Merged into the project **service.yaml** so the PowerSync container can connect to the chosen database and storage. Use the **`!env`** custom tag (e.g. `uri: !env PS_DATA_SOURCE_URI`) so the service resolves values from **docker/.env** at runtime.
- **Env snippets:** **`template.env`** in each module directory. Init merges these into **powersync/docker/.env**, so each template declares only the variables it needs.

## Layout

- **database/** – Replication source.
  - **postgres/** – `postgres.database.compose.yaml` (pg-db service), `postgres.database.service.yaml` (replication snippet with `!env`), **template.env**, optional **init-scripts/**.
- **storage/** – PowerSync bucket metadata; each implementation is a complete compose partial (its own service(s)).
  - **postgres/** – `postgres.storage.compose.yaml` (pg-storage service), `postgres.storage.service.yaml` (storage snippet with `!env`), **template.env**, **init-scripts/** if needed.
- **backend/** – Reserved for future use.

## Init behavior

1. Copy **templates/database/<database>/** → **powersync/docker/modules/database-<database>/**.
2. Copy **templates/storage/<storage>/** → **powersync/docker/modules/storage-<storage>/**.
3. Write **powersync/docker/docker-compose.yaml** with `include:` of both compose partials and the PowerSync service (uses **env_file: .env**; mounts **service.yaml** and **sync.yaml**).
4. Merge **template.env** from the chosen database and storage modules (plus PowerSync common vars) into **powersync/docker/.env**.
5. **Merge service snippets:** read project **service.yaml** (or start from `_type: self-hosted`), merge the database and storage snippet YAML (replication and storage sections) **preserving `!env` tags**, write back to **service.yaml**.
6. Create or update **link.yaml** with `type: self-hosted` and **`plugins.docker.project_name`** (for deploy/start/stop).

Paths in included compose files are relative to the included file’s directory.
