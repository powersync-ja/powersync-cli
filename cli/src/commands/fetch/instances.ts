import { Command, Flags, ux } from '@oclif/core';
import { CLI_FILENAME, createAccountsHubClient, createCloudClient, parseYamlFile } from '@powersync/cli-core';
import { CLIConfig } from '@powersync/cli-schemas';
import sortBy from 'lodash/sortBy.js';
import fs, { readdir } from 'node:fs/promises';
import path from 'node:path';
import ora from 'ora';

type Instance = {
  deployable: boolean;
  has_config: boolean;
  id: string;
  name: string;
};

export type Project = {
  id: string;
  instances: Instance[];
  name: string;
};

type ProjectMap = {
  [project_id: string]: Project;
};

type Organization = {
  id: string;
  name: string;
  projects: ProjectMap;
};

type OrganizationMap = {
  [org_id: string]: Organization;
};

export default class FetchInstances extends Command {
  static description = 'List PowerSync Cloud instances, grouped by organization and project.';
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --project-id=<id> --output=json'
  ];
  static flags = {
    'org-id': Flags.string({
      description: 'Optional Organization ID. Defaults to all organizations.',
      required: false
    }),
    output: Flags.string({
      default: 'human',
      description: 'Output format: human or json.',
      options: ['human', 'json']
    }),
    'output-file': Flags.string({
      description: 'Optionally write instance information to a file.',
      required: false
    }),
    'project-id': Flags.string({
      description: 'Optional Project ID. Defaults to all projects in the org.',
      required: false
    })
  };
  static summary = '[Cloud only] List Cloud instances in the current org/project.';

  protected async fetchCloudInstances(params: { org_id?: string; project_id?: string }) {
    const { org_id, project_id } = params;
    const accountsClient = createAccountsHubClient();
    const managementClient = createCloudClient();

    const instanceMap: OrganizationMap = {};
    let totalOrgs: number | undefined;
    let processedOrgs = 0;
    let spinnerStarted = false;

    const spinner = ora({
      discardStdin: false,
      stream: process.stdout,
      text: 'Fetching cloud instances...'
    });

    try {
      for await (const page of accountsClient.listOrganizations.paginate({ id: org_id })) {
        const { objects: organizations, total } = page;
        if (totalOrgs === undefined) {
          totalOrgs = total;
          if (total > 0) {
            spinner.start();
            spinnerStarted = true;
          }
        }

        for (const organization of organizations) {
          spinner.text = `Fetching org ${processedOrgs + 1} of ${totalOrgs}...`;
          const orgMap = (instanceMap[organization.id] = {
            id: organization.id,
            name: organization.label,
            projects: {} as ProjectMap
          });

          let totalProjects: number | undefined;
          let processedProjects = 0;

          for await (const projectPage of accountsClient.listProjects.paginate({
            id: project_id,
            org_id: organization.id
          })) {
            const { objects: projects, total } = projectPage;
            if (totalProjects === undefined) {
              totalProjects = total;
            }

            for (const project of projects) {
              spinner.text = `Fetching org ${processedOrgs + 1} of ${totalOrgs}, project ${processedProjects + 1} of ${totalProjects}...`;
              const projectMap = (orgMap.projects[project.id] = {
                id: project.id,
                instances: [] as Instance[],
                name: project.name
              });
              const instances = await managementClient.listInstances({
                app_id: project.id,
                org_id: organization.id
              });
              projectMap.instances.push(...instances.instances);
              processedProjects++;
            }
          }

          processedOrgs++;
        }
      }

      return instanceMap;
    } finally {
      if (spinnerStarted) {
        spinner.stop();
      }
    }
  }

  protected async fetchLinkedInstances() {
    const subDirectories = await readdir(process.cwd());
    const linkedProjects: Array<{
      config: CLIConfig;
      subDirectory: string;
    }> = [];
    for (const subDirectory of subDirectories) {
      const linkPath = path.join(process.cwd(), subDirectory, CLI_FILENAME);
      const exists = await fs
        .stat(linkPath)
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        continue;
      }

      try {
        const valid = CLIConfig.decode(parseYamlFile(linkPath).contents?.toJSON());
        linkedProjects.push({
          config: valid,
          subDirectory
        });
      } catch {}
    }

    return linkedProjects;
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(FetchInstances);

    this.log(''); // Add spacing

    const cloudInstancMap = await this.fetchCloudInstances({
      org_id: flags['org-id'],
      project_id: flags['project-id']
    }).catch((error) => {
      this.warn(`Failed to fetch cloud instances: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    });

    const linkedInstances = await this.fetchLinkedInstances().catch((error) => {
      this.warn(`Failed to fetch linked instances: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    });

    if (flags.output === 'human') {
      // Log in human readable format
      for (const org of sortBy(Object.values(cloudInstancMap), 'name')) {
        this.log(`${ux.colorize('blue', 'Organization: ')} ${org.name} ${ux.colorize('gray', `id: ${org.id}`)}`);
        for (const project of sortBy(Object.values(org.projects), 'name')) {
          this.log(`\t${ux.colorize('blue', 'Project: ')} ${project.name} ${ux.colorize('gray', `id: ${project.id}`)}`);
          for (const instance of sortBy(project.instances, 'name')) {
            this.log(
              `\t\t${ux.colorize('blue', 'Instance: ')} ${instance.name} ${ux.colorize('gray', `id: ${instance.id}`)} ${ux.colorize('gray', `has_config: ${instance.has_config}`)} ${ux.colorize('gray', `is_provisioned: ${instance.deployable}`)}`
            );
          }
        }

        this.log('');

        for (const linked of linkedInstances) {
          this.log(`Locally linked in ./${linked.subDirectory}/`);
          this.log(`\t${ux.colorize('blue', 'Project type: ')} ${linked.config.type}`);
          if (linked.config.type === 'cloud') {
            this.log(`\t${ux.colorize('blue', 'Project ID: ')} ${linked.config.project_id}`);
            this.log(`\t${ux.colorize('blue', 'Instance ID: ')} ${linked.config.instance_id}`);
          } else if (linked.config.type === 'self-hosted') {
            this.log(`\t${ux.colorize('blue', 'API URL: ')} ${linked.config.api_url}`);
          }
        }

        this.log('');
      }
    }

    const outputObject = {
      cloudInstances: cloudInstancMap,
      linkedInstances
    };

    if (flags.output === 'json' || flags['output-file']) {
      const content = ux.colorizeJson(Object.values(outputObject));
      if (flags.output === 'json') {
        this.log(content);
      }

      if (flags['output-file']) {
        await fs.writeFile(flags['output-file'], content);
      }
    }
  }
}
