---
'@powersync/cli-schemas': minor
'@powersync/cli-core': minor
'powersync': minor
---

Added named environments to `cli.yaml`. Link several Cloud instances from one project directory with `powersync link cloud --environment=<name> --instance-id=<id>`, then pick one per command with `--environment=<name>` or the `POWERSYNC_ENVIRONMENT` variable. The top-level `instance_id`, `org_id` and `project_id` fields remain the default target.
