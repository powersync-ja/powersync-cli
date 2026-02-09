import { Flags } from '@oclif/core';
import { SelfHostedInstanceCommand, type SelfHostedInstanceCommandFlags } from '@powersync/cli-core';
import { getDockerProjectName, runDockerComposeDown } from '../../docker.js';

export default class DockerStop extends SelfHostedInstanceCommand {
  static summary = 'Stop a PowerSync Docker Compose project by name.';
  static description =
    'Run `docker compose -p <project-name> down`. Does not require the project directory or a compose file, so you can run it from anywhere (e.g. after a deploy conflict). Use --project-name or run from a project with link.yaml to choose which project to stop.';

  static flags = {
    ...SelfHostedInstanceCommand.flags,
    'project-name': Flags.string({
      description:
        'Docker Compose project name to stop (e.g. powersync_myapp). If omitted and run from a project directory, uses plugins.docker.project_name from link.yaml. Pass this to stop from any directory without loading the project.'
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DockerStop);

    let projectName = flags['project-name'];
    if (projectName == null || projectName === '') {
      const { projectDirectory } = this.loadProject(flags as SelfHostedInstanceCommandFlags, {
        configFileRequired: false,
        linkingIsRequired: false
      });
      projectName = getDockerProjectName(projectDirectory) ?? undefined;
    }

    if (projectName == null || projectName === '') {
      this.error(
        'Project name required. Pass --project-name=<name> or run from a project directory that has link.yaml with plugins.docker.project_name.',
        {
          exit: 1
        }
      );
    }

    runDockerComposeDown(projectName);
  }
}
