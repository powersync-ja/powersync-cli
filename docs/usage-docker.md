# Using the PowerSync Docker topic

PowerSync exposes a **docker** topic (`powersync docker`) for running a self-hosted stack with Docker Compose. For general CLI usage (linking, instance resolution, auth), see [usage.md](./usage.md). You create the compose layout once with **`powersync docker configure`**, then use **reset**, **start**, and **stop** to run the stack. Custom configuration is required for each local configuration; the PowerSync container reads **docker/.env** and resolves **`!env`** in **service.yaml** at runtime.

## Prerequisites

- A self-hosted PowerSync project: **service.yaml** in your config directory (default **powersync/**). Create one with **`powersync init self-hosted`** if needed.
- Docker and Docker Compose (Compose V2, 2.20.3+ for `include`).

## Local configuration created by the Docker topic

Docker commands use the **compose directory** **powersync/docker/** inside your PowerSync config directory. Configure creates:

- **powersync/docker/** – Compose project root.
  - **docker-compose.yaml** – Main compose (from template); modules add their own includes and the PowerSync service. Uses **env_file: .env**; mounts **service.yaml** and **sync-config.yaml**.
  - **.env** – Merged from template env (defaults; no manual setup required for basic use).
  - **modules/** – Database and storage modules (e.g. **database-postgres/**, **storage-postgres/**), each with compose partials and **init-scripts** where applicable.

Configure also:

- Merges **replication** and **storage** config into **powersync/service.yaml** (with **`!env`** preserved so the PowerSync container resolves values from **docker/.env** at runtime).
- Creates or updates **powersync/cli.yaml** with **api_url**, **api_key**, and **plugins.docker.project_name** so reset/start/stop use the same Compose project name.

You can use a different config directory with **`--directory`** (e.g. **`--directory my-powersync`**); the compose dir is then **my-powersync/docker/**.

---

## Workflow: configure then start

### 1. Create the Docker layout (configure)

From your repo root (or from the config directory), run configure with the database and storage modules you want:

```bash
powersync docker configure --database postgres --storage postgres
```

**Database options:** **postgres** (managed Postgres in the stack), **external** (connect to an existing database; set **PS_DATA_SOURCE_URI** in **docker/.env**).

**Storage options:** **postgres** (managed Postgres for bucket metadata), **external** (connect to an existing database; set **PS_STORAGE_SOURCE_URI** in **docker/.env**).

This creates **powersync/docker/** with:

- **docker-compose.yaml** – Includes module compose files (if any) and the PowerSync service.
- **.env** – Default values for DB credentials, URIs, port, etc.
- **modules/database-postgres/** and/or **modules/storage-postgres/** – Compose partials and **init-scripts/** (e.g. publication and schema placeholders for postgres).

It also merges replication and storage config into **powersync/service.yaml** and sets **plugins.docker.project_name** in **powersync/cli.yaml** (derived from the config directory name). If the directory already exists, remove it first or use a different **--directory**.

### 2. Start the stack

After configuring, use **`powersync docker start`** to bring up the stack. No need to edit **.env** for default setups:

```bash
powersync docker start
```

This runs **`docker compose up -d --wait`** in **powersync/docker/** (using the project name from **cli.yaml**) and waits for all services (including PowerSync) to be healthy.

Use **`powersync docker reset`** only when you need to start from a clean state: it runs **`docker compose down`** (stop and remove) then **`docker compose up -d --wait`** (e.g. after config changes or to clear a bad state).

### 3. Start and stop later

- **Start** (after stop or reboot): **`powersync docker start`** → `docker compose up -d --wait` (waits for healthy).
- **Stop**: **`powersync docker stop`** → by default only **`docker compose stop`** (containers stay, can be started again).
  - **`powersync docker stop --remove`** → **`docker compose down`** (containers removed).
  - **`powersync docker stop --remove --remove-volumes`** (or **`--remove-volumes`** alone, which implies **--remove**) → **`docker compose down -v`** (containers and named volumes removed). Use this to reset the database so **init-scripts** run again on the next reset (e.g. if you see “Publication 'powersync' does not exist”).

All of these use the project name from **cli.yaml** unless you pass **`--project-name`** (e.g. to stop from any directory or to target a specific project).

Use **`powersync fetch status`** to debug a running instance.

---

## Commands reference

| Command                          | Description                                                                                                                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`powersync docker configure`** | Create **powersync/docker/** with chosen **--database** and **--storage** modules, **.env**, and merged **service.yaml**. Writes **cli.yaml** with **plugins.docker.project_name**. Remove existing **docker/** first to re-run. |
| **`powersync docker start`**     | Start the stack (`docker compose up -d --wait`). **Use this after configure** to bring up the stack. Waits for healthy.                                                                                                          |
| **`powersync docker reset`**     | Start from a clean state: stop and remove containers (`docker compose down`), then start (`docker compose up -d --wait`). Use only when you need a full teardown and bring-up (e.g. after config changes). Waits for healthy.    |
| **`powersync docker stop`**      | Stop the stack. Default: `docker compose stop` (containers kept). **--remove**: remove containers (`down`). **--remove-volumes**: remove containers and volumes (`down -v`). Can use **--project-name** from any directory.      |

Run **`powersync docker`** (no subcommand) for help.

---

## Flags

- **`--directory`** – PowerSync config directory (default: **powersync**). Used by configure, reset, start.
- **`--database`** – Database module for **configure**: **postgres** (default), **external**.
- **`--storage`** – Storage module for **configure**: **postgres** (default), **external**.
- **`--project-name`** – For **stop**: Docker Compose project name (e.g. **powersync_myapp**). If omitted, uses **plugins.docker.project_name** from **cli.yaml** when run from the project directory. Use to stop a specific project from any directory (e.g. after a failed reset).
- **`--remove`** – For **stop**: remove containers after stopping (`docker compose down`). Default is stop only.
- **`--remove-volumes`** – For **stop**: remove named volumes (`docker compose down -v`). Use to reset DB/storage so init scripts run again on next reset. Implies **--remove**.

---

## How configure uses templates

Templates are **composable modules** by category and implementation:

- **source-database/** – Replication source: **postgres** (managed), **external** (connection string in .env).
- **bucket-storage/** – PowerSync bucket metadata: **postgres** (managed), **external** (connection string in .env).

Each module can add entries to the main **docker-compose.yaml** (include paths, **depends_on**) and provides:

- **Compose partial** – Included by the main **docker-compose.yaml** (e.g. pg-db, pg-storage services). Paths in the partial are relative to that file’s directory (e.g. **./init-scripts** for init scripts).
- **Service snippet** – Merged into **powersync/service.yaml** (replication or storage). Uses **`!env`** (e.g. **uri: !env PS_DATA_SOURCE_URI**) so the PowerSync container resolves values from **docker/.env** at runtime.
- **Env** – Vars for that module; configure merges them into **powersync/docker/.env**.

For **postgres** database: configure copies **init-scripts/** (e.g. **00-schema.sql**, **01-powersync-publication.sql**) into **modules/database-postgres/init-scripts/**. Init scripts run only when the Postgres data directory is empty (first start or after **stop --remove-volumes**). If you see “Publication 'powersync' does not exist”, run **powersync docker stop --remove --remove-volumes** then **powersync docker reset** again.

---

## Using a different config directory

```bash
powersync docker configure --directory=my-powersync --database postgres --storage postgres
powersync docker start --directory=my-powersync
```

---

## Optional: linking for other self-hosted commands

Configure sets **cli.yaml** with **api_url** and **api_key** for the local stack so you can run **fetch status**, **validate**, **generate schema**, etc. without extra flags:

```bash
powersync fetch status
powersync validate
powersync generate schema --output=ts --output-path=./schema.ts
```

You can override **--api-url** (and set **TOKEN** in the environment) on individual commands if needed.
