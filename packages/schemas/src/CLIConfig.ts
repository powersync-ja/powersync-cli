import * as t from 'ts-codec';

export const CloudTargetConfig = t.object({
  instance_id: t.string,
  org_id: t.string.optional(),
  project_id: t.string.optional()
});

export type CloudTargetConfig = t.Encoded<typeof CloudTargetConfig>;

export const CloudCLIConfig = t.object({
  instance_id: t.string.optional(),
  org_id: t.string.optional(),
  project_id: t.string.optional(),
  /** Named targets selected with --target or POWERSYNC_TARGET. The top-level fields stay the default. */
  targets: t.record(CloudTargetConfig).optional(),
  type: t.literal('cloud')
});

export type CloudCLIConfig = t.Encoded<typeof CloudCLIConfig>;

export const ResolvedCloudCLIConfig = t.object({
  instance_id: t.string,
  org_id: t.string,
  project_id: t.string,
  type: t.literal('cloud')
});

export type ResolvedCloudCLIConfig = t.Encoded<typeof ResolvedCloudCLIConfig>;

export const SelfHostedCLIConfig = t.object({
  api_key: t.string.optional(),
  api_url: t.string.optional(),
  /** Plugin-specific data (e.g. docker compose project name). Preserved when writing cli.yaml. */
  plugins: t.record(t.any).optional(),
  type: t.literal('self-hosted')
});

export type SelfHostedCLIConfig = t.Encoded<typeof SelfHostedCLIConfig>;

export const ResolvedSelfHostedCLIConfig = t.object({
  api_key: t.string,
  api_url: t.string,
  plugins: t.record(t.any).optional(),
  type: t.literal('self-hosted')
});

export type ResolvedSelfHostedCLIConfig = t.Encoded<typeof ResolvedSelfHostedCLIConfig>;

export const CLIConfig = CloudCLIConfig.or(SelfHostedCLIConfig);
export type CLIConfig = t.Encoded<typeof CLIConfig>;

export const CLIConfigSchema = t.generateJSONSchema(CLIConfig);
