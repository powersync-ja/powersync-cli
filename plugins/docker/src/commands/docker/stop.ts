import { Flags, ux } from '@oclif/core';
import { SelfHostedInstanceCommand, type SelfHostedInstanceCommandFlags } from '@powersync/cli-core';
import { getDockerProjectName, runDockerComposeDown, runDockerComposeStop } from '../../docker.js';

export default class DockerStop extends SelfHostedInstanceCommand {
  static summary = 'Stop a PowerSync Docker Compose project by name.';
  static description =
    'Run `docker compose -p <project-name> stop` (containers are not removed by default). Does not require the project directory or a compose file, so you can run it from anywhere (e.g. after a reset conflict). Use --project-name or run from a project with cli.yaml to choose which project to stop. Use --remove to also remove the containers. Use --remove-volumes to also remove volumes (e.g. to re-run DB init scripts on next reset).';
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --project-name=powersync_myapp --remove'
  ];

  static flags = {
    ...SelfHostedInstanceCommand.flags,
    'project-name': Flags.string({
      description:
        'Docker Compose project name to stop (e.g. powersync_myapp). If omitted and run from a project directory, uses plugins.docker.project_name from cli.yaml. Pass this to stop from any directory without loading the project.'
    }),
    remove: Flags.boolean({
      description:
        'Remove containers after stopping (docker compose down). By default only stop (docker compose stop).',
      default: false
    }),
    'remove-volumes': Flags.boolean({
      description:
        'Remove named volumes (docker compose down -v). Use to reset database/storage so init scripts run again on next reset. Implies --remove.',
      default: false
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DockerStop);

    let projectName = flags['project-name'];
    if (projectName == null || projectName === '') {
      const { projectDirectory } = this.loadProject(flags as SelfHostedInstanceCommandFlags, {
        configFileRequired: true
      });
      projectName = getDockerProjectName(projectDirectory) ?? undefined;
    }

    if (projectName == null || projectName === '') {
      this.error(
        ux.colorize(
          'red',
          'Project name required. Pass --project-name=<name> or run from a project directory that has cli.yaml with plugins.docker.project_name.'
        ),
        { exit: 1 }
      );
    }

    if (flags['remove-volumes'] || flags.remove) {
      runDockerComposeDown(projectName, { removeVolumes: flags['remove-volumes'] });
    } else {
      runDockerComposeStop(projectName);
    }
  }
}
