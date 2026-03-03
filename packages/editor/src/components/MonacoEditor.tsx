import type { editor } from 'monaco-editor';

import MonacoReactEditor, { type BeforeMount, loader, type Monaco, type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
// eslint-disable-next-line import/default
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { configureMonacoYaml, SchemasSettings } from 'monaco-yaml';
// eslint-disable-next-line import/default
import YamlWorker from 'monaco-yaml/yaml.worker?worker';
import { useRef } from 'react';

import { YAML_SCHEMAS } from '../utils/yaml-schemas';

loader.config({ monaco });

if (typeof globalThis !== 'undefined') {
  globalThis.MonacoEnvironment = {
    getWorker(_, label) {
      switch (label) {
        case 'yaml': {
          return new YamlWorker();
        }

        default: {
          return new EditorWorker();
        }
      }
    }
  };
}

const DEFAULT_MONACO_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  formatOnPaste: true,
  formatOnType: true,
  minimap: { enabled: false },
  quickSuggestions: {
    comments: false,
    other: false,
    strings: false
  },
  readOnly: false
};

export type MonacoEditorProps = {
  beforeMount?: BeforeMount;
  className?: string;
  customTags?: string[];
  height?: number | string;
  language?: string;
  onChange?: (value: string | undefined) => void;
  onMount?: OnMount;
  onValidate?: (markers: editor.IMarker[]) => void;
  options?: editor.IStandaloneEditorConstructionOptions;
  path?: string;
  value: string;
};

export function MonacoEditor({
  beforeMount,
  className,
  customTags,
  height = '100%',
  language = 'yaml',
  onChange,
  onMount,
  onValidate,
  options,
  path,
  value
}: MonacoEditorProps) {
  const configuredMonacoRef = useRef<Monaco | null>(null);

  const handleBeforeMount: BeforeMount = (monacoInstance: Monaco) => {
    const shouldConfigureYaml = configuredMonacoRef.current !== monacoInstance;

    if (shouldConfigureYaml) {
      const schemas = Object.entries(YAML_SCHEMAS).map(([filename, schema]) => ({
        fileMatch: [filename],
        schema,
        uri: `inmemory://schemas/${filename}.json`
      })) as SchemasSettings[];

      configureMonacoYaml(monacoInstance, {
        completion: true,
        customTags: customTags ?? [],
        enableSchemaRequest: true,
        format: true,
        hover: true,
        schemas,
        validate: true
      });
      configuredMonacoRef.current = monacoInstance;
    }

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
    <MonacoReactEditor
      beforeMount={handleBeforeMount}
      className={className}
      defaultLanguage={language}
      height={height}
      language={language}
      onChange={onChange}
      onMount={handleMount}
      onValidate={onValidate}
      options={{ ...DEFAULT_MONACO_OPTIONS, ...options }}
      path={path}
      theme="vs-dark"
      value={value}
    />
  );
}
