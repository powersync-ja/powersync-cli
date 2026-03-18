---
'powersync': patch
---

Add `--skip-validations` and `--validate-only` flags to `deploy` and `validate` commands.

These mutually exclusive flags accept a comma-separated list of validation tests (`configuration`, `connections`, `sync-config`) and allow users to skip or isolate specific validation checks. This is useful when deploying behind VPC endpoints, dealing with transient sync config timeouts, or bypassing schema validation for older configs.
