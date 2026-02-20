# Basic Supabase Example

## Layout

Each example is structured like a repository root. The `powersync/` folder contains all PowerSync service configuration:

```
local-basic-supabase/
├── powersync/           # PowerSync service config
│   ├── docker/          # Docker Compose for PowerSync
│   │   ├── docker-compose.yaml
│   │   └── .env         # (created at runtime; DB credentials)
│   ├── cli.yaml        # Instance link (api_url, api_key)
│   ├── service.yaml     # Service config (connections, auth)
│   └── sync.yaml        # Sync config
├── supabase/            # Local Supabase config
│   ├── config.toml
│   └── migrations/
└── README.md
```

The `supabase/` folder holds the local Supabase configuration (database migrations, config) used when running `supabase start`.

---

## Steps to Create This Demo

### 1. Initialize the project

```bash
powersync init self-hosted
```

### 2. Configure Docker with external databases

Since we use Supabase for the databases, configure external modules:

```bash
powersync docker configure --database=external --storage=external
```

### 3. Initialize and start Supabase

```bash
supabase init
supabase start
```

### 4. Apply Supabase DB credentials to PowerSync

Edit `powersync/docker/.env` with connection strings. Use `host.docker.internal` so the PowerSync service (running in Docker) can reach Supabase on the host:

```env
# external Database Config
PS_DATA_SOURCE_URI=postgresql://postgres:postgres@host.docker.internal:54322/postgres

# external Storage Config
PS_STORAGE_SOURCE_URI=postgresql://postgres:postgres@host.docker.internal:54322/postgres
```

### 5. Add schema and publication to Supabase

Create `supabase/migrations/20260210101315_init.sql`:

```sql
CREATE TABLE IF NOT EXISTS todos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE PUBLICATION powersync FOR ALL TABLES;
```

### 6. Update sync config

Ensure `powersync/sync.yaml` includes rules for the `todos` table (e.g. `SELECT * FROM todos` in a bucket).

### 7. Start the PowerSync stack

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
