import { readFile } from 'node:fs/promises';

export type JwtClaims = Record<string, unknown>;

export interface ParsedJwt {
  userId?: string;
  arraySizes: Record<string, number>;
}

export async function loadJwtPayload(input: string): Promise<JwtClaims> {
  const trimmed = input.trim();
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed) as JwtClaims;
  }
  const file = await readFile(input, 'utf8');
  return JSON.parse(file) as JwtClaims;
}

export function parseJwtPayload(claims: JwtClaims): ParsedJwt {
  const userId =
    typeof claims.sub === 'string' ? claims.sub :
    typeof claims.user_id === 'string' ? claims.user_id :
    undefined;

  const arraySizes: Record<string, number> = {};
  for (const [k, v] of Object.entries(claims)) {
    if (Array.isArray(v)) arraySizes[k] = v.length;
  }

  const nested = claims.parameters;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    for (const [k, v] of Object.entries(nested as Record<string, unknown>)) {
      if (Array.isArray(v) && arraySizes[k] == null) arraySizes[k] = v.length;
    }
  }

  return userId ? { userId, arraySizes } : { arraySizes };
}
