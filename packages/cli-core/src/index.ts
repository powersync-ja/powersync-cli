/**
 * Core API for PowerSync CLI and plugins.
 * Plugins (e.g. plugin-docker) import from @powersync/cli-core.
 */
export { HelpGroup } from './command-types/HelpGroup.js';
export { InstanceCommand } from './command-types/InstanceCommand.js';
export type { EnsureConfigOptions } from './command-types/InstanceCommand.js';
export { PowerSyncCommand } from './command-types/PowerSyncCommand.js';
export {
  SelfHostedInstanceCommand,
  type SelfHostedInstanceCommandFlags,
  type SelfHostedProject
} from './command-types/SelfHostedInstanceCommand.js';
export { parseYamlDocumentPreserveTags, parseYamlFile, parseYamlString, stringifyYaml } from './utils/yaml.js';
