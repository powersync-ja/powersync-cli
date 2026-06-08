import { Info } from 'lucide-react';

import type { ValidationError } from './ValidationError';

/**
 * Renders a validation message while preserving optional source context and caret lines.
 */
function ValidationMarkerMessage({ message }: { message: string }) {
  const [summary, ...details] = message.split('\n');

  if (details.length === 0) {
    return <div className="whitespace-pre-wrap break-words text-muted-foreground">{message}</div>;
  }

  return (
    <div className="space-y-1">
      <div className="whitespace-pre-wrap break-words text-muted-foreground">{summary}</div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-background/60 px-3 py-2 font-mono text-xs leading-5 text-foreground">
        {details.join('\n')}
      </pre>
    </div>
  );
}

/**
 * Shows validation errors and warnings in the collapsible details block above the editor.
 */
export function ValidationDetailsPanel({ details, onHide }: { details: ValidationError[]; onHide: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-foreground">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-destructive-foreground">
          <Info className="text-destructive" size={16} /> Validation details
        </div>
        <button
          className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground"
          onClick={onHide}
          type="button">
          Hide
        </button>
      </div>
      <ul className="space-y-2">
        {details.map((detail, idx) => {
          const isError = detail.level === 'fatal';
          const tone = isError
            ? 'text-destructive-foreground bg-destructive/15 border-destructive/40'
            : 'text-warning-foreground bg-warning/15 border-warning/40';
          const label = isError ? 'Error' : 'Warning';
          return (
            <li className="flex items-start gap-3" key={`${detail.message}-${detail.line ?? 'global'}-${idx}`}>
              <span
                className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
                {label}
              </span>
              <div className="flex-1 leading-relaxed text-foreground">
                {detail.line && <div className="font-semibold text-foreground">Line {detail.line}</div>}
                <ValidationMarkerMessage message={detail.message} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
