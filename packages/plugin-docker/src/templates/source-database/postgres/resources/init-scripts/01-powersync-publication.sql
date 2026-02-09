-- PowerSync logical replication requires a PostgreSQL publication.
-- Create a publication named "powersync" that includes the tables
-- mentioned in your sync config (sync.yaml). This script uses
-- FOR ALL TABLES so any tables you create are replicated; for production
-- you may create a publication that lists only the tables used in sync.yaml.
--
-- Example for a single table: CREATE PUBLICATION powersync FOR TABLE my_table;
-- Example for multiple:     CREATE PUBLICATION powersync FOR TABLE t1, t2, t3;
--
-- Note: Init scripts run only when the Postgres data directory is empty (first
-- container start). If you see "Publication 'powersync' does not exist", remove
-- the database volume and redeploy so init runs again, e.g.:
--   powersync docker stop --remove --remove-volumes && powersync docker deploy

CREATE PUBLICATION powersync FOR ALL TABLES;
