import type { SyncConfigLocation, SyncValidationError } from '@powersync/cli-core';
import type { editor } from 'monaco-editor';

import { useServerFn } from '@tanstack/react-start';
import { useEffect, useRef, useState } from 'react';

import type { UseValidationHook } from './BaseEditorWidget';
import type { ValidationError } from './ValidationError';

import { validateSyncConfig as validateSyncConfigFn } from '../../utils/files/files.functions';

const SYNC_CONFIG_MARKER_OWNER = 'powersync-sync-config-validation';
const VALIDATION_DEBOUNCE_MS = 350;

// Only errors with sync-config line/column metadata can become Monaco markers.
// The full error list still feeds the Validation details panel below.
function hasSyncConfigLocation(
  issue: SyncValidationError
): issue is SyncValidationError & { syncConfigLocation: SyncConfigLocation } {
  return Boolean(issue.syncConfigLocation);
}

/**
 * Validation hook that runs sync-config validation and emits Monaco markers.
 */
export const useSyncConfigValidationMarkers: UseValidationHook = ({ content, editorRef, monacoRef }) => {
  const validateSyncConfig = useServerFn(validateSyncConfigFn);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [markers, setMarkers] = useState<editor.IMarker[]>([]);
  const validationRunIdRef = useRef(0);
  const debounceTimerRef = useRef<null | ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (!content) {
      setValidationErrors([]);
      setMarkers([]);
      const model = editorRef.current?.getModel();
      if (model && monacoRef.current) {
        monacoRef.current.editor.setModelMarkers(model, SYNC_CONFIG_MARKER_OWNER, []);
      }

      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      const currentRunId = ++validationRunIdRef.current;

      try {
        const result = await validateSyncConfig({ data: { content } });
        if (currentRunId !== validationRunIdRef.current) {
          return;
        }

        const nextMarkers: editor.IMarkerData[] = result.errors
          .filter((issue) => hasSyncConfigLocation(issue))
          .map((issue) => ({
            endColumn: issue.syncConfigLocation.end.column,
            endLineNumber: issue.syncConfigLocation.end.line,
            message: issue.message,
            severity: issue.level === 'fatal' ? 8 : 4,
            source: 'powersync validate',
            startColumn: issue.syncConfigLocation.start.column,
            startLineNumber: issue.syncConfigLocation.start.line
          }));
        setValidationErrors(
          result.errors.map((error) => ({
            level: error.level,
            message: error.enrichedMessage,
            ...(error.syncConfigLocation ? { line: error.syncConfigLocation.start.line } : {})
          }))
        );
        setMarkers(nextMarkers as editor.IMarker[]);

        const model = editorRef.current?.getModel();
        if (model && monacoRef.current) {
          monacoRef.current.editor.setModelMarkers(model, SYNC_CONFIG_MARKER_OWNER, nextMarkers);
        }
      } catch (error) {
        if (currentRunId !== validationRunIdRef.current) {
          return;
        }

        const fallbackMarker: editor.IMarkerData = {
          endColumn: 1,
          endLineNumber: 1,
          message: error instanceof Error ? error.message : 'Sync config validation failed.',
          severity: 8,
          source: 'validation',
          startColumn: 1,
          startLineNumber: 1
        };
        const fallbackDetail: ValidationError = {
          level: 'fatal',
          line: 1,
          message: fallbackMarker.message
        };

        const model = editorRef.current?.getModel();
        if (model && monacoRef.current) {
          monacoRef.current.editor.setModelMarkers(model, SYNC_CONFIG_MARKER_OWNER, [fallbackMarker]);
        }

        setValidationErrors([fallbackDetail]);
        setMarkers([fallbackMarker as editor.IMarker]);
      }
    }, VALIDATION_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, editorRef, monacoRef, validateSyncConfig]);

  return {
    markerOwner: SYNC_CONFIG_MARKER_OWNER,
    markers,
    validationErrors
  };
};
