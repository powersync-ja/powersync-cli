import { Command, Flags, ux } from '@oclif/core';
import { createAccountsHubClient, createCloudClient } from '@powersync/cli-core';
import sortBy from 'lodash/sortBy.js';
import ora from 'ora';

type Instance = {
  id: string;
  name: string;
  has_config: boolean;
  deployable: boolean;
};

export type Project = {
  id: string;
  name: string;
  instances: Instance[];
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
  static description =
    'List PowerSync Cloud instances in the current org and project. Use with a linked directory or pass --org-id and --project-id. Cloud only.';
  static summary = 'List Cloud instances in the current org/project.';

  static flags = {
    'org-id': Flags.string({
      description: 'Optional Organization ID. Defaults to all organizations.',
      required: false
    }),
    'project-id': Flags.string({
      description: 'Optional Project ID. Defaults to all projects in the org.',
      required: false
    }),
    output: Flags.string({
      description: 'Output format: human or json.',
      options: ['human', 'json'],
      default: 'human'
    })
  };

  async run(): Promise<void> {
    const accountsClient = await createAccountsHubClient();
    const managementClient = await createCloudClient();

    const { flags } = await this.parse(FetchInstances);
    const { org_id, project_id } = flags;

    const instanceMap: OrganizationMap = {};
    let totalOrgs: number | undefined;
    let processedOrgs = 0;
    let spinnerStarted = false;

    const spinner = ora({
      text: 'Fetching instances...',
      stream: process.stdout
    });

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
              name: project.name,
              instances: [] as Instance[]
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

    if (spinnerStarted) {
      spinner.stop();
    }

    if (flags.output === 'human') {
      // Log in human readable format
      for (const org of sortBy(Object.values(instanceMap), 'name')) {
        this.log(`${ux.colorize('blue', 'Organization: ')} ${org.name} ${ux.colorize('gray', `id=${org.id}`)}`);
        for (const project of sortBy(Object.values(org.projects), 'name')) {
          this.log(`\t${ux.colorize('blue', 'Project: ')} ${project.name} ${ux.colorize('gray', `id=${project.id}`)}`);
          for (const instance of sortBy(project.instances, 'name')) {
            this.log(
              `\t\t${ux.colorize('blue', 'Instance: ')} ${instance.name} ${ux.colorize('gray', `id=${instance.id}`)} ${ux.colorize('gray', `has_config=${instance.has_config}`)} ${ux.colorize('gray', `deployable=${instance.deployable}`)}`
            );
          }
        }
        this.log('');
      }
    } else if (flags.output === 'json') {
      this.log(ux.colorize('gray', JSON.stringify(instanceMap, null, '\t')));
    }
  }
}
