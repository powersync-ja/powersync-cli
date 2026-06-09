import { BaseEditorWidget } from './BaseEditorWidget';
import { useSyncConfigValidationMarkers } from './use-sync-config-validation-markers';

/**
 * Props for the sync-config YAML editor provider.
 */
export type SyncConfigYamlEditorWidgetProviderProps = {
  filename: string;
};

/**
 * Provider for editing `sync-config.yaml` with sync-config validation enabled.
 */
export function SyncConfigYamlEditorWidgetProvider({ filename }: SyncConfigYamlEditorWidgetProviderProps) {
  return (
    <BaseEditorWidget filename={filename} useValidationHook={useSyncConfigValidationMarkers} yamlCustomTags={[]} />
  );
}
