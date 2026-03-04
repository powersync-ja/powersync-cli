import { CommandHelpGroup, SelfHostedInstanceCommand } from '@powersync/cli-core';

/**
 * Base command for Docker-related operations. Groups all docker subcommands under LOCAL DEVELOPMENT in the root help output.
 */
export abstract class DockerCommand extends SelfHostedInstanceCommand {
  static commandHelpGroup = CommandHelpGroup.LOCAL_DEVELOPMENT;
}
