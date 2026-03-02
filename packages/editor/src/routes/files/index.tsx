import { createFileRoute } from '@tanstack/react-router';
import { AlertCircle, Loader2, Wand2 } from 'lucide-react';

import { useFiles } from '@/components/hooks/useFiles';

export const Route = createFileRoute('/files/')({
  component: FilesIndex
});

function FilesIndex() {
  const { data, error, isPending, refetch } = useFiles();
  const files = data?.files ?? [];
  const readyFooter = `${files.length} file${files.length === 1 ? '' : 's'} detected from your local PowerSync directory.`;
  const descriptionBase =
    'Pick any entry from the Configuration column on the left to open it inside the Monaco-powered editor. The YAML plugin will highlight issues, surface schema hints, and keep your PowerSync CLI templates on track.';
  const viewState = isPending
    ? {
        description: 'Hang tight while we read your PowerSync directory.',
        footer: 'Loading files from your local environment.',
        title: 'Fetching configuration files…'
      }
    : error
      ? {
          description: error instanceof Error ? error.message : 'Unexpected error while reading your directory.',
          footer: null,
          title: 'Unable to load configuration files'
        }
      : {
          description: descriptionBase,
          footer: readyFooter,
          title: 'Choose a configuration file'
        };
  const icon = isPending ? (
    <Loader2 className="h-8 w-8 animate-spin" />
  ) : error ? (
    <AlertCircle className="h-8 w-8" />
  ) : (
    <Wand2 size={32} />
  );

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center text-white/80">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
          isPending
            ? 'bg-cyan-500/10 text-cyan-200'
            : error
              ? 'bg-rose-500/10 text-rose-200'
              : 'bg-cyan-500/20 text-cyan-300'
        }`}>
        {icon}
      </div>
      <div className="space-y-3 max-w-lg">
        <h2 className="text-2xl font-semibold text-white">{viewState.title}</h2>
        <p>{viewState.description}</p>
        {error ? (
          <button
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/50"
            onClick={() => refetch()}
            type="button">
            Try again
          </button>
        ) : (
          <p className="text-sm text-white/60">{viewState.footer}</p>
        )}
      </div>
    </div>
  );
}
