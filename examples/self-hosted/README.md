# Self-Hosted Examples

## Overview

Each example is structured like a repository root with a `powersync/` folder that holds all PowerSync service configuration (connections, sync rules, Docker Compose).

```
example-name/
├── powersync/           # PowerSync service config
│   ├── docker/          # Docker Compose for PowerSync
│   ├── cli.yaml        # Instance link (api_url, api_key)
│   ├── service.yaml     # Service config (connections, auth)
│   └── sync.yaml        # Sync rules
└── ...
```

Some examples add project-specific folders (e.g. `supabase/` for local Supabase config).

## Examples

| Example                  | Description                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **local-postgres**       | PowerSync with bundled Postgres databases (source and storage). Uses `powersync docker configure` with database and storage modules.                                  |
| **local-basic-supabase** | PowerSync with external databases (Supabase). Uses `powersync docker configure` with external modules. Includes a local `supabase/` folder for migrations and config. |
| **local-postgres-node**  | Postgres stack with Node.js app using the PowerSync SDK. Auth uses a shared HS256 secret in root `.env` (demo only).                                                  |

Each example README includes layout details and steps to recreate the demo from scratch.
