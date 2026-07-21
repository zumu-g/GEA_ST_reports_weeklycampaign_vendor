import { describe, it, expect, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { ingestAuth } from './agent-auth';

function req(headers: Record<string, string> = {}): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

const origKey = process.env.INGEST_API_KEY;
const origEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.INGEST_API_KEY = origKey;
  // NODE_ENV is typed readonly but assignable at runtime; restore it.
  (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
});

describe('ingestAuth', () => {
  it('accepts the correct x-ingest-key when the key is set', () => {
    process.env.INGEST_API_KEY = 'secret123';
    expect(ingestAuth(req({ 'x-ingest-key': 'secret123' }))).toBe('ok');
  });

  it('accepts a matching Bearer token', () => {
    process.env.INGEST_API_KEY = 'secret123';
    expect(ingestAuth(req({ authorization: 'Bearer secret123' }))).toBe('ok');
  });

  it('rejects a missing or wrong key when the key is set', () => {
    process.env.INGEST_API_KEY = 'secret123';
    expect(ingestAuth(req())).toBe('unauthorised');
    expect(ingestAuth(req({ 'x-ingest-key': 'nope' }))).toBe('unauthorised');
    // wrong length exercises the constant-time length pre-check path
    expect(ingestAuth(req({ 'x-ingest-key': 'x' }))).toBe('unauthorised');
  });

  it('leaves routes open in dev when the key is unset', () => {
    delete process.env.INGEST_API_KEY;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    expect(ingestAuth(req())).toBe('ok');
  });

  it('fails closed in production when the key is unset', () => {
    delete process.env.INGEST_API_KEY;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    expect(ingestAuth(req())).toBe('unconfigured');
  });
});
