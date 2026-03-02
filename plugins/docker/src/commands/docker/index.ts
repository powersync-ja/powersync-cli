import { SelfHostedInstanceCommand } from '@powersync/cli-core';

export default class Docker extends SelfHostedInstanceCommand {
  static description =
    'Scaffold and run a self-hosted PowerSync stack via Docker. Use `docker configure` to create powersync/docker/, then `docker reset` (stop+remove then start) or `docker start` / `docker stop`.';
  static examples = ['<%= config.bin %> <%= command.id %>'];
  static flags = {
    ...SelfHostedInstanceCommand.flags
  };
  static hidden = true;
  static summary =
    '[Self-hosted only] Manage self-hosted PowerSync with Docker Compose (configure, reset, start, stop).';

  async run(): Promise<void> {
    await this.config.runCommand('help', ['docker']);
  }
}
