# Agent Guidelines

## Environment Variables

- Do not read `process.env` directly in application code.
- Use typed env helpers (for example, `env` from `@powersync/cli-core`) so environment access is centralized and testable.
- Keep environment resolution logic in one place; command and service code should consume resolved values.

## Testing Environment Behavior

- Prefer mocking env helpers/modules in tests instead of relying on direct `process.env` reads in production code.
- Tests may set temporary env values when needed, but should primarily validate behavior through mocked env access points.
- Reset env-related mocks/state between tests to avoid leakage.
