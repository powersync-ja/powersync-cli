import cors from '@fastify/cors';
import { env } from '@powersync/cli-core';
import Fastify from 'fastify';
import { createDecipheriv, createPrivateKey, createPublicKey, generateKeyPairSync, privateDecrypt } from 'node:crypto';
import open from 'open';

/** Hybrid encryption format from dashboard: [encrypted_cek (256)] [iv (12)] [ciphertext] [tag (16)]. */
const RSA_ENCRYPTED_KEY_BYTES = 256;
const IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

/** Decode base64 or base64url (URL-safe) to bytes. Accepts standard base64 or base64url from query params. */
function decodeBase64Payload(payload: string): Buffer {
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad === 0 ? base64 : base64 + '='.repeat(4 - pad);
  return Buffer.from(padded, 'base64');
}

/**
 * Decrypt a token encrypted by the dashboard with the hybrid scheme (RSA-OAEP-wrapped CEK + AES-256-GCM).
 * Payload is base64 or base64url: decoded = encrypted_cek (256 bytes) || iv (12) || ciphertext || auth_tag (16).
 * Uses Node crypto for RSA-OAEP and AES-GCM decryption.
 */
function decryptTokenFromDashboard(base64Payload: string, privateKeyPem: string): string {
  const raw = decodeBase64Payload(base64Payload.trim());
  if (raw.length < RSA_ENCRYPTED_KEY_BYTES + IV_BYTES + GCM_TAG_BYTES) {
    throw new Error('Payload too short');
  }
  const encryptedCek = raw.subarray(0, RSA_ENCRYPTED_KEY_BYTES);
  const iv = raw.subarray(RSA_ENCRYPTED_KEY_BYTES, RSA_ENCRYPTED_KEY_BYTES + IV_BYTES);
  const ciphertextWithTag = raw.subarray(RSA_ENCRYPTED_KEY_BYTES + IV_BYTES);
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - GCM_TAG_BYTES);
  const tag = ciphertextWithTag.subarray(-GCM_TAG_BYTES);

  const keyObject = createPrivateKey({ key: privateKeyPem, format: 'pem' });
  const cek = privateDecrypt({ key: keyObject, oaepHash: 'sha256' }, encryptedCek);

  const decipher = createDecipheriv('aes-256-gcm', cek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
}

/**
 * Server login handshake (asymmetric encryption)
 *
 * Flow:
 * 1. CLI starts a local HTTP server and generates an ephemeral RSA keypair.
 * 2. CLI opens the dashboard with a base64-encoded `request` param containing
 *    { redirect_url, public_key }. The dashboard learns where to send the token
 *    and how to encrypt it.
 * 3. User creates a token in the dashboard. The dashboard encrypts the token
 *    with the CLI's public key and redirects the browser to redirect_url with
 *    the encrypted token in the query string (GET), so the secret never appears in history.
 * 4. CLI receives GET /response?token=<base64> (see decryptTokenFromDashboard), decrypts it,
 *    and stores the plaintext token.
 *
 * Why encryption:
 * In some cases the dashboard needs to hand the token back via a URL (e.g.
 * redirect or opening the CLI callback URL in the browser). If we sent the
 * token in the query string or fragment, it would appear in browser history,
 * logs, and referrers. Encrypting with the CLI's public key ensures only this
 * CLI instance can decrypt the token; the value that might appear in a URL or
 * in transit is ciphertext, not the secret.
 */
export async function startPATLoginServer(): Promise<{
  address: string;
  tokenPromise: Promise<string>;
}> {
  const { publicKey: publicKeyPem, privateKey: privateKeyPem } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const publicKeyJwk = createPublicKey(publicKeyPem).export({ format: 'jwk' }) as JsonWebKey;

  let settled = false;
  let resolveToken!: (value: string) => void;
  let rejectToken!: (err: Error) => void;
  const tokenPromise = new Promise<string>((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });

  const app = Fastify({ logger: false });
  const allowOrigin = env._PS_DASHBOARD_URL.replace(/\/$/, '');
  await app.register(cors, { origin: allowOrigin });

  app.get<{ Querystring: { token?: string } }>('/response', async (request, reply) => {
    const rawToken = typeof request.query?.token === 'string' ? request.query.token.trim() : null;
    if (!rawToken) {
      await reply.status(400).send({ error: 'Missing or empty "token" query parameter' });
      if (!settled) {
        settled = true;
        rejectToken(new Error('Invalid request: GET /response must include a non-empty "token" query parameter'));
      }
      return;
    }
    let tokenValue: string;
    try {
      tokenValue = decryptTokenFromDashboard(rawToken, privateKeyPem);
    } catch {
      await reply.status(400).send({ error: 'Failed to decrypt token from dashboard' });
      if (!settled) {
        settled = true;
        rejectToken(new Error('Failed to decrypt token from dashboard'));
      }
      return;
    }
    if (settled) return;
    settled = true;
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Token accepted</title></head>
<body>
  <p>Token was accepted.</p>
  <p>Check the CLI output for further results.</p>
</body>
</html>`;
    await reply.type('text/html').status(200).send(html);
    resolveToken(tokenValue);
    await app.close();
  });

  app.setErrorHandler((err, _request, reply) => {
    if (!settled) {
      settled = true;
      rejectToken(err instanceof Error ? err : new Error(String(err)));
    }
    void reply.status(500).send({ error: 'Internal server error' });
  });

  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  const responseUrl = `${address}/response`;
  const requestPayload: { redirect_url: string; public_key: JsonWebKey } = {
    redirect_url: responseUrl,
    public_key: publicKeyJwk
  };
  const requestBase64 = Buffer.from(JSON.stringify(requestPayload), 'utf-8').toString('base64');

  open(`${env._PS_DASHBOARD_URL}/account/access-tokens/create?cliRequest=${encodeURIComponent(requestBase64)}`);

  return { address, tokenPromise };
}
