// Ensure Buffer exists in the browser build for packages that rely on Node's Buffer API.
if (typeof globalThis !== 'undefined' && globalThis.Buffer === undefined) {
  // Dynamically import to avoid SSR eval of the CJS bundle.
  const { Buffer: NodeBuffer } = await import('node:buffer');
  (globalThis as typeof globalThis & { Buffer: typeof NodeBuffer }).Buffer = NodeBuffer;
}
