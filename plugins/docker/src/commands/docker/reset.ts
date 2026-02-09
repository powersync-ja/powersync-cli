import { SelfHostedInstanceCommand, type SelfHostedInstanceCommandFlags } from '@powersync/cli-core';
import {
  getDockerProjectName,
  logPowersyncProjectsStopHelp,
  runDockerCompose,
  runDockerComposeDown
} from '../../docker.js';

export default class DockerReset extends SelfHostedInstanceCommand {
  static summary = 'Reset the self-hosted PowerSync stack (stop and remove, then start).';
  static description =
    'Run `docker compose down` then `docker compose up -d --wait`: stops and removes containers, then starts the stack and waits for services (including PowerSync) to be healthy. Use when you want a clean bring-up (e.g. after config changes). Use `powersync fetch status` to debug running instances.';

  static flags = {
    ...SelfHostedInstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DockerReset);
    const { projectDirectory } = this.loadProject(flags as SelfHostedInstanceCommandFlags, {
      configFileRequired: false,
      linkingIsRequired: false
    });

    const projectName = getDockerProjectName(projectDirectory);
    const opts = { projectDirectory, projectName };

    if (projectName) {
      this.log('Stopping and removing containers...');
      try {
        runDockerComposeDown(projectName, { stdio: 'inherit' });
      } catch {
        // down can fail if no containers exist; continue to up
      }
    }

    this.log('Starting containers...');
    try {
      runDockerCompose(opts, ['up', '-d', '--wait']);
    } catch (err) {
      logPowersyncProjectsStopHelp(this, opts.projectName);
      throw err;
    }
    this.log('\n\nTip: use `powersync fetch status` to debug the running instance.');
  }
}
