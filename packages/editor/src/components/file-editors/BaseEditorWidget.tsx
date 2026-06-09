import type { RefObject } from 'react';

import { useServerFn } from '@tanstack/react-start';
import { AlertCircle, CheckCircle2, FileCog, Info, Loader2, RotateCcw, Save, ShieldAlert } from 'lucide-react';
import * as Monaco from 'monaco-editor';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SaveFileRequest } from '../../utils/files/files';
import type { ValidationError } from './ValidationError';

import { saveData as saveDataFn } from '../../utils/files/files.functions';
import { useTrackedFiles } from '../hooks/useFiles';
import { MonacoEditor } from '../MonacoEditor';
import { ValidationDetailsPanel } from './ValidationDetailsPanel';

function toSaveFilename(filename: string): null | SaveFileRequest['filename'] {
  if (filename === 'service.yaml' || filename === 'sync-config.yaml') {
    return filename;
  }

  return null;
}

type Status = 'error' | 'idle' | 'saved' | 'saving';

/**
 * Shared context passed to file-specific validation hooks.
 */
export type ValidationHookParams = {
  content: null | string;
  editorRef: RefObject<Monaco.editor.IStandaloneCodeEditor | null>;
  filename: string;
  monacoRef: RefObject<null | typeof Monaco>;
};

/**
 * Normalized validation output returned by a file-specific validation hook.
 */
export type ValidationHookResult = {
  markerOwner: string;
  markers: Monaco.editor.IMarker[];
  validationErrors: ValidationError[];
};

/**
 * Contract for validation hooks that can be injected into the base widget.
 */
export type UseValidationHook = (params: ValidationHookParams) => ValidationHookResult;

/**
 * Props accepted by the shared editor widget.
 */
export type BaseEditorWidgetProps = {
  filename: string;
  useValidationHook?: UseValidationHook;
  yamlCustomTags?: string[];
};

const useEmptyValidationHook: UseValidationHook = () => ({
  markerOwner: '',
  markers: [],
  validationErrors: []
});

function getStatusBadge(status: Status, hasChanges: boolean) {
  if (status === 'saving')
    return {
      icon: <Loader2 className="animate-spin text-cyan-200" size={16} />,
      label: 'Saving…',
      tone: 'text-cyan-200 bg-cyan-500/10 border-cyan-300/40'
    };
  if (status === 'saved')
    return {
      icon: <CheckCircle2 className="text-emerald-300" size={16} />,
      label: 'All changes synced',
      tone: 'text-emerald-200 bg-emerald-500/10 border-emerald-300/40'
    };
  if (status === 'error')
    return {
      icon: <AlertCircle className="text-rose-300" size={16} />,
      label: 'Save failed',
      tone: 'text-rose-200 bg-rose-500/10 border-rose-300/40'
    };
  if (hasChanges)
    return {
      icon: <FileCog className="text-amber-200" size={16} />,
      label: 'Unsaved changes',
      tone: 'text-amber-100 bg-amber-500/15 border-amber-300/50'
    };
  return {
    icon: <FileCog className="text-white/70" size={16} />,
    label: 'No pending changes',
    tone: 'text-white/70 bg-white/5 border-white/10'
  };
}

function getValidationBadge(validationSummary: { errors: number; warnings: number }) {
  if (validationSummary.errors > 0 || validationSummary.warnings > 0) {
    return {
      icon: <Info className="text-rose-100" size={16} />,
      label: `${validationSummary.errors} errors • ${validationSummary.warnings} warnings`,
      tone: 'text-rose-100 bg-rose-500/15 border-rose-300/50'
    };
  }

  return {
    icon: <CheckCircle2 className="text-emerald-200" size={16} />,
    label: 'No validation issues',
    tone: 'text-emerald-100 bg-emerald-500/10 border-emerald-300/40'
  };
}

function toSchemaValidationError(marker: Monaco.editor.IMarker): ValidationError {
  return {
    level: marker.severity === Monaco.MarkerSeverity.Error ? 'fatal' : 'warning',
    line: marker.startLineNumber,
    message: marker.message
  };
}

/**
 * Shared editor shell used by all file-specific editor providers.
 */
