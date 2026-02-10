/**
 * Core API for PowerSync CLI and plugins.
 * Plugins (e.g. plugin-docker) import from @powersync/cli-core.
 */
export { HelpGroup } from './command-types/HelpGroup.js';
export { InstanceCommand } from './command-types/InstanceCommand.js';
export type { EnsureConfigOptions } from './command-types/InstanceCommand.js';
export { PowerSyncCommand, type StyledErrorParams } from './command-types/PowerSyncCommand.js';
export {
  SelfHostedInstanceCommand,
  type SelfHostedInstanceCommandFlags,
  type SelfHostedProject
} from './command-types/SelfHostedInstanceCommand.js';
export * from './utils/project-config.js';
export { parseYamlDocumentPreserveTags, parseYamlFile, stringifyYaml } from './utils/yaml.js';
