# Agent Guidelines

## Environment Variables

- Do not read `process.env` directly in application code.
- Use typed env helpers (for example, `env` from `@powersync/cli-core`) so environment access is centralized and testable.
- Keep environment resolution logic in one place; command and service code should consume resolved values.

## Testing Environment Behavior

- Prefer mocking env helpers/modules in tests instead of relying on direct `process.env` reads in production code.
- Tests may set temporary env values when needed, but should primarily validate behavior through mocked env access points.
- Reset env-related mocks/state between tests to avoid leakage.

## File Naming Conventions

- Choose the filename based on the file's primary responsibility so agents can infer intent without opening the file.
- If the main export is a class or a type/interface, the filename must exactly match that export name (for example, `ServiceCloudConfig.ts`, `AccountsHubClientSDKClient.ts`).
- Use this class/type naming rule even if the file also contains small helper functions; the primary exported symbol takes precedence.
- If the file's purpose is utility logic (single function or a group of helper methods), use action-style kebab-case names in the form `do-this-action.ts` (for example, `ensure-service-type.ts`, `resolve-config-path.ts`).
- Utility filenames should describe what the code does, not what it is. Prefer verb-led names such as `load-*`, `parse-*`, `validate-*`, `write-*`, `ensure-*`.
- Avoid generic utility names like `helpers.ts`, `utils.ts`, or `common.ts` unless the file is intentionally a broad shared entry point.
