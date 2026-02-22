import { Flags, ux } from '@oclif/core';
import { SelfHostedInstanceCommand } from '@powersync/cli-core';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import open from 'open';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class EditConfig extends SelfHostedInstanceCommand {
  static summary = 'Open the PowerSync configuration editor (Nitro preview).';
  static description =
    'Sets POWERSYNC_DIRECTORY for the current project and runs the editor Vite preview to edit config files.';

  static examples = ['<%= config.bin %> edit config', '<%= config.bin %> edit config --directory ./powersync'];

  static flags = {
    ...SelfHostedInstanceCommand.flags,
    host: Flags.string({
      description: 'Host to bind the editor preview server.',
      required: false,
      default: '0.0.0.0'
    }),
    port: Flags.integer({
      description: 'Port for the editor preview server.',
      required: false,
      default: 3000
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(EditConfig);
    const projectDir = this.ensureProjectDirExists(flags);

    const editorDir = path.resolve(__dirname, '../../..');
    const targetDist = path.join(editorDir, 'editor-dist');

    const env = {
      ...process.env,
      POWERSYNC_DIRECTORY: projectDir
    };

    this.log('Launching PowerSync configuration editor...');
    this.log(`Project directory: ${projectDir}`);
    this.log(`Editor path: ${editorDir}`);
    this.log(`Serving built editor from: ${targetDist}`);

    const vitePkg = require.resolve('vite/package.json');
    const viteBin = path.join(path.dirname(vitePkg), 'bin', 'vite.js');

    const child = spawn(
      process.execPath,
      [viteBin, 'preview', '--host', flags.host, '--port', `${flags.port}`, '--outDir', targetDist],
      {
        cwd: editorDir,
        env,
        stdio: 'inherit'
      }
    );

    const urlHost = flags.host === '0.0.0.0' ? 'localhost' : flags.host;
    const previewUrl = `http://${urlHost}:${flags.port}`;

    child.on('spawn', () => {
      this.log(`Opening ${previewUrl} in your browser...`);
      void open(previewUrl).catch((err) =>
        this.warn(`Could not open browser automatically: ${err instanceof Error ? err.message : String(err)}`)
      );
    });

    child.on('exit', (code) => {
      if (code === 0) return;
      this.error(ux.colorize('red', `Editor exited with code ${code ?? 'unknown'}`));
    });
  }
}
