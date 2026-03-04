import { Help } from '@oclif/core';
import { CommandHelpGroup } from '@powersync/cli-core';

/** Order in which sections appear in the root help output. */
const SECTION_ORDER: CommandHelpGroup[] = [
  CommandHelpGroup.AUTHENTICATION,
  CommandHelpGroup.PROJECT_SETUP,
  CommandHelpGroup.CLOUD,
  CommandHelpGroup.INSTANCE,
  CommandHelpGroup.LOCAL_DEVELOPMENT,
  CommandHelpGroup.ADDITIONAL
];

/**
 * Custom help implementation for the `powersync help` and `powersync --help` commands.
 *
 * This override:
 * - Displays a flat list of commands at the root level instead of nested topic trees.
 * - Formats command IDs using the configured `topicSeparator` (for example, "deploy:instance" → "deploy instance"
 *   when the separator is a space).
 * - Groups commands into sections defined by the `commandHelpGroup` static property on each command class.
 *   Commands without a `commandHelpGroup` are shown under ADDITIONAL COMMANDS.
 */
export default class PowerSyncHelp extends Help {
  protected commandRows(commands: typeof this.sortedCommands, idPadding: number): [string, string | undefined][] {
    return commands
      .filter((command) => (this.opts.hideAliasesFromRoot ? !command.aliases?.includes(command.id) : true))
      .map((command) => {
        const id = this.displayId(command.id);
        // Strip type prefixes (e.g. "[Cloud only]", "[Self-hosted only]") since the section grouping already conveys this.
        const summary = this.summary(command)?.replace(/^\[(Cloud|Self-hosted) only\]\s*/i, '');
        // We add some padding to align the command name to the description
        return [id.padEnd(idPadding), summary];
      });
  }

  /**
   * Commands IDs use a `:` separator, but we allow ` ` spaces.
   * This method converts command IDs to the display format based on the config topicSeparator (e.g. "deploy:instance" → "deploy instance" if topicSeparator is " ").
   */
  protected displayId(commandId: string): string {
    if (this.config.topicSeparator === ':') {
      return commandId;
    }

    return commandId.replaceAll(':', this.config.topicSeparator);
  }

  /**
   * Formats a section of commands for display in the help output.
   * Groups commands by their top-level key and renders them with proper indentation and spacing.
   */
  protected formatCommandsSection(title: string, commands: typeof this.sortedCommands): string {
    const groupedCommands: Array<typeof this.sortedCommands> = [];
    let currentGroup: typeof this.sortedCommands = [];
    let currentKey: string | undefined;

    for (const command of commands) {
      const key = this.groupKeyForCommand(command.id);
      if (currentKey === undefined || key === currentKey) {
        currentGroup.push(command);
        currentKey = key;
        continue;
      }

      groupedCommands.push(currentGroup);
      currentGroup = [command];
      currentKey = key;
    }

    if (currentGroup.length > 0) {
      groupedCommands.push(currentGroup);
    }

    let idPadding = 0;
    for (const command of commands) {
      idPadding = Math.max(idPadding, this.displayId(command.id).length);
    }

    const body = groupedCommands.map((group) => this.renderCommandsBody(group, idPadding)).join('\n\n');

    return this.section(title, body);
  }

  /**
   * Commands are grouped by the first segment of their ID (e.g. "deploy" for "deploy:instance", "deploy:service-config", etc.)
   *  to create a flat command list at the root level, while still allowing for nested commands.
   */
  protected groupKeyForCommand(commandId: string): string {
    const separator = this.config.topicSeparator ?? ':';
    // Prefer the configured topic separator when deriving the top-level key
    if (separator && commandId.includes(separator)) {
      const topLevel = commandId.split(separator)[0];
      return topLevel || commandId;
    }

    // If the configured separator is not ":" but the ID still uses ":", fall back to ":"-based grouping
    if (separator !== ':' && commandId.includes(':')) {
      const topLevel = commandId.split(':')[0];
      return topLevel || commandId;
    }

    // No known separator found; treat the whole ID as the group key
    return commandId;
  }

  protected renderCommandsBody(commands: typeof this.sortedCommands, idPadding: number): string {
    return this.renderList(this.commandRows(commands, idPadding), {
      indentation: 2,
      spacer: '\n',
      stripAnsi: this.opts.stripAnsi
    });
  }

  protected async showRootHelp(): Promise<void> {
    const state = this.config.pjson?.oclif?.state;
    if (state) {
      this.log(state === 'deprecated' ? `${this.config.bin} is deprecated` : `${this.config.bin} is in ${state}.\n`);
    }

    this.log(this.formatRoot());
    this.log('');

    const commandsByGroup = new Map<CommandHelpGroup, typeof this.sortedCommands>();

    for (const command of this.sortedCommands.filter((c) => c.id)) {
      const CommandClass = await command.load();
      const group =
        (CommandClass as { commandHelpGroup?: CommandHelpGroup }).commandHelpGroup ?? CommandHelpGroup.ADDITIONAL;

      if (!commandsByGroup.has(group)) {
        commandsByGroup.set(group, []);
      }

      commandsByGroup.get(group)!.push(command);
    }

    for (const group of SECTION_ORDER) {
      const groupCommands = commandsByGroup.get(group);
      if (groupCommands && groupCommands.length > 0) {
        this.log(this.formatCommandsSection(`${group} COMMANDS`, groupCommands));
        this.log('');
      }
    }
  }
}
