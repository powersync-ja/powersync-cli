import { describe, it, expect } from 'vitest';
import { assertSafeUrl, hostLooksSafe, UnsafeUrlError } from '../src/db/index.js';

describe('db safety', () => {
  it('accepts localhost and loopback', () => {
    expect(hostLooksSafe('localhost')).toBe(true);
    expect(hostLooksSafe('127.0.0.1')).toBe(true);
    expect(hostLooksSafe('host.docker.internal')).toBe(true);
  });

  it('accepts private / Docker-bridge ranges', () => {
    expect(hostLooksSafe('10.0.0.5')).toBe(true);
    expect(hostLooksSafe('192.168.1.10')).toBe(true);
    expect(hostLooksSafe('172.17.0.2')).toBe(true);
    expect(hostLooksSafe('172.31.255.1')).toBe(true);
    expect(hostLooksSafe('172.15.0.1')).toBe(false);
  });

  it('accepts hosts with staging/replica/test hints', () => {
    expect(hostLooksSafe('db-staging.example.com')).toBe(true);
    expect(hostLooksSafe('read-replica.example.com')).toBe(true);
    expect(hostLooksSafe('app.local')).toBe(true);
  });

  it('refuses bare prod-shaped hosts', () => {
    expect(hostLooksSafe('db.example.com')).toBe(false);
    expect(hostLooksSafe('prod-db.internal')).toBe(false);
  });

  it('assertSafeUrl throws on prod-shaped URL', () => {
    expect(() => assertSafeUrl('postgres://user:pass@db.example.com:5432/app')).toThrow(UnsafeUrlError);
  });

  it('assertSafeUrl passes for localhost URL', () => {
    expect(() => assertSafeUrl('postgres://postgres@localhost:5432/dev')).not.toThrow();
  });

  it('--i-know-this-is-prod override bypasses the check', () => {
    expect(() => assertSafeUrl('postgres://user:pass@db.example.com/app', { override: true })).not.toThrow();
  });

  it('handles mongodb+srv URLs', () => {
    expect(() => assertSafeUrl('mongodb+srv://user:pass@cluster.example.com/db')).toThrow(UnsafeUrlError);
    expect(() => assertSafeUrl('mongodb+srv://user:pass@staging-cluster.example.com/db')).not.toThrow();
  });
});
