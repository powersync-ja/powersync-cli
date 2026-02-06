import { Flags } from '@oclif/core';
import { SelfHostedInstanceCommand, type SelfHostedInstanceCommandFlags } from '@powersync/cli-core';
import { getDockerProjectName, runDockerCompose } from '../../docker.js';

export default class DockerDeploy extends SelfHostedInstanceCommand {
  static summary = 'Deploy/update self-hosted PowerSync via Docker Compose (up --force-recreate).';
  static description = 'Start or recreate containers. Use after `powersync docker init`. Images are pulled if missing.';

  static flags = {
    ...SelfHostedInstanceCommand.flags,
    'compose-dir': Flags.string({
      description: 'Compose directory relative to config (default: docker). Uses docker-compose.yaml inside it.',
      default: 'docker'
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DockerDeploy);
    const { projectDirectory } = this.loadProject(flags as SelfHostedInstanceCommandFlags, {
      configFileRequired: false,
      linkingIsRequired: false
    });

    const opts = {
      projectDirectory,
      composeDir: flags['compose-dir'],
      projectName: getDockerProjectName(projectDirectory)
    };

    this.log('Starting containers (recreate if needed)...');
    runDockerCompose(opts, ['up', '-d', '--force-recreate']);
  }
}
