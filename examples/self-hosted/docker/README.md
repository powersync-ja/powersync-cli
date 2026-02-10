# Basic Docker Example

This example was created with (in this directory):

```bash
powersync init --type=self-hosted
powersync docker configure --database=postgres --storage=postgres
```

The Postgres database requires manual init scripts to be configured. A basic `todos` table has been declared. the `sync.yaml` file has been updated with the relevant rules.

The Docker compose project can be started with

```bash
powersync docker start
```

This project can now be used with any of the self hosted cli commands e.g.

```bash
powersync fetch status
powersync generate schema --output-path=schema.ts --output=ts
```
