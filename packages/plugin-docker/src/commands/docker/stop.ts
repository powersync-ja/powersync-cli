import { Flags } from '@oclif/core';
import { SelfHostedInstanceCommand, type SelfHostedInstanceCommandFlags } from '@powersync/cli-core';
import { getDockerProjectName, runDockerCompose } from '../../docker.js';

export default class DockerStop extends SelfHostedInstanceCommand {
  static summary = 'Stop the self-hosted PowerSync stack via Docker Compose.';
  static description = 'Run `docker compose down` for the project docker/ compose file.';

  static flags = {
    ...SelfHostedInstanceCommand.flags,
    'compose-dir': Flags.string({
      description: 'Compose directory relative to config (default: docker).',
      default: 'docker'
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DockerStop);
    const { projectDirectory } = this.loadProject(flags as SelfHostedInstanceCommandFlags, {
      configFileRequired: false,
      linkingIsRequired: false
    });

    runDockerCompose(
      {
        projectDirectory,
        composeDir: flags['compose-dir'],
        projectName: getDockerProjectName(projectDirectory)
      },
      ['down']
    );
  }
}
