# Basic Cloud Pull Example

This example was created by pulling the config for an existing instance.

```bash
# The pull config command automatically links this project with the PowerSync instance
powersync pull config --org-id=123 --project-id=abc --instance-id=def
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
