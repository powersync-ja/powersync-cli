import { SelfHostedInstanceCommand, type SelfHostedInstanceCommandFlags } from '@powersync/cli-core';
import {
  getDockerProjectName,
  logPowersyncProjectsStopHelp,
  runDockerCompose,
  runDockerComposeDown
} from '../../docker.js';

export default class DockerStart extends SelfHostedInstanceCommand {
  static summary = 'Start the self-hosted PowerSync stack via Docker Compose.';
  static description =
    'Run `docker compose up -d --wait` for the project docker/ compose file; waits for services (including PowerSync) to be healthy. Use `powersync fetch status` to debug running instances.';

  static flags = {
    ...SelfHostedInstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DockerStart);
    const { projectDirectory } = this.loadProject(flags as SelfHostedInstanceCommandFlags, {
      configFileRequired: false,
      linkingIsRequired: false
    });

    const projectName = getDockerProjectName(projectDirectory);
    try {
      runDockerCompose({ projectDirectory, projectName }, ['up', '-d', '--wait']);
    } catch (err) {
      if (projectName) {
        this.log('Tearing down partial stack to free ports...');
        try {
          runDockerComposeDown(projectName, { stdio: 'pipe' });
        } catch {
          // Ignore; rethrow original error below
        }
      }
      logPowersyncProjectsStopHelp(this, projectName);
      throw err;
    }
    this.log('\n\nTip: use `powersync fetch status` to debug the running instance.');
  }
}
