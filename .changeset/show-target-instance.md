---
'@powersync/cli-core': patch
'powersync': patch
---

Show the target instance name and IDs before `deploy`, `deploy sync-config`, `deploy service-config`, `stop`, `destroy` and `compact` do anything, so it is clear which instance is about to be changed. `deploy` and `deploy service-config` now also warn when the local `service.yaml` `name` differs from the instance name, since deploying renames the instance.
