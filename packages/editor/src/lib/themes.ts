import type * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export const POWERSYNC_MONACO_THEME = 'powersync-dark';

export function registerMonacoTheme(instance: typeof monaco) {
  const themeName = POWERSYNC_MONACO_THEME;

  // Skip if already registered.
  const existing = (instance.editor as { _themes?: Record<string, unknown> })?._themes?.[themeName];
  if (existing) return themeName;

  instance.editor.defineTheme(themeName, {
    base: 'vs-dark',
    colors: {
      'editor.background': '#0f172a',
      'editor.lineHighlightBackground': '#0b1224',
      'editor.selectionBackground': '#1e293b',
      'editor.selectionHighlightBackground': '#1e293b55',
      'editorCursor.foreground': '#38bdf8',
      'editorGutter.background': '#0f172a',
      'editorHoverWidget.background': '#0f172a',
      'editorHoverWidget.border': '#1e293b',
      'editorIndentGuide.background': '#1e293b',
      'editorLineNumber.foreground': '#475569',
      'editorSuggestWidget.background': '#0f172a',
      'editorSuggestWidget.border': '#1e293b',
      'editorWhitespace.foreground': '#334155'
    },
    inherit: true,
    rules: [{ background: '0f172a', token: '' }]
  });

  return themeName;
}
