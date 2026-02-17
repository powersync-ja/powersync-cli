# Basic Cloud Pull Example

This example was created by pulling an existing PowerSync Cloud instance with **`powersync pull instance`**. You do not need to run **`powersync init`** first: **`pull instance`** with your instance IDs creates the config directory, writes `cli.yaml`, and downloads `service.yaml` and `sync.yaml`.

Log in (`powersync login`) or set the `TOKEN` environment variable, then run:

```bash
# Creates powersync/, writes cli.yaml, and downloads config for the given instance
powersync pull instance --org-id=123 --project-id=abc --instance-id=def
```

The configuration file in `./powersync/service.yaml` can now be edited.

Deploy changes with

```bash
powersync deploy
```

This project can be used with any of the cloud cli commands e.g.

```bash
powersync fetch status
powersync generate schema --output-path=schema.ts --output=ts
```
