import { BaseEditorWidget } from './BaseEditorWidget';

/**
 * Props for the service YAML editor provider.
 */
export type ServiceYamlEditorWidgetProviderProps = {
  filename: string;
};

/**
 * Provider for editing `service.yaml` using the shared base widget behavior.
 */
export function ServiceYamlEditorWidgetProvider({ filename }: ServiceYamlEditorWidgetProviderProps) {
  return <BaseEditorWidget filename={filename} yamlCustomTags={['!env scalar']} />;
}
