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
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="w-80 border-r border-white/5 bg-slate-950/80 px-4 py-6 backdrop-blur">
          <Accordion type="single" collapsible defaultValue="configuration" className="mt-6">
            <AccordionItem value="configuration" className="border-white/10">
              <AccordionTrigger>Configuration files</AccordionTrigger>
              <AccordionContent>
                {isPending ? (
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading configuration list…
                  </div>
                ) : error ? (
                  <div className="space-y-3 rounded-xl border border-rose-500/50 bg-rose-500/10 p-4 text-sm text-rose-50">
                    <p className="flex items-center gap-2 font-semibold">
                      <AlertCircle size={16} /> Unable to load files
                    </p>
                    <p className="text-rose-50/80">{filesError}</p>
                    <button
                      type="button"
                      onClick={() => refetch()}
                      className="inline-flex items-center justify-center rounded-full border border-rose-200/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-50 transition hover:border-rose-100">
                      Try again
                    </button>
                  </div>
                ) : files.length === 0 ? (
                  <p className="text-sm text-white/60">No PowerSync YAML files were detected.</p>
                ) : (
                  <ul className="space-y-2">
                    {files.map((file) => (
                      <li key={file.filename}>
                        <Link
                          to="/files/$filename"
                          params={{ filename: file.filename }}
                          className="flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-sm text-white/80 transition hover:border-cyan-400/60 hover:bg-cyan-400/10"
                          activeProps={{
                            className:
                              'flex items-center gap-3 rounded-xl border border-cyan-400 bg-cyan-400/10 px-4 py-3 text-sm text-white shadow-[0_0_25px_rgba(14,165,233,0.35)]'
                          }}>
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white">
                            <FileText size={18} />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{file.label}</p>
                              {state[file.filename]?.hasChanges ? (
                                <span className="rounded-full bg-amber-500/20 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-amber-100 border border-amber-400/50">
                                  Unsaved
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-white/60">{file.filename}</p>
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
