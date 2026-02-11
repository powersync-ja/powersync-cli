# Basic Postgres Example

## Layout

Each example is structured like a repository root. The `powersync/` folder contains all PowerSync service configuration:

```
local-postgres/
├── powersync/           # PowerSync service config
│   ├── docker/          # Docker Compose for PowerSync
│   │   ├── docker-compose.yaml
│   │   └── modules/     # Database and storage modules
│   │       ├── database-postgres/
│   │       │   ├── init-scripts/   # Schema and publication
│   │       │   └── postgres.database.compose.yaml
│   │       └── storage-postgres/
│   │           ├── init-scripts/
│   │           └── postgres.storage.compose.yaml
│   ├── link.yaml        # Instance link (api_url, api_key)
│   ├── service.yaml     # Service config (connections, auth)
│   └── sync.yaml        # Sync rules
└── README.md
```

---

## Steps to Create This Demo

### 1. Initialize the project

```bash
powersync init --type=self-hosted
```

### 2. Configure Docker with Postgres modules

```bash
powersync docker configure --database=postgres --storage=postgres
```

### 3. Add schema and publication to the database module

Create files in `powersync/docker/modules/database-postgres/init-scripts/`:

- `00-schema.sql` – your schema (e.g. `todos` table)
- `01-powersync-publication.sql` – `CREATE PUBLICATION powersync FOR ALL TABLES;`

> **Note:** Init scripts run only when the Postgres data directory is empty. If you see "Publication 'powersync' does not exist", remove the database volume and redeploy: `powersync docker stop --remove --remove-volumes` then `powersync docker reset`.

### 4. Update sync rules

Ensure `powersync/sync.yaml` includes rules for your tables (e.g. `SELECT * FROM todos` in a bucket).

### 5. Start the PowerSync stack

```bash
powersync docker start
```

---

## Usage

This project can be used with any self-hosted CLI commands:

```bash
powersync fetch status
powersync generate schema --output-path=schema.ts --output=ts
```
