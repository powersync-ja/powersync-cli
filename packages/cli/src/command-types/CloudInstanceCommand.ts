import { ensureServiceTypeMatches } from '../utils/ensureServiceType.js';
import { InstanceCommand } from './InstanceCommand.js';

/** Base command for operations that require a Cloud-type PowerSync project (service.yaml _type: cloud). */
export abstract class CloudInstanceCommand extends InstanceCommand {
  static flags = {
    ...InstanceCommand.flags
  };

  /**
   * Ensures the project directory exists and service.yaml has _type: cloud.
   * @returns The resolved absolute path to the project directory.
   */
  ensureConfigType(directory: string): string {
    const projectDir = this.ensureProjectDirExists(directory);
    ensureServiceTypeMatches(this, projectDir, 'cloud', directory);
    return projectDir;
  }
}
