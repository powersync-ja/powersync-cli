import * as t from 'ts-codec';

export const CloudLinkConfig = t.object({
  type: t.literal('cloud'),
  instance_id: t.string.optional(),
  org_id: t.string.optional(),
  project_id: t.string.optional()
});

export type CloudLinkConfig = t.Encoded<typeof CloudLinkConfig>;

export const ResolvedCloudLinkConfig = t.object({
  type: t.literal('cloud'),
  instance_id: t.string,
  org_id: t.string,
  project_id: t.string
});

export type ResolvedCloudLinkConfig = t.Encoded<typeof ResolvedCloudLinkConfig>;

export const SelfHostedLinkConfig = t.object({
  type: t.literal('self-hosted'),
  api_url: t.string.optional(),
  api_key: t.string.optional(),
  /** Plugin-specific data (e.g. docker compose project name). Preserved when writing link.yaml. */
  plugins: t.record(t.any).optional()
});

export type SelfHostedLinkConfig = t.Encoded<typeof SelfHostedLinkConfig>;

export const ResolvedSelfHostedLinkConfig = t.object({
  type: t.literal('self-hosted'),
  api_url: t.string,
  api_key: t.string,
  plugins: t.record(t.any).optional()
});

export type ResolvedSelfHostedLinkConfig = t.Encoded<typeof ResolvedSelfHostedLinkConfig>;

export const LinkConfig = CloudLinkConfig.or(SelfHostedLinkConfig);
export type LinkConfig = t.Encoded<typeof LinkConfig>;

export const LinkConfigSchema = t.generateJSONSchema(LinkConfig);
