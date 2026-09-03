---
'@powersync/cli-schemas': minor
'@powersync/cli-core': minor
'powersync': minor
---

Added named targets to `cli.yaml`. Link several Cloud instances from one project directory with `powersync link cloud --target=<name> --instance-id=<id>`, then pick one per command with `--target=<name>` or the `POWERSYNC_TARGET` variable. The top-level `instance_id`, `org_id` and `project_id` fields remain the default target.

- `powersync fetch instances` lists the targets of each linked directory.
- Commands that work with both Cloud and self-hosted instances now let `--instance-id` or `--api-url` decide the context, even when `cli.yaml` is linked to the other type.
- When a linked directory has no `service.yaml`, the error now suggests `powersync pull instance`.
