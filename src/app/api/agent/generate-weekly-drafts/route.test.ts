import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const generateAllWeeklyDrafts = vi.fn();
const authorised = vi.fn();
vi.mock('@/lib/weekly-drafts', () => ({
  generateAllWeeklyDrafts: (...a: unknown[]) => generateAllWeeklyDrafts(...a),
  getReportWeekEnding: () => '2026-10-25',
}));
vi.mock('@/lib/agent-auth', () => ({ authorised: (...a: unknown[]) => authorised(...a) }));

import { POST } from './route';

afterEach(() => vi.clearAllMocks());

describe('POST /api/agent/generate-weekly-drafts (weekly cron)', () => {
  it('rejects callers without the agent key', async () => {
    authorised.mockReturnValue(false);
    const res = await POST(new NextRequest('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(401);
    expect(generateAllWeeklyDrafts).not.toHaveBeenCalled();
  });

  it('generates CRM-filled drafts for the current report week', async () => {
    authorised.mockReturnValue(true);
    generateAllWeeklyDrafts.mockResolvedValue({ created: 3 });
    const res = await POST(new NextRequest('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(generateAllWeeklyDrafts).toHaveBeenCalledWith('2026-10-25');
    expect(await res.json()).toEqual({ weekEnding: '2026-10-25', created: 3 });
  });
});
