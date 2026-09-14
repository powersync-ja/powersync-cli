---
'@powersync/cli-plugin-config-edit': patch
'powersync': patch
---

fix `powersync edit config` crashing with `Cannot find module 'minimatch'` by keeping `@oclif/core` external in the editor server build
