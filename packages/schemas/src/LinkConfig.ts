import * as t from 'ts-codec';

export const CloudLinkConfig = t.object({
  type: t.literal('cloud'),
  instance_id: t.string.optional(),
  org_id: t.string.optional(),
  project_id: t.string.optional()
});

export type CloudLinkConfig = t.Encoded<typeof CloudLinkConfig>;

export const RequiredCloudLinkConfig = t.object({
  type: t.literal('cloud'),
  instance_id: t.string,
  org_id: t.string,
  project_id: t.string
});

export type RequiredCloudLinkConfig = t.Encoded<typeof RequiredCloudLinkConfig>;

export const SelfHostedLinkConfig = t.object({
  type: t.literal('self-hosted'),
  api_url: t.string.optional(),
  api_key: t.string.optional(),
  /** Plugin-specific data (e.g. docker compose project name). Preserved when writing link.yaml. */
  plugins: t.record(t.any).optional()
});

export type SelfHostedLinkConfig = t.Encoded<typeof SelfHostedLinkConfig>;

export const RequiredSelfHostedLinkConfig = t.object({
  type: t.literal('self-hosted'),
  api_url: t.string,
  api_key: t.string,
  plugins: t.record(t.any).optional()
});

export type RequiredSelfHostedLinkConfig = t.Encoded<typeof RequiredSelfHostedLinkConfig>;

export const LinkConfig = CloudLinkConfig.or(SelfHostedLinkConfig);
export type LinkConfig = t.Encoded<typeof LinkConfig>;
