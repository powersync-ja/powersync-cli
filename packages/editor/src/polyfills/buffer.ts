// Ensure Buffer exists in the browser build for packages that rely on Node's Buffer API.
if (typeof globalThis !== 'undefined' && globalThis.Buffer === undefined) {
  // Use the browser-friendly buffer polyfill instead of node:buffer which is not bundled for clients.
  const { Buffer: PolyfillBuffer } = await import('node:buffer');
  (globalThis as typeof globalThis & { Buffer: typeof PolyfillBuffer }).Buffer = PolyfillBuffer;
}
