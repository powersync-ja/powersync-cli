import { ux } from '@oclif/core';
import { type SelfHostedInstanceCommandFlags } from '@powersync/cli-core';

import {
  getDockerProjectName,
  logPowersyncProjectsStopHelp,
  runDockerCompose,
  runDockerComposeDown
} from '../../docker.js';
import { DockerCommand } from '../../DockerCommand.js';

export default class DockerReset extends DockerCommand {
  static description =
    'Run `docker compose down` then `docker compose up -d --wait`: stops and removes containers, then starts the stack and waits for services (including PowerSync) to be healthy. Use when you want a clean bring-up (e.g. after config changes). Use `powersync status` to debug running instances.';
  static examples = ['<%= config.bin %> <%= command.id %>'];
  static summary = 'Reset the self-hosted PowerSync stack (stop and remove, then start).';

  async run(): Promise<void> {
    const { flags } = await this.parse(DockerReset);
    const { projectDirectory } = await this.loadProject(flags as SelfHostedInstanceCommandFlags, {
      configFileRequired: true
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
    } catch (error) {
      logPowersyncProjectsStopHelp(this, opts.projectName);
      throw error;
    }

    this.log(`\n\nTip: use "${ux.colorize('blue', 'powersync status')}" to debug the running instance.`);
  }
}
