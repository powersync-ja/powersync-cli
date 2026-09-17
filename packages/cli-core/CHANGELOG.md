# @powersync/cli-core

## 0.10.2

### Patch Changes

- caabf52: Show the target instance name and IDs before `deploy`, `deploy sync-config`, `deploy service-config`, `stop`, `destroy` and `compact` do anything, so it is clear which instance is about to be changed. `status` shows the target first as well, with the API URL for self-hosted instances. `deploy` and `deploy service-config` now also warn when the local `service.yaml` `name` differs from the instance name, since deploying renames the instance.

  All deploy commands accept `--dry-run`, which prints the target instance, runs the validations, shows a diff of the sync config and the changed service config sections, and stops without deploying.
  - @powersync/cli-schemas@0.10.2

## 0.10.1

### Patch Changes

- 0eaf362: fix `--directory` absolute path resolution in CLI
  - @powersync/cli-schemas@0.10.1

## 0.10.0

### Minor Changes

- 90d66db: Resolve organization ID and project ID from instance ID automatically.

### Patch Changes

- @powersync/cli-schemas@0.10.0

## 0.9.6

### Patch Changes

- @powersync/cli-schemas@0.9.6

## 0.9.5

### Patch Changes

- @powersync/cli-schemas@0.9.5

## 0.9.4

### Patch Changes

- @powersync/cli-schemas@0.9.4

## 0.9.3

### Patch Changes

- @powersync/cli-schemas@0.9.3

## 0.9.2

### Patch Changes

- @powersync/cli-schemas@0.9.2

## 0.9.1

### Patch Changes

- @powersync/cli-schemas@0.9.1

## 0.9.0

Initial release.
