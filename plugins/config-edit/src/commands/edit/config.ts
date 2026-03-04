import { Flags, ux } from '@oclif/core';
import { SharedInstanceCommand } from '@powersync/cli-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import open from 'open';
import waitPort from 'wait-port';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class EditConfig extends SharedInstanceCommand {
  static description = 'Loads the linked project context and runs the editor Nitro server to edit config files.';
  static examples = ['<%= config.bin %> edit config', '<%= config.bin %> edit config --directory ./powersync'];
  static flags = {
    ...SharedInstanceCommand.flags,
    host: Flags.string({
      default: '127.0.0.1',
      description: 'Host to bind the editor preview server. Pass 0.0.0.0 to expose on all interfaces.',
      required: false
    }),
    port: Flags.integer({
      default: 3000,
      description: 'Port for the editor preview server.',
      required: false
    })
  };
  static summary = 'Open the PowerSync configuration editor (Nitro server).';

  async run(): Promise<void> {
    const { flags } = await this.parse(EditConfig);
    const project = await this.loadProject(flags, {
      configFileRequired: false
    });
    const projectContextPayload = JSON.stringify({
      linkedProject: project
    });

    const editorDir = path.resolve(__dirname, '../../..');
    const targetDist = path.join(editorDir, 'editor-dist');

    const env = {
      ...process.env,
      POWERSYNC_PROJECT_CONTEXT: projectContextPayload
    };

    this.log('Launching PowerSync configuration editor...');
    this.log(`Project directory: ${project.projectDirectory}`);
    this.log(`Linked project context: ${project.linked.type}`);
    this.log(`Editor path: ${editorDir}`);
    this.log(`Serving built editor from: ${targetDist}`);

    const child = spawn(
      'node',
      [path.join(targetDist, 'server/index.mjs'), '--host', flags.host, '--port', String(flags.port)],
      {
        cwd: editorDir,
        env,
        stdio: 'inherit'
      }
    );

    const urlHost = flags.host === '0.0.0.0' ? '127.0.0.1' : flags.host;
    const previewUrl = `http://${urlHost}:${flags.port}`;

    // Wait for the server to be ready before opening the browser
    child.on('spawn', async () => {
      this.log('Server starting, waiting for port to become available...');
      try {
        await waitPort({
          host: urlHost,
          port: flags.port,
          timeout: 30_000
        });
        this.log(`Server ready! Opening ${previewUrl} in your browser...`);
        await open(previewUrl);
      } catch (error) {
        this.warn(`Could not open browser automatically: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    child.on('exit', (code) => {
      if (code === 0) return;
      this.error(ux.colorize('red', `Editor exited with code ${code ?? 'unknown'}`));
    });
  }
}
