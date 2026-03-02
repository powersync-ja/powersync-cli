import { column, Schema, Table } from '@powersync/node';

/**
 * Client-side schema for the PowerSync SQLite database.
 * Matches the sync config (todos table from the backend).
 */
export const AppSchema = new Schema({
  todos: new Table({
    content: column.text,
    created_at: column.text
  })
});
