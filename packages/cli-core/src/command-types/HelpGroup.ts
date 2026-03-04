/**
 * Groups for command flag inheritance.
 * https://oclif.io/docs/flag_inheritance/
 */
export enum HelpGroup {
  CLOUD_PROJECT = 'CLOUD_PROJECT',
  PROJECT = 'PROJECT',
  SELF_HOSTED_PROJECT = 'SELF_HOSTED_PROJECT'
}

/**
 * Section headings used to group commands in the root help output.
 * Set `static commandHelpGroup = CommandHelpGroup.<VALUE>` on a command class (or its base) to control which section it appears in.
 * The string value is the category name; " COMMANDS" is appended automatically when rendering.
 * Commands without a `commandHelpGroup` are shown under ADDITIONAL COMMANDS.
 */
export enum CommandHelpGroup {
  ADDITIONAL = 'ADDITIONAL',
  AUTHENTICATION = 'AUTHENTICATION',
  CLOUD = 'CLOUD',
  INSTANCE = 'INSTANCE',
  LOCAL_DEVELOPMENT = 'LOCAL DEVELOPMENT',
  PROJECT_SETUP = 'PROJECT SETUP'
}
