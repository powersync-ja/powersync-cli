import { MonacoEditor } from '@/components/MonacoEditor';
import { createFileRoute } from '@tanstack/react-router';
import { AlertCircle, CheckCircle2, FileCog, Info, Loader2, RotateCcw, Save, ShieldAlert } from 'lucide-react';
import type { editor } from 'monaco-editor';
import { useCallback, useMemo, useState } from 'react';

import { useTrackedFiles } from '@/components/hooks/useFiles';
import { saveData as saveDatafn } from '@/utils/files/files.functions';
import { useServerFn } from '@tanstack/react-start';

// Monaco severities: 8 = Error, 4 = Warning; we intentionally treat warnings as errors for stricter validation.
const ERROR_SEVERITIES = new Set([8, 4]);

export const Route = createFileRoute('/files/$filename')({
  component: FileEditor,
  ssr: false
});

type Status = 'idle' | 'saving' | 'saved' | 'error';

function FileEditor() {
  const { filename } = Route.useParams();

  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validation, setValidation] = useState({ errors: 0, warnings: 0 });
  const [validationMarkers, setValidationMarkers] = useState<editor.IMarker[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const isBrowser = typeof window !== 'undefined';
  const { state: trackedFilesState, updateLocalState: updateTrackedFilesState, upstream } = useTrackedFiles();
  const { isPending, error, refetch } = upstream;
  const saveData = useServerFn(saveDatafn);
  const file = useMemo(() => trackedFilesState[filename], [trackedFilesState, filename]);

  const hasChanges = trackedFilesState[filename]?.hasChanges ?? false;

  const handleSave = useCallback(async () => {
    if (!file) return;

    setStatus('saving');
    setErrorMessage(null);
    try {
      await saveData({ data: { filename: filename as any, content: file.content } });
      await refetch();
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2200);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unable to save the file. Please try again.');
    }
  }, [file, saveData, refetch]);

  const handleReset = useCallback(() => {
    if (!file) return;
    updateTrackedFilesState(filename, file.upstreamContent);
    setStatus('idle');
    setErrorMessage(null);
  }, [file, filename, updateTrackedFilesState]); // changeState.original, changeState.current]);

  if (isPending) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center text-white/70">
        <Loader2 size={42} className="animate-spin text-cyan-300" />
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
        <AlertCircle size={48} className="text-rose-300" />
        <div className="space-y-2">
          <p className="text-lg font-semibold text-white">Unable to load configuration files</p>
          <p className="text-sm text-white/60">
            {error instanceof Error ? error.message : 'Unexpected error occurred.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/50">
          Try again
        </button>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center text-white/70">
        <ShieldAlert size={48} className="text-amber-400" />
        <div>
          <p className="text-lg font-semibold text-white">File not found</p>
          <p className="text-sm text-white/60">Return to the navigation column and pick another configuration file.</p>
        </div>
      </div>
    );
  }

  const statusBadge = (() => {
    if (status === 'saving')
      return {
        label: 'Saving…',
        tone: 'text-cyan-200 bg-cyan-500/10 border-cyan-300/40',
        icon: <Loader2 size={16} className="animate-spin text-cyan-200" />
      };
    if (status === 'saved')
      return {
        label: 'All changes synced',
        tone: 'text-emerald-200 bg-emerald-500/10 border-emerald-300/40',
        icon: <CheckCircle2 size={16} className="text-emerald-300" />
      };
    if (status === 'error')
      return {
        label: 'Save failed',
        tone: 'text-rose-200 bg-rose-500/10 border-rose-300/40',
        icon: <AlertCircle size={16} className="text-rose-300" />
      };
    if (hasChanges)
      return {
        label: 'Unsaved changes',
        tone: 'text-amber-100 bg-amber-500/15 border-amber-300/50',
        icon: <FileCog size={16} className="text-amber-200" />
      };
    return {
      label: 'No pending changes',
      tone: 'text-white/70 bg-white/5 border-white/10',
      icon: <FileCog size={16} className="text-white/70" />
    };
  })();

  const validationBadge =
    validation.errors > 0 || validation.warnings > 0
      ? {
          label: `${validation.errors} errors • ${validation.warnings} warnings`,
          tone: 'text-rose-100 bg-rose-500/15 border-rose-300/50',
          icon: <Info size={16} className="text-rose-100" />
        }
      : {
          label: 'No validation issues',
          tone: 'text-emerald-100 bg-emerald-500/10 border-emerald-300/40',
          icon: <CheckCircle2 size={16} className="text-emerald-200" />
        };

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
            type="button"
            disabled={validation.errors === 0 && validation.warnings === 0}
            onClick={() => setShowValidation((open) => !open)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${validationBadge.tone} ${
              validation.errors > 0 || validation.warnings > 0
                ? 'hover:border-destructive/50 hover:bg-destructive/5'
                : ''
            } ${validation.errors === 0 && validation.warnings === 0 ? 'cursor-not-allowed opacity-60' : ''}`}>
            {validationBadge.icon}
            {validationBadge.label}
          </button>
          <span
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge.tone}`}>
            {statusBadge.icon}
            {statusBadge.label}
          </span>
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasChanges || status === 'saving'}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50">
            <RotateCcw size={16} /> Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || status === 'saving'}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
            {status === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save changes
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-foreground">
          {errorMessage}
        </div>
      )}

      {showValidation && validationMarkers.length > 0 && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-foreground">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-destructive-foreground">
              <Info size={16} className="text-destructive" /> Validation details
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground"
              onClick={() => setShowValidation(false)}>
              Hide
            </button>
          </div>
          <ul className="space-y-2">
            {validationMarkers.map((marker, idx) => {
              const isError = ERROR_SEVERITIES.has(marker.severity);
              const tone = isError
                ? 'text-destructive-foreground bg-destructive/15 border-destructive/40'
                : 'text-warning-foreground bg-warning/15 border-warning/40';
              const label = isError ? 'Error' : 'Info';
              return (
                <li key={`${marker.message}-${marker.startLineNumber}-${idx}`} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
                    {label}
                  </span>
                  <div className="flex-1 leading-relaxed text-foreground">
                    <div className="font-semibold text-foreground">Line {marker.startLineNumber}</div>
                    <div className="text-muted-foreground">{marker.message}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden rounded-3xl border border-border bg-card shadow-[0_16px_72px_rgba(0,0,0,0.08)]">
        {isBrowser ? (
          <MonacoEditor
            className="flex-1"
            value={file.content}
            path={filename}
            language="yaml"
            onChange={(newValue) => {
              const next = newValue ?? '';
              updateTrackedFilesState(filename, next);
            }}
            onValidate={(markers) => {
              const errors = markers.filter((m) => ERROR_SEVERITIES.has(m.severity)).length;
              const warnings = markers.filter((m) => !ERROR_SEVERITIES.has(m.severity)).length;
              setValidation({ errors, warnings });
              setValidationMarkers(markers);
              if (errors === 0 && warnings === 0) {
                setShowValidation(false);
              }
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/70">Preparing editor...</div>
        )}
      </div>
    </div>
  );
}
