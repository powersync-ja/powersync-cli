import { SelfHostedInstanceCommand } from '@powersync/cli-core';

export default class Docker extends SelfHostedInstanceCommand {
  static summary = 'Manage self-hosted PowerSync with Docker Compose (init, deploy, start, stop).';
  static description =
    'Scaffold and run a self-hosted PowerSync stack via Docker. Use `docker init` to copy a template into powersync/docker/, then `docker deploy`, `docker start`, `docker stop`.';

  static flags = {
    ...SelfHostedInstanceCommand.flags
  };

  async run(): Promise<void> {
    await this.config.runCommand('help', ['docker']);
  }
}
