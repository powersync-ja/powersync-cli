/**
 * Groups for command flag inheritance.
 * https://oclif.io/docs/flag_inheritance/
 */
export enum HelpGroup {
  /**
   * Flags which are relevant to the project being operated on.
   */
  PROJECT = 'PROJECT',

  /**
   * Flags which are relevant to the cloud project being operated on.
   */
  CLOUD_PROJECT = 'CLOUD_PROJECT',

  /**
   * Flags which are relevant to the self-hosted project being operated on.
   */
  SELF_HOSTED_PROJECT = 'SELF_HOSTED_PROJECT'
}
