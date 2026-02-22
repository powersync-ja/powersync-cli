import { YAML_SCHEMAS } from '@/utils/yaml-schemas';
import Editor, { loader, type BeforeMount, type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { configureMonacoYaml } from 'monaco-yaml';
import YamlWorker from 'monaco-yaml/yaml.worker?worker';

loader.config({ monaco });

if (typeof window !== 'undefined') {
  window.MonacoEnvironment = {
    getWorker(_, label) {
      switch (label) {
        case 'editorWorkerService':
          return new EditorWorker();
        case 'yaml':
          return new YamlWorker();
        default:
          console.log(`Unknown Monaco editor worker label: ${label}. Falling back to default editor worker.`);
          throw new Error(`Unknown label ${label}`);
      }
    }
  };
}

const defaultOptions: editor.IStandaloneEditorConstructionOptions = {
  readOnly: false,
  minimap: { enabled: false },
  formatOnType: true,
  formatOnPaste: true,
  quickSuggestions: {
    other: true,
    comments: false,
    strings: true
  }
};

export type MonacoEditorProps = {
  className?: string;
  value: string;
  path?: string;
  language?: string;
  height?: string | number;
  onChange?: (value: string | undefined) => void;
  onValidate?: (markers: editor.IMarker[]) => void;
  options?: editor.IStandaloneEditorConstructionOptions;
  beforeMount?: BeforeMount;
  onMount?: OnMount;
};

export function MonacoEditor({
  className,
  value,
  path,
  language = 'yaml',
  height = '100%',
  onChange,
  onValidate,
  options,
  beforeMount,
  onMount
}: MonacoEditorProps) {
  const handleBeforeMount: BeforeMount = (monacoInstance: Monaco) => {
    const schemas = Object.entries(YAML_SCHEMAS).map(([filename, schema]) => ({
      uri: `inmemory://schemas/${filename}.json`,
      fileMatch: [filename, `**/${filename}`],
      schema
    }));

    configureMonacoYaml(monacoInstance, {
      enableSchemaRequest: true,
      hover: true,
      completion: true,
      validate: true,
      format: true,
      customTags: ['!env scalar'],
      schemas: [...(schemas as any)]
    });

    if (beforeMount) {
      beforeMount(monacoInstance);
    }
  };

  const handleMount: OnMount = (editorInstance, monacoInstance) => {
    if (onMount) {
      onMount(editorInstance, monacoInstance);
    }
  };

  return (
    <Editor
      className={className}
      height={height}
      path={path}
      defaultLanguage={language}
      language={language}
      value={value}
      onChange={onChange}
      onValidate={onValidate}
      theme="vs-dark"
      options={{ ...defaultOptions, ...options }}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
    />
  );
}
