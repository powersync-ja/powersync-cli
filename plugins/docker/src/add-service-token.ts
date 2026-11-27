import { type Document, isScalar, isSeq, type Scalar } from 'yaml';

/** Preserve token tags and comments when extending the Service token list. */
export function addServiceToken(service: Document, token: Scalar<string>): boolean {
  const path = ['api', 'tokens'];
  const tokens = service.getIn(path);
  if (tokens == null) {
    service.setIn(path, service.createNode([token]));
    return true;
  }

  if (!isSeq(tokens)) throw new Error('Expected api.tokens in service.yaml to be a list.');
  if (tokens.items.some((item) => isScalar(item) && item.tag === token.tag && item.value === token.value)) return false;
  tokens.add(token);
  return true;
}
