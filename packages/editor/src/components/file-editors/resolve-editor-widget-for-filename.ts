import type { ComponentType } from 'react';

import { ServiceYamlEditorWidgetProvider } from './ServiceYamlEditorWidgetProvider';
import { SyncConfigYamlEditorWidgetProvider } from './SyncConfigYamlEditorWidgetProvider';

/**
 * Common props shape shared by file editor widget providers.
 */
type EditorWidgetProviderProps = {
  filename: string;
};

const EDITOR_WIDGET_BY_FILENAME: Record<string, ComponentType<EditorWidgetProviderProps>> = {
  'service.yaml': ServiceYamlEditorWidgetProvider,
  'sync-config.yaml': SyncConfigYamlEditorWidgetProvider
};

/**
 * Resolves the correct file editor widget provider for a given filename.
 */
export function resolveEditorWidgetForFilename(filename: string): ComponentType<EditorWidgetProviderProps> {
  return EDITOR_WIDGET_BY_FILENAME[filename] ?? ServiceYamlEditorWidgetProvider;
}
