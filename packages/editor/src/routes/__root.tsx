import { TanStackDevtools } from '@tanstack/react-devtools';
import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';

import Header from '../components/Header';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import appCss from '../styles.css?url';

const client = new QueryClient();

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8'
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1'
      },
      {
        title: 'TanStack Start Starter'
      }
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss
      }
    ]
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => <NotFoundView />
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <html lang="en">
        <head>
          <HeadContent />
        </head>
        <body>
          <Header />
          {children}
          <TanStackDevtools
            config={{
              position: 'bottom-right'
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />
              }
            ]}
          />
          <Scripts />
        </body>
      </html>
    </QueryClientProvider>
  );
}

function NotFoundView() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 rounded-3xl border border-white/10 bg-slate-950/80 p-10 text-center text-white shadow-[0_20px_120px_rgba(15,118,255,0.25)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
        <span className="text-2xl font-black">404</span>
      </div>
      <div className="space-y-3 max-w-xl">
        <h2 className="text-3xl font-bold">We lost the path you were on</h2>
        <p className="text-white/70">
          This environment only exposes the PowerSync CLI local editor and its server functions. Head back to the
          configuration workspace to keep editing your YAML files.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/files"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:from-cyan-400 hover:to-blue-400">
          Return to CLI Editor
        </Link>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/50">
          Retry Last Request
        </button>
      </div>
    </div>
  );
}
