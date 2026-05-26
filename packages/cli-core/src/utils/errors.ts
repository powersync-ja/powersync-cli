/**
 * Shown when a command needs an instance link but none of the inputs (flags, cli.yaml, env) resolved one.
 */
export const LINK_MISSING_ERROR_MESSAGE = [
  'Linking is required before using this command.',
  'Provide --api-url (self-hosted) or --instance-id (cloud), or link the project first.'
].join('\n');
