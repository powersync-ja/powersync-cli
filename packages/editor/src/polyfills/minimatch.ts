import { minimatch as m } from 'minimatch';

export const minimatch = m;

// Fixes Vite errors for "no default export" when importing minimatch in the editor package
export default minimatch;
