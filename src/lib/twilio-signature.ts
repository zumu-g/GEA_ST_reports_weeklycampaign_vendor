import crypto from 'crypto';

/**
 * Validates Twilio's X-Twilio-Signature header (HMAC-SHA1 of the request URL
 * + sorted form-param key/value pairs, base64-encoded), without the `twilio`
 * SDK — a hand-rolled check is a few lines and the repo already avoids
 * adding dependencies for this shape of work.
 *
 * The signed URL is built from NEXT_PUBLIC_BASE_URL + the route path, never
 * from the incoming request's own URL — behind Railway's proxy the request's
 * reconstructed host/proto can differ from the public URL Twilio actually
 * signed, so validating against request.url would pass in local dev and
 * silently fail in production.
 */
export function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>
): string {
  const sorted = Object.keys(params).sort();
  let data = url;
  for (const key of sorted) {
    data += key + params[key];
  }
  return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
}

export function verifyTwilioSignature(
  authToken: string,
  signatureHeader: string | null,
  url: string,
  params: Record<string, string>
): boolean {
  if (!signatureHeader) return false;
  const expected = computeTwilioSignature(authToken, url, params);
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Builds the canonical public URL Twilio signed for a given route path. */
export function signedUrlForPath(routePath: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${routePath}`;
}
