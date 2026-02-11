import { PowerSyncDatabase, createBaseLogger } from '@powersync/node';
import 'dotenv/config';
import { DemoConnector } from './connector.js';
import { AppSchema } from './schema.js';

async function main() {
  const logger = createBaseLogger();
  logger.useDefaults();
  const db = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      dbFilename: 'powersync.db'
    }
  });

  db.registerListener({
    statusChanged: (status) => {
      if (status.dataFlowStatus.downloadError) {
        logger.error('Download error:', status.dataFlowStatus.downloadError);
      }
      if (status.dataFlowStatus.uploadError) {
        logger.error('Upload error:', status.dataFlowStatus.uploadError);
      }
      if (status.dataFlowStatus.downloadProgress) {
        logger.info('Download progress:', status.dataFlowStatus.downloadProgress);
      }
    }
  });

  await db.init();

  console.log('Connecting to PowerSync...');

  await db.connect(new DemoConnector());

  console.log('Waiting for first sync...');
  await db.waitForFirstSync();

  const todos = await db.getAll('SELECT * FROM todos');
  console.log(`Synced ${todos.length} todo(s):`);
  for (const row of todos) {
    console.log(`  - ${(row as { content: string }).content}`);
  }

  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
