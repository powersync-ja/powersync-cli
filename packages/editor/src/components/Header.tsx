import { Link } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full items-center justify-between gap-4 px-8 py-4 text-white">
        <Link className="flex items-center gap-3" to="/files">
          <img
            alt="PowerSync Logo"
            className="flex h-10 w-10 items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-600 text-lg font-black tracking-tight text-white"
            src="/logo.png"
          />
          <div className="flex flex-col items-start">
            <p className="text-xs font-semibold uppercase tracking-[0.55em] text-white/60">PowerSync</p>
            <p className="text-xl font-semibold leading-tight">CLI Studio</p>
          </div>
        </Link>

        <a
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-cyan-400 hover:text-white"
          href="https://docs.powersync.com/"
          rel="noreferrer"
          target="_blank">
          Documentation <ExternalLink size={14} />
        </a>
      </div>
    </header>
  );
}
