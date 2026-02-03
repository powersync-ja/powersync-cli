import { ensureServiceTypeMatches } from '../utils/ensureServiceType.js';
import { InstanceCommand } from './InstanceCommand.js';

/** Base command for operations that require a self-hosted PowerSync project (service.yaml _type: self-hosted). */
export abstract class SelfHostedInstanceCommand extends InstanceCommand {
  static flags = {
    ...InstanceCommand.flags
  };

  /**
   * Ensures the project directory exists and service.yaml has _type: self-hosted.
   * @returns The resolved absolute path to the project directory.
   */
  ensureConfigType(directory: string): string {
    const projectDir = this.ensureProjectDirExists(directory);
    ensureServiceTypeMatches(this, projectDir, 'self-hosted', directory);
    return projectDir;
  }
}
