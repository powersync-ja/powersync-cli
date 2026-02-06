# Database module: PostgreSQL

PostgreSQL for the replication source (logical replication / WAL). Use with **storage/postgres** for a single stack with two databases (replication + bucket storage).

The **service snippet** (`postgres.database.service.yaml`) adds a replication connection using **`!env PS_DATA_SOURCE_URI`** so the PowerSync container resolves the URI from **docker/.env** at runtime.
