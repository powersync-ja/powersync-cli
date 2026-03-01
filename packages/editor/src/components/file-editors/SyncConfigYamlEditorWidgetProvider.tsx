import { BaseEditorWidget } from './BaseEditorWidget';
import { useSyncRulesValidationMarkers } from './use-sync-rules-validation-markers';

/**
 * Props for the sync-config YAML editor provider.
 */
export type SyncConfigYamlEditorWidgetProviderProps = {
  filename: string;
};

/**
 * Provider for editing `sync-config.yaml` with sync-rules validation enabled.
 */
export function SyncConfigYamlEditorWidgetProvider({ filename }: SyncConfigYamlEditorWidgetProviderProps) {
  return <BaseEditorWidget filename={filename} useValidationHook={useSyncRulesValidationMarkers} yamlCustomTags={[]} />;
}
