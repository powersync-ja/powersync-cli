import { Config, Help } from '@oclif/core';
import { CloudInstanceCommand, SelfHostedInstanceCommand, SharedInstanceCommand } from '@powersync/cli-core';

const isSubclassOf = (parent: abstract new (argv: string[], config: Config) => unknown, child: object) =>
  Object.prototype.isPrototypeOf.call(parent, child);

/**
 * Override for the `powersync help` and `powersync --help` command.
 * Displays a flat list of commands grouped by type. Does
 */
export default class PowerSyncHelp extends Help {
  protected readonly firstPartyPluginNames = new Set(['@powersync/cli-plugin-docker']);

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
    const rawTopLevel = commandId.split(':')[0];
    if (rawTopLevel) {
      return rawTopLevel;
    }

    const separator = this.config.topicSeparator ?? ':';
    return commandId.split(separator)[0] ?? commandId;
  }

  /**
   * We like to group powersync specific commands separately from plugin commands or other OCLIF commands,
   * so we check if a command is first-party based on its pluginName and the config's name, bin, and pjson.name, as well as an allowlist of known first-party plugins.
   */
  protected isFirstPartyCommand(
    command: (typeof this.sortedCommands)[number],
    firstPartyPluginNames: Set<string>
  ): boolean {
    return command.pluginName !== undefined && firstPartyPluginNames.has(command.pluginName);
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

    const commands = this.sortedCommands.filter((command) => command.id);
    const firstPartyPluginNames = new Set<string>(
      // commands from the core cli package (e.g. deploy, fetch, login, logout, etc.)
      [this.config.name, this.config.pjson?.name, this.config.bin].filter(Boolean)
    );
    for (const pluginName of this.firstPartyPluginNames) {
      firstPartyPluginNames.add(pluginName);
    }

    const firstPartyCommands = commands.filter((command) => this.isFirstPartyCommand(command, firstPartyPluginNames));
    const pluginCommands = commands.filter((command) => !this.isFirstPartyCommand(command, firstPartyPluginNames));

    const generalCommands: typeof this.sortedCommands = [];
    const cloudCommands: typeof this.sortedCommands = [];
    const sharedCommands: typeof this.sortedCommands = [];
    const selfHostedCommands: typeof this.sortedCommands = [];

    for (const command of firstPartyCommands) {
      const CommandClass = await command.load();
      if (isSubclassOf(CloudInstanceCommand, CommandClass)) {
        cloudCommands.push(command);
      } else if (isSubclassOf(SelfHostedInstanceCommand, CommandClass)) {
        selfHostedCommands.push(command);
      } else if (isSubclassOf(SharedInstanceCommand, CommandClass)) {
        sharedCommands.push(command);
      } else {
        generalCommands.push(command);
      }
    }

    if (generalCommands.length > 0) {
      this.log(this.formatCommandsSection('POWERSYNC COMMANDS', generalCommands));
      this.log('');
    }

    if (cloudCommands.length > 0) {
      this.log(this.formatCommandsSection('CLOUD COMMANDS', cloudCommands));
      this.log('');
    }

    if (sharedCommands.length > 0) {
      this.log(this.formatCommandsSection('SHARED COMMANDS', sharedCommands));
      this.log('');
    }

    if (selfHostedCommands.length > 0) {
      this.log(this.formatCommandsSection('SELF-HOSTED COMMANDS', selfHostedCommands));
      this.log('');
    }

    if (pluginCommands.length > 0) {
      this.log(this.formatCommandsSection('OTHER COMMANDS', pluginCommands));
      this.log('');
    }
  }
}
