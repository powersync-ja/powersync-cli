import type * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export const POWERSYNC_MONACO_THEME = 'powersync-dark';

export function registerMonacoTheme(instance: typeof monaco) {
  const themeName = POWERSYNC_MONACO_THEME;

  // Skip if already registered.
  const existing = (instance.editor as any)?._themes?.[themeName];
  if (existing) return themeName;

  instance.editor.defineTheme(themeName, {
    base: 'vs-dark',
    inherit: true,
    rules: [{ token: '', background: '0f172a' }],
    colors: {
      'editor.background': '#0f172a',
      'editorGutter.background': '#0f172a',
      'editor.lineHighlightBackground': '#0b1224',
      'editor.selectionBackground': '#1e293b',
      'editor.selectionHighlightBackground': '#1e293b55',
      'editorIndentGuide.background': '#1e293b',
      'editorLineNumber.foreground': '#475569',
      'editorCursor.foreground': '#38bdf8',
      'editorWhitespace.foreground': '#334155',
      'editorSuggestWidget.background': '#0f172a',
      'editorSuggestWidget.border': '#1e293b',
      'editorHoverWidget.background': '#0f172a',
      'editorHoverWidget.border': '#1e293b'
    }
  });

  return themeName;
}
