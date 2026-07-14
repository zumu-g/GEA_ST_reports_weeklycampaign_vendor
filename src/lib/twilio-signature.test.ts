import { describe, it, expect, afterEach } from 'vitest';
import { computeTwilioSignature, verifyTwilioSignature, signedUrlForPath } from './twilio-signature';

const origBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
afterEach(() => {
  process.env.NEXT_PUBLIC_BASE_URL = origBaseUrl;
});

describe('twilio-signature', () => {
  const token = 'test-auth-token';
  const url = 'https://portal.grantsea.com.au/api/ingest/whatsapp';
  const params = { Body: 'hello', From: '+61400000000' };

  it('verifies a signature computed with the same inputs', () => {
    const sig = computeTwilioSignature(token, url, params);
    expect(verifyTwilioSignature(token, sig, url, params)).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const sig = computeTwilioSignature(token, url, params);
    expect(verifyTwilioSignature(token, sig.slice(0, -1) + 'X', url, params)).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(verifyTwilioSignature(token, null, url, params)).toBe(false);
  });

  it('rejects when params differ from what was signed', () => {
    const sig = computeTwilioSignature(token, url, params);
    expect(verifyTwilioSignature(token, sig, url, { ...params, Body: 'tampered' })).toBe(false);
  });

  it('signedUrlForPath builds from NEXT_PUBLIC_BASE_URL, not the request host', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://portal.grantsea.com.au';
    // Simulates a mismatched proxy Host header: validation still passes
    // because the signed URL comes from config, never from request.url.
    const configUrl = signedUrlForPath('/api/ingest/whatsapp');
    const sig = computeTwilioSignature(token, configUrl, params);
    expect(verifyTwilioSignature(token, sig, configUrl, params)).toBe(true);
    expect(configUrl).toBe('https://portal.grantsea.com.au/api/ingest/whatsapp');
  });
});
