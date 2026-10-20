import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const resolveVendorToken = vi.fn();
const sendEmail = vi.fn();
const getProperty = vi.fn();
const recordSentReportDelivery = vi.fn();

vi.mock('@/lib/vendor-tokens', () => ({
  resolveVendorToken: (...args: unknown[]) => resolveVendorToken(...args),
}));
vi.mock('@/lib/notify-email', () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
  renderVendorEmail: () => '<p>stub</p>',
}));
vi.mock('@/lib/markdown-loader', () => ({
  getProperty: (...args: unknown[]) => getProperty(...args),
}));
vi.mock('@/lib/sent-report-sync', () => ({
  recordSentReportDelivery: (...args: unknown[]) => recordSentReportDelivery(...args),
}));

import { POST } from './route';

const origApiKey = process.env.RESEND_API_KEY;
const origAgentKey = process.env.AGENT_API_KEY;

beforeEach(() => {
  process.env.RESEND_API_KEY = 'resend-test-key';
  process.env.AGENT_API_KEY = 'agent-secret';
  resolveVendorToken.mockReturnValue({ slug: 'test-slug', meta: { ownerEmail: 'owner@example.com', ownerName: 'Vikram' } });
  getProperty.mockResolvedValue({ address: '85 Centenary Blvd' });
  sendEmail.mockResolvedValue({ sent: true, id: 'email-1' });
});

afterEach(() => {
  process.env.RESEND_API_KEY = origApiKey;
  process.env.AGENT_API_KEY = origAgentKey;
  vi.clearAllMocks();
});

function req(body: object, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/vendor/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-key': 'agent-secret', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/vendor/notify', () => {
  it('sends to the stored owner email only, ignoring a body-supplied ownerEmail', async () => {
    const res = await POST(req({ token: 'tok', ownerEmail: 'attacker@example.com', message: 'hi' }));
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@example.com' })
    );
  });

  it('returns 404 for an unknown token and sends no mail', async () => {
    resolveVendorToken.mockReturnValue(null);
    const res = await POST(req({ token: 'unknown' }));
    expect(res.status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 401 for a valid token with no agent key or admin session', async () => {
    const res = await POST(req({ token: 'tok' }, { 'x-agent-key': '' }));
    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 400 when the resolved token has no owner email on file', async () => {
    resolveVendorToken.mockReturnValue({ slug: 'test-slug', meta: {} });
    const res = await POST(req({ token: 'tok' }));
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
