# Storage module: PostgreSQL

Use with **database/postgres** for a single Postgres stack: replication source and bucket storage use different databases (e.g. `postgres` and `powersync_storage`). The init script creates the `powersync_storage` database.

The **service snippet** (`postgres.storage.service.yaml`) adds storage config using **`!env PS_STORAGE_SOURCE_URI`** so the PowerSync container resolves the URI from **docker/.env** at runtime.
