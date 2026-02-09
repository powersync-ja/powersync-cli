# Using the Docker plugin

The **docker** plugin adds a `powersync docker` topic for running a self-hosted PowerSync stack with Docker Compose. You scaffold a compose layout once with **`powersync docker init`**, then use **deploy**, **start**, and **stop** to run the stack. No need to edit config for basic use; the PowerSync container reads **docker/.env** and resolves **`!env`** in **service.yaml** at runtime.

## Prerequisites

- A self-hosted PowerSync project: **service.yaml** with `_type: self-hosted` in your config directory (default **powersync/**). Create one with **`powersync init --type=self-hosted`** if needed.
- Docker and Docker Compose (Compose V2) installed.
- Linking (**link.yaml**, API_URL, PS_TOKEN) is **optional** for docker commands; they only need the project directory and the compose dir.

## Local configuration created by the plugin

Docker commands use the **compose directory** **powersync/docker/** inside your PowerSync config directory. Configure creates:

- **powersync/docker/** – Compose project root.
  - **docker-compose.yaml** – Includes database and storage compose partials and the PowerSync service (uses **env_file: .env**; mounts **service.yaml** and **sync.yaml**).
  - **.env** – Merged from template snippets and PowerSync vars (defaults; no manual setup required for basic use).
  - **modules/** – Copied database and storage modules (each with its own compose partial and **template.env**).

Init also:

- Merges **service snippets** into **powersync/service.yaml** (replication and storage sections), **preserving the `!env` tag** so the PowerSync container resolves values from **docker/.env** at runtime.
- Creates or updates **powersync/link.yaml** with **`plugins.docker.project_name`** so deploy/start/stop use the same Compose project name.

You can use a different config directory with **`--directory`** (e.g. **`--directory my-powersync`**); the compose dir is then **my-powersync/docker/**.

---

## Workflow: init then deploy

### 1. Create the Docker layout (init)

From your repo root, run init with the database and storage modules you want (e.g. postgres for both):

```bash
powersync docker init --database postgres --storage postgres
```

This creates **powersync/docker/** with:

- **docker-compose.yaml** – Database (pg-db), storage (pg-storage), and PowerSync service.
- **.env** – Default values for DB credentials, URIs, port, JWKS URL, etc.
- **modules/database-postgres/** and **modules/storage-postgres/** – Compose partials and env snippets.

It also merges replication and storage config into **powersync/service.yaml** (with **`!env PS_DATA_SOURCE_URI`** and **`!env PS_STORAGE_SOURCE_URI`** preserved) and sets **plugins.docker.project_name** in **powersync/link.yaml** (derived from the config directory name, or use **`--project-name`**).

### 2. Start the stack (deploy)

No need to edit **.env** for default setups. Run:

```bash
powersync docker deploy
```

This runs **`docker compose up -d --force-recreate`** in **powersync/docker/** (using the project name from **link.yaml**). Images are pulled if missing. The PowerSync container gets all env from **docker/.env** via **env_file** and resolves **`!env`** in **service.yaml** at runtime.

### 3. Start and stop later

- **Start** (after stop or reboot): **`powersync docker start`** → `docker compose up -d`
- **Stop**: **`powersync docker stop`** → `docker compose down`

All of these use **powersync/docker/** and the project name from **link.yaml**.

---

## Commands reference

| Command                       | Description                                                                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`powersync docker init`**   | Create **powersync/docker/** with chosen database and storage modules, **.env**, and merged **service.yaml** snippets. Requires **`--database`** and **`--storage`**. Writes **link.yaml** with **plugins.docker.project_name**. |
| **`powersync docker deploy`** | Start or recreate containers (`docker compose up -d --force-recreate`). Images are pulled if missing.                                                                                                                            |
| **`powersync docker start`**  | Start the stack (`docker compose up -d`).                                                                                                                                                                                        |
| **`powersync docker stop`**   | Stop the stack (`docker compose down`).                                                                                                                                                                                          |

Run **`powersync docker`** (no subcommand) to see help.

---

## Flags

- **`--directory`** – PowerSync config directory (default: **powersync**). Used by all docker commands.
- **`--database`** – Database module for **init** (e.g. **postgres**). Required for init.
- **`--storage`** – Storage module for **init** (e.g. **postgres**). Required for init.
- **`--project-name`** – Docker Compose project name for **init** (default: derived from config directory name, sanitized). Use **`--project-name`** on **stop** to stop a specific project by name (e.g. after a failed deploy).
- **`--api-url`** – PowerSync API URL (optional; for consistency with other self-hosted commands; not required for docker init/deploy/start/stop).

---

## How init uses templates

Templates are **composable modules** by category and implementation:

- **database/** – Replication source (e.g. **postgres**).
- **storage/** – PowerSync bucket metadata (e.g. **postgres**).

Each module provides:

- A **compose partial** (**`<impl>.<category>.compose.yaml`**) – Included by the main **docker-compose.yaml** (e.g. pg-db, pg-storage services).
- A **service snippet** (**`<impl>.<category>.service.yaml`**) – Merged into **powersync/service.yaml** (replication or storage section). Snippets use **`!env`** (e.g. **`uri: !env PS_DATA_SOURCE_URI`**) so the PowerSync container resolves values from **docker/.env** at runtime.
- **template.env** – Env vars for that module. Init merges these into **powersync/docker/.env**.

Init copies the selected modules into **powersync/docker/modules/**, generates **docker-compose.yaml** (include of both partials plus the PowerSync service with **env_file: .env**), merges **template.env** into **.env**, and merges the service snippets into **service.yaml** while **preserving `!env` tags** so the container does substitution at runtime.

---

## Using a different config directory

```bash
powersync docker configure --directory=my-powersync --database postgres --storage postgres
powersync docker deploy --directory=my-powersync
```

---

## Optional: linking for other self-hosted commands

Docker commands do **not** require **link.yaml** or API_URL/PS_TOKEN for init, deploy, start, or stop. If you also want to run **fetch status**, **validate**, **generate schema**, or **generate token** against the same self-hosted instance, link it so those commands know the API URL and (if needed) the API key:

```bash
# After the stack is running, link to it (use the URL where PowerSync is reachable)
powersync link self-hosted --api-url=http://localhost:8080
# You will be prompted for the API key, or set PS_TOKEN so link.yaml can use !env PS_TOKEN

# Then you can run other self-hosted commands without passing --api-url
powersync fetch status
powersync validate
powersync generate schema --output=ts --output-path=./schema.ts
```

You can supply **`--api-url`** (and **PS_TOKEN** in the environment) on individual commands instead of linking if you prefer.
