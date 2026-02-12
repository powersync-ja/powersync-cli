import { ux } from '@oclif/core';
import { SelfHostedInstanceCommand } from '@powersync/cli-core';
import { getDockerProjectName, logPowersyncProjectsStopHelp, runDockerCompose } from '../../docker.js';

export default class DockerStart extends SelfHostedInstanceCommand {
  static summary = 'Start the self-hosted PowerSync stack via Docker Compose.';
  static description =
    'Runs `docker compose up -d --wait` for the project docker/ compose file; waits for services (including PowerSync) to be healthy. Use `powersync fetch status` to debug running instances.';

  static flags = {
    ...SelfHostedInstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DockerStart);
    const { projectDirectory } = this.loadProject(flags, {
      configFileRequired: true
    });

    const projectName = getDockerProjectName(projectDirectory);
    try {
      runDockerCompose({ projectDirectory, projectName }, ['up', '-d', '--wait']);
    } catch (err) {
      logPowersyncProjectsStopHelp(this, projectName);
      throw err;
    }
    this.log(`\n\nTip: use "${ux.colorize('blue', 'powersync fetch status')}" to debug the running instance.`);
  }
}
