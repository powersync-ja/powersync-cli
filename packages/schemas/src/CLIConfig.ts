import * as t from 'ts-codec';

export const CloudCLIConfig = t.object({
  type: t.literal('cloud'),
  instance_id: t.string.optional(),
  org_id: t.string.optional(),
  project_id: t.string.optional()
});

export type CloudCLIConfig = t.Encoded<typeof CloudCLIConfig>;

export const ResolvedCloudCLIConfig = t.object({
  type: t.literal('cloud'),
  instance_id: t.string,
  org_id: t.string,
  project_id: t.string
});

export type ResolvedCloudCLIConfig = t.Encoded<typeof ResolvedCloudCLIConfig>;

export const SelfHostedCLIConfig = t.object({
  type: t.literal('self-hosted'),
  api_url: t.string.optional(),
  api_key: t.string.optional(),
  /** Plugin-specific data (e.g. docker compose project name). Preserved when writing cli.yaml. */
  plugins: t.record(t.any).optional()
});

export type SelfHostedCLIConfig = t.Encoded<typeof SelfHostedCLIConfig>;

export const ResolvedSelfHostedCLIConfig = t.object({
  type: t.literal('self-hosted'),
  api_url: t.string,
  api_key: t.string,
  plugins: t.record(t.any).optional()
});

export type ResolvedSelfHostedCLIConfig = t.Encoded<typeof ResolvedSelfHostedCLIConfig>;

export const CLIConfig = CloudCLIConfig.or(SelfHostedCLIConfig);
export type CLIConfig = t.Encoded<typeof CLIConfig>;

export const CLIConfigSchema = t.generateJSONSchema(CLIConfig);
