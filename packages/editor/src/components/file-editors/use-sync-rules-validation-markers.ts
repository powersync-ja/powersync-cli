import type { editor } from 'monaco-editor';

import { useServerFn } from '@tanstack/react-start';
import { useEffect, useRef, useState } from 'react';

import type { UseValidationHook } from './BaseEditorWidget';

import { validateSyncRules as validateSyncRulesFn } from '../../utils/files/files.functions';

const SYNC_RULES_MARKER_OWNER = 'powersync-sync-rules-validation';
const VALIDATION_DEBOUNCE_MS = 350;

/**
 * Validation hook that runs sync-rules validation and emits Monaco markers.
 */
export const useSyncRulesValidationMarkers: UseValidationHook = ({ content, editorRef, monacoRef }) => {
  const validateSyncRules = useServerFn(validateSyncRulesFn);
  const [markers, setMarkers] = useState<editor.IMarker[]>([]);
  const validationRunIdRef = useRef(0);
  const debounceTimerRef = useRef<null | ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (!content) {
      setMarkers([]);
      const model = editorRef.current?.getModel();
      if (model && monacoRef.current) {
        monacoRef.current.editor.setModelMarkers(model, SYNC_RULES_MARKER_OWNER, []);
      }

      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      const currentRunId = ++validationRunIdRef.current;

      try {
        const result = await validateSyncRules({ data: { content } });
        if (currentRunId !== validationRunIdRef.current) {
          return;
        }

        const nextMarkers: editor.IMarkerData[] = result.issues.map((issue) => ({
          endColumn: issue.endColumn,
          endLineNumber: issue.endLine,
          message: issue.message,
          severity: issue.level === 'fatal' ? 8 : 4,
          source: 'powersync validate',
          startColumn: issue.startColumn,
          startLineNumber: issue.startLine
        }));

        setMarkers(nextMarkers as editor.IMarker[]);

        const model = editorRef.current?.getModel();
        if (model && monacoRef.current) {
          monacoRef.current.editor.setModelMarkers(model, SYNC_RULES_MARKER_OWNER, nextMarkers);
        }
      } catch (error) {
        if (currentRunId !== validationRunIdRef.current) {
          return;
        }

        const fallbackMarker: editor.IMarkerData = {
          endColumn: 1,
          endLineNumber: 1,
          message: error instanceof Error ? error.message : 'Sync rules validation failed.',
          severity: 8,
          source: 'validation',
          startColumn: 1,
          startLineNumber: 1
        };

        const model = editorRef.current?.getModel();
        if (model && monacoRef.current) {
          monacoRef.current.editor.setModelMarkers(model, SYNC_RULES_MARKER_OWNER, [fallbackMarker]);
        }

        setMarkers([fallbackMarker as editor.IMarker]);
      }
    }, VALIDATION_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, editorRef, monacoRef, validateSyncRules]);

  return {
    markerOwner: SYNC_RULES_MARKER_OWNER,
    markers
  };
};