export function BaseEditorWidget({
  filename,
  useValidationHook = useEmptyValidationHook,
  yamlCustomTags
}: BaseEditorWidgetProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<null | string>(null);
  const [showValidation, setShowValidation] = useState(false);
  const { state: trackedFilesState, updateLocalState: updateTrackedFilesState, upstream } = useTrackedFiles();
  const { error, isPending, isRefetching, refetch } = upstream;
  const saveData = useServerFn(saveDataFn);
  const file = useMemo(() => trackedFilesState[filename], [trackedFilesState, filename]);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<null | typeof Monaco>(null);
  const [schemaValidationErrors, setSchemaValidationErrors] = useState<ValidationError[]>([]);
  const validation = useValidationHook({
    content: file?.content ?? null,
    editorRef,
    filename,
    monacoRef
  });

  const { markerOwner, validationErrors: customValidationErrors } = validation;
  const validationErrors = useMemo(
    () => [...schemaValidationErrors, ...customValidationErrors],
    [customValidationErrors, schemaValidationErrors]
  );

  const validationSummary = useMemo(() => {
    const errors = validationErrors.filter((detail) => detail.level === 'fatal').length;
    const warnings = validationErrors.filter((detail) => detail.level === 'warning').length;
    return { errors, warnings };
  }, [validationErrors]);

  const hasChanges = trackedFilesState[filename]?.hasChanges ?? false;
  const hasValidationIssues = validationSummary.errors > 0 || validationSummary.warnings > 0;

  // Disable edits while saving or refetching so the post-save refetch cannot overwrite
  // in-flight keystrokes; useTrackedFiles preserves local content when merging upstream
  // but disabling the editor during this window avoids confusion.
  const isSaveOrRefetchInProgress = status === 'saving' || isRefetching;

  const handleEditorValidate = useCallback(
    (markers: Monaco.editor.IMarker[]) => {
      const schemaMarkers = markerOwner
        ? markers.filter((marker) => {
            const { owner } = marker as Monaco.editor.IMarker & { owner?: string };
            return owner !== markerOwner;
          })
        : markers;

      setSchemaValidationErrors(schemaMarkers.map((marker) => toSchemaValidationError(marker)));
    },
    [markerOwner]
  );

  useEffect(() => {
    if (validationSummary.errors === 0 && validationSummary.warnings === 0) {
      setShowValidation(false);
    }
  }, [validationSummary.errors, validationSummary.warnings]);

  const handleSave = useCallback(async () => {
    if (!file) return;

    const saveFilename = toSaveFilename(filename);
    if (!saveFilename) {
      setStatus('error');
      setErrorMessage(`Unsupported file for save: ${filename}`);
      return;
    }

    setStatus('saving');
    setErrorMessage(null);
    try {
      await saveData({ data: { content: file.content, filename: saveFilename } });
      await refetch();
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2200);
    } catch (error_) {
      console.error(error_);
      setStatus('error');
      setErrorMessage(error_ instanceof Error ? error_.message : 'Unable to save the file. Please try again.');
    }
  }, [file, saveData, refetch, filename]);

  const handleReset = useCallback(() => {
    if (!file) return;
    updateTrackedFilesState(filename, file.upstreamContent);
    setStatus('idle');
    setErrorMessage(null);
  }, [file, filename, updateTrackedFilesState]);

  if (isPending) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center text-white/70">
        <Loader2 className="animate-spin text-cyan-300" size={42} />
        <div>
          <p className="text-lg font-semibold text-white">Loading configuration files…</p>
          <p className="text-sm text-white/60">We are fetching the contents of your PowerSync directory.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center text-white/70">
        <AlertCircle className="text-rose-300" size={48} />
        <div className="space-y-2">
          <p className="text-lg font-semibold text-white">Unable to load configuration files</p>
          <p className="text-sm text-white/60">
            {error instanceof Error ? error.message : 'Unexpected error occurred.'}
          </p>
        </div>
        <button
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-xs transition hover:bg-accent hover:text-accent-foreground"
          onClick={() => refetch()}
          type="button">
          Try again
        </button>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center text-white/70">
        <ShieldAlert className="text-amber-400" size={48} />
        <div>
          <p className="text-lg font-semibold text-white">File not found</p>
          <p className="text-sm text-white/60">Return to the navigation column and pick another configuration file.</p>
        </div>
      </div>
    );
  }

  const statusBadge = getStatusBadge(status, hasChanges);

  const validationBadge = getValidationBadge(validationSummary);

  return (
    <div className="flex h-full w-full flex-1 flex-col gap-6 bg-background px-10 py-8 text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">Editing</p>
          <h2 className="text-2xl font-semibold text-foreground">{filename}</h2>
          <p className="text-sm text-muted-foreground">PowerSync CLI YAML configuration</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className={`inline-flex h-8 items-center justify-center gap-2 rounded-md border px-3 py-1 text-xs font-medium transition ${validationBadge.tone} ${
              hasValidationIssues ? 'hover:border-destructive/50 hover:bg-destructive/5' : ''
            } ${hasValidationIssues ? '' : 'cursor-not-allowed opacity-60'}`}
            disabled={!hasValidationIssues}
            onClick={() => setShowValidation((open) => !open)}
            type="button">
            {validationBadge.icon}
            {validationBadge.label}
          </button>
          <span
            className={`inline-flex h-8 items-center justify-center gap-2 rounded-md border px-3 py-1 text-xs font-medium ${statusBadge.tone}`}>
            {statusBadge.icon}
            {statusBadge.label}
          </span>
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-xs transition hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasChanges || status === 'saving'}
            onClick={handleReset}
            type="button">
            <RotateCcw size={16} /> Reset
          </button>
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!hasChanges || status === 'saving'}
            onClick={handleSave}
            type="button">
            {status === 'saving' ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save changes
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-foreground">
          {errorMessage}
        </div>
      )}

      {showValidation && validationErrors.length > 0 && (
        <ValidationDetailsPanel details={validationErrors} onHide={() => setShowValidation(false)} />
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-[0_16px_72px_rgba(0,0,0,0.08)]">
        <MonacoEditor
          className="flex-1"
          customTags={yamlCustomTags}
          language="yaml"
          onChange={(newValue = '') => {
            updateTrackedFilesState(filename, newValue);
          }}
          onMount={(editorInstance, monacoInstance) => {
            editorRef.current = editorInstance;
            monacoRef.current = monacoInstance;
          }}
          onValidate={handleEditorValidate}
          options={{ readOnly: isSaveOrRefetchInProgress }}
          path={filename}
          value={file.content}
        />
      </div>
    </div>
  );
}
