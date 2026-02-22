// Ensure Buffer exists in the browser build for packages that rely on Node's Buffer API.
if (typeof window !== 'undefined' && typeof globalThis.Buffer === 'undefined') {
  // Dynamically import to avoid SSR eval of the CJS bundle.
  import('buffer').then(({ Buffer: NodeBuffer }) => {
    (globalThis as typeof globalThis & { Buffer: typeof NodeBuffer }).Buffer = NodeBuffer;
  });
}
