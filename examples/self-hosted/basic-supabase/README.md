# Basic Supabase Example

This example was created with (in this directory):

```bash
powersync init --type=self-hosted
# Uses external since we will use Supabase's services for the databases
powersync docker configure --database=external --storage=external
```

Configuring Supabase with

```bash
supabase init
supabase start
```

Applying the Supabase DB credentials to `powersync/docker.env`

`powersync/docker/.env`

```
# external Database Config
PS_DATA_SOURCE_URI=postgresql://postgres:postgres@host.docker.internal:54322/postgres

# external Storage Config
PS_STORAGE_SOURCE_URI=postgresql://postgres:postgres@host.docker.internal:54322/postgres
```

Adding a basic `todos` table to the Supabse DB and sync rules.

`supabase/migrations/20260210101315_init.sql`

```sql
CREATE TABLE IF NOT EXISTS todos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE PUBLICATION powersync FOR ALL TABLES;
```

The Docker compose project can be started with

```bash
powersync docker start
```

This project can now be used with any of the self hosted cli commands e.g.

```bash
powersync fetch status
powersync generate schema --output-path=schema.ts --output=ts
```
