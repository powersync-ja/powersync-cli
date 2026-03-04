# powersync

## 0.9.0

Refactored CLI. See docs for details.

## 0.8.0

### Minor Changes

- Add MongoDB selective connection for deployment and creation of instances

## 0.7.1

### Patch Changes

- Applied JWT audience fix of v0.7.0 to the `instance deploy` command.

## 0.7.0

### Minor Changes

- [Internal] Updated dependencies.
  - Fixed bug where specified JWT audiences were not used when configuring PowerSync instances.
  - Updated Supabase Auth to accept Supabase JWT secret config.

## 0.6.1

### Patch Changes

- Remove the need to have .powersync/env.powersync when injecting env variables

## 0.6.0

### Minor Changes

- Removed `cli` from `bin` and replaced it with `powersync` so that `powersync [command]` will now work when installed a dependency

## 0.5.2

### Patch Changes

- Rename missed JWKS audiences to JWT Audience

## 0.5.1

### Patch Changes

- Fix duplicate char for `create` and `deploy` commands
  Add link to init API Token message

## 0.5.0

### Minor Changes

- Add JWKS audiences on `create` and `deploy`
  Add `generate-dev-token` command

### Patch Changes

- Handle API token error

## 0.4.2

### Patch Changes

- Update packages
  Fix check when using `skipConfirmation` flag

## 0.4.1

### Patch Changes

- Update dependencies and add Japan region

## 0.4.0

### Minor Changes

- - Generate an improved README
  - [BREAKING] Change from using `app` naming convention to instead use `project`. This will require users to rerun `npx powersync init` and/or to change any CI process to use `PROJECT_ID` instead of `APP_ID`.

## 0.3.0

### Minor Changes

- Added app name and version to user-agent header

## 0.2.4

### Patch Changes

- Improve description of commands that use a local sync rules file

## 0.2.3

### Patch Changes

- chore: add http headers

## 0.2.2

### Patch Changes

- Remove instance id requirement from test connection

## 0.2.1

### Patch Changes

- Fix env variable

## 0.2.0

### Minor Changes

- - **BREAKING** introduced a name change to one of the env variables you will need to run `powersync init` again
  - Added test connection before init
  - Made changes to allow env variables to be injected
  - Added further usability improvements

## 0.1.2

### Patch Changes

- Fix folder already created
  - Fix util using hardcoded env

## 0.1.1

### Patch Changes

- Replace powersync-sdk folder with bundled private packages
  - Change some copy
  - Move tests into test folder
  - Use powersync env from powersync folder in home directory

## 0.1.0

### Minor Changes

- Beta Release
