import { SelfHostedInstanceCommand, type SelfHostedInstanceCommandFlags } from '@powersync/cli-core';
import { getDockerProjectName, logPowersyncProjectsStopHelp, runDockerCompose } from '../../docker.js';

export default class DockerStart extends SelfHostedInstanceCommand {
  static summary = 'Start the self-hosted PowerSync stack via Docker Compose.';
  static description =
    'Run `docker compose up -d --wait` for the project docker/ compose file; waits for services (including PowerSync) to be healthy.';

  static flags = {
    ...SelfHostedInstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DockerStart);
    const { projectDirectory } = this.loadProject(flags as SelfHostedInstanceCommandFlags, {
      configFileRequired: false,
      linkingIsRequired: false
    });

    try {
      runDockerCompose(
        {
          projectDirectory,
          projectName: getDockerProjectName(projectDirectory)
        },
        ['up', '-d', '--wait']
      );
    } catch (err) {
      logPowersyncProjectsStopHelp(this);
      throw err;
    }
  }
}
