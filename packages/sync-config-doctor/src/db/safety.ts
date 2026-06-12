/**
 * Guardrails so a curious dev pointing the probe at the wrong URL can't lock a production table.
 * Two layers: refuse suspected-prod hosts unless explicitly overridden, and run every probe in a
 * read-only transaction with a short statement timeout.
 */

export class UnsafeUrlError extends Error {
  constructor(host: string) {
    super(
      `Refusing to probe "${host}" — it doesn't look like a local/staging/replica host. ` +
        `Probing runs read-only with a short timeout, but to be safe point this at a copy or replica. ` +
        `Pass --i-know-this-is-prod to override.`
    );
    this.name = 'UnsafeUrlError';
  }
}

const SAFE_HOST_HINTS = ['staging', 'replica', 'readonly', 'read-only', 'test', 'local', 'dev', 'sandbox'];

function isPrivateOrLocalHost(host: string): boolean {
  if (host === 'localhost' || host === 'host.docker.internal' || host === '::1') return true;
  if (host.endsWith('.local') || host.endsWith('.internal.test')) return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  // Docker default bridge range 172.17.0.0 – 172.31.255.255
  const m = /^172\.(\d{1,3})\./.exec(host);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return false;
}

export function hostLooksSafe(host: string): boolean {
  const lower = host.toLowerCase();
  if (isPrivateOrLocalHost(lower)) return true;
  return SAFE_HOST_HINTS.some((hint) => lower.includes(hint));
}

function extractHost(url: string): string {
  // mongodb+srv:// and others parse fine with URL once the protocol is stripped to something known,
  // but URL handles the common cases (postgres://, mysql://, mongodb://) directly.
  try {
    return new URL(url).hostname || '';
  } catch {
    // Fall back to a permissive regex for exotic connection strings.
    const m = /:\/\/(?:[^@/]*@)?([^:/?]+)/.exec(url);
    return m?.[1] ?? '';
  }
}

export function assertSafeUrl(url: string, opts: { override?: boolean } = {}): void {
  if (opts.override) return;
  const host = extractHost(url);
  if (!host || !hostLooksSafe(host)) {
    throw new UnsafeUrlError(host || url);
  }
}

export type ProbeMode = 'planner-stats' | 'exact';
