import { SelfHostedInstanceCommand, type SelfHostedInstanceCommandFlags } from '@powersync/cli-core';
import { getDockerProjectName, logPowersyncProjectsStopHelp, runDockerCompose } from '../../docker.js';

export default class DockerDeploy extends SelfHostedInstanceCommand {
  static summary = 'Deploy/update self-hosted PowerSync via Docker Compose (up --force-recreate).';
  static description =
    'Start or recreate containers; waits for services (including PowerSync) to be healthy. Use after `powersync docker init`. Images are pulled if missing. Use `powersync fetch status` to debug running instances.';

  static flags = {
    ...SelfHostedInstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DockerDeploy);
    const { projectDirectory } = this.loadProject(flags as SelfHostedInstanceCommandFlags, {
      configFileRequired: false,
      linkingIsRequired: false
    });

    const opts = {
      projectDirectory,
      projectName: getDockerProjectName(projectDirectory)
    };

    this.log('Starting containers...');
    try {
      runDockerCompose(opts, ['up', '-d', '--force-recreate', '--wait']);
    } catch (err) {
      logPowersyncProjectsStopHelp(this, opts.projectName);
      throw err;
    }
    this.log('\n\nTip: use `powersync fetch status` to debug the running instance.');
  }
}
