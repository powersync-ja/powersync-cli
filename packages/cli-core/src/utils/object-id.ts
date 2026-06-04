export const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export function ensureObjectId(value: string, label: string): void {
  if (!OBJECT_ID_REGEX.test(value)) {
    throw new Error(`Invalid ${label} "${value}". Expected a BSON ObjectID (24 hex characters).`);
  }
}
