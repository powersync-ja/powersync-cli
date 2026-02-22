import { Link, Outlet, createFileRoute } from '@tanstack/react-router';
import { AlertCircle, FileText, Loader2 } from 'lucide-react';

import { useTrackedFiles } from '@/components/hooks/useFiles';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export const Route = createFileRoute('/files')({
  component: FilesLayout
});

function FilesLayout() {
  const { state, upstream } = useTrackedFiles();
  const { isPending, error, refetch } = upstream;
  const files = Object.values(state);
  const filesError = error instanceof Error ? error.message : 'Unexpected error while loading files.';

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="w-80 border-r border-border bg-card/60 px-4 py-6 backdrop-blur">
          <Accordion type="single" collapsible defaultValue="configuration" className="mt-6">
            <AccordionItem value="configuration" className="border-border/60">
              <AccordionTrigger>Configuration files</AccordionTrigger>
              <AccordionContent>
                {isPending ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-6 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Loading configuration list…
                  </div>
                ) : error ? (
                  <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-foreground">
                    <p className="flex items-center gap-2 font-semibold text-destructive-foreground">
                      <AlertCircle size={16} /> Unable to load files
                    </p>
                    <p className="text-destructive-foreground/80">{filesError}</p>
                    <button
                      type="button"
                      onClick={() => refetch()}
                      className="inline-flex items-center justify-center rounded-full border border-destructive/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-destructive-foreground transition hover:border-destructive/60">
                      Try again
                    </button>
                  </div>
                ) : files.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No PowerSync YAML files were detected.</p>
                ) : (
                  <ul className="space-y-2">
                    {files.map((file) => (
                      <li key={file.filename}>
                        <Link
                          to="/files/$filename"
                          params={{ filename: file.filename }}
                          className="flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-sm text-foreground transition hover:border-primary/50 hover:bg-primary/5"
                          activeProps={{
                            className:
                              'flex items-center gap-3 rounded-xl border border-primary bg-primary/10 px-4 py-3 text-sm text-foreground shadow-[0_0_25px_rgba(14,165,233,0.25)]'
                          }}>
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FileText size={18} />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{file.label}</p>
                              {state[file.filename]?.hasChanges ? (
                                <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-warning-foreground">
                                  Unsaved
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">{file.filename}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>
        <main className="flex flex-1 overflow-hidden">
          <div className="flex h-full w-full flex-col overflow-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
