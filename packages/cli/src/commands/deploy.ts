import { CloudInstanceCommand } from '../command-types/CloudInstanceCommand.js';

export default class Deploy extends CloudInstanceCommand {
  static description = 'Deploys changes to the PowerSync management service. Cloud only.';
  static summary = 'Deploy sync rules and configuration changes.';

  static flags = {
    ...CloudInstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Deploy);

    const { projectDirectory, linked, syncRulesContent } = this.loadProject(flags, {
      configFileRequired: true,
      linkingIsRequired: true
    });
    const config = this.parseConfig(projectDirectory);
    const client = this.getClient();

    this.log(
      `Deploying changes to instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`
    );

    try {
      const existingConfig = await client.getInstanceConfig({
        app_id: linked.project_id,
        org_id: linked.org_id,
        id: linked.instance_id
      });

      await client.deployInstance({
        // Spread the existing config like name, and program version contraints.
        // Should we allow specifying these in the config file?
        ...existingConfig,
        app_id: linked.project_id,
        config,
        sync_rules: syncRulesContent
      });
    } catch (error) {
      this.error(
        `Failed to deploy changes to instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}: ${error}`,
        { exit: 1 }
      );
    }
  }
}
