import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const approveWeeklyDraft = vi.fn();
const writeLatestUpdate = vi.fn();
const updatePropertySection = vi.fn();
const appendActivity = vi.fn();
const enqueueNotification = vi.fn();
const appendMarketNews = vi.fn();
const writeAnalyticsFile = vi.fn();
const getProperty = vi.fn();
const getTokenForSlug = vi.fn();
const recordApprovedReport = vi.fn();
const getTokenMeta = vi.fn();

vi.mock('@/lib/weekly-drafts', () => ({
  parseWeeklyDraftId: (id: string) => {
    const i = id.lastIndexOf('--');
    return i === -1 ? null : { slug: id.slice(0, i), weekEnding: id.slice(i + 2) };
  },
  approveWeeklyDraft: (...args: unknown[]) => approveWeeklyDraft(...args),
}));
vi.mock('@/lib/vendor-tokens', () => ({
  getTokenForSlug: (...args: unknown[]) => getTokenForSlug(...args),
  getTokenMeta: (...args: unknown[]) => getTokenMeta(...args),
}));
vi.mock('@/lib/sent-report-sync', () => ({ recordApprovedReport: (...args: unknown[]) => recordApprovedReport(...args) }));
vi.mock('@/lib/markdown-loader', () => ({
  appendMarketNews: (...args: unknown[]) => appendMarketNews(...args),
  writeAnalyticsFile: (...args: unknown[]) => writeAnalyticsFile(...args),
  writeLatestUpdate: (...args: unknown[]) => writeLatestUpdate(...args),
  updatePropertySection: (...args: unknown[]) => updatePropertySection(...args),
  appendActivity: (...args: unknown[]) => appendActivity(...args),
  enqueueNotification: (...args: unknown[]) => enqueueNotification(...args),
  getProperty: (...args: unknown[]) => getProperty(...args),
}));

import { POST } from './route';

afterEach(() => { vi.clearAllMocks(); getTokenMeta.mockReturnValue({}); });
getTokenMeta.mockReturnValue({});

function baseDraft(overrides: Record<string, unknown> = {}) {
  return {
    propertySlug: 'test-slug',
    weekEnding: '2026-10-21',
    propertyAddress: '85 Centenary Blvd',
    agent: 'Stuart',
    approvedAt: '2026-10-21T00:00:00Z',
    newsArticles: [],
    reaViews: 0, reaEnquiries: 0, reaSaves: 0, reaSearchAppearances: 0,
    domainViews: 0, domainEnquiries: 0, domainSaves: 0, domainSearchAppearances: 0,
    fieldSources: {},
    agentCommentary: '',
    ...overrides,
  };
}

describe('POST /api/weekly-drafts/[id]/approve', () => {
  it('emails the vendor the weekly recap, combined portal stats and portal link', async () => {
    approveWeeklyDraft.mockResolvedValue(baseDraft({
      agentCommentary: 'Two strong inspections this week.',
      reaViews: 300, domainViews: 120, reaEnquiries: 4, domainEnquiries: 2,
    }));
    getProperty.mockResolvedValue({ communications: [] });
    getTokenForSlug.mockReturnValue('tok123');
    getTokenMeta.mockReturnValue({ ownerName: 'Jo', ownerEmail: 'jo@example.com' });

    await POST(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'test-slug--2026-10-21' }) });

    const email = enqueueNotification.mock.calls.map(c => c[0]).find(n => n.channel === 'email');
    expect(email).toMatchObject({ to: { email: 'jo@example.com' }, slug: 'test-slug', notificationType: 'Weekly Report' });
    expect(email.portalUrl).toContain('/vendor/tok123');
    expect(email.body).toContain('Two strong inspections this week.');
    expect(email.body).toContain('420 views');
    expect(email.body).toContain('6 enquiries');
  });

  it('does not email when no owner email is on file', async () => {
    approveWeeklyDraft.mockResolvedValue(baseDraft({ agentCommentary: 'Recap.' }));
    getProperty.mockResolvedValue({ communications: [] });
    getTokenForSlug.mockReturnValue('tok123');
    getTokenMeta.mockReturnValue({});
    await POST(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'test-slug--2026-10-21' }) });
    expect(enqueueNotification.mock.calls.some(c => c[0].channel === 'email')).toBe(false);
  });

  it('publishes agentCommentary to Latest Update, logs a Communications row, and enqueues a push notification', async () => {
    approveWeeklyDraft.mockResolvedValue(baseDraft({ agentCommentary: 'Great week for the campaign.' }));
    getProperty.mockResolvedValue({ communications: [] });
    getTokenForSlug.mockReturnValue('tok123');

    const res = await POST(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'test-slug--2026-10-21' }) });
    expect(res.status).toBe(200);

    expect(writeLatestUpdate).toHaveBeenCalledWith('test-slug', 'Great week for the campaign.');
    expect(updatePropertySection).toHaveBeenCalledWith(
      'test-slug', 'Communications Log', '| Date | Type | Summary |',
      [['2026-10-21', 'Weekly Update', 'Great week for the campaign.']],
    );
    expect(appendActivity).toHaveBeenCalledWith('test-slug', expect.objectContaining({ source: 'comment' }));
    expect(enqueueNotification).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'push', slug: 'test-slug', notificationType: 'Weekly Report',
    }));
  });

  it('skips the publish step entirely when agentCommentary is empty', async () => {
    approveWeeklyDraft.mockResolvedValue(baseDraft({ agentCommentary: '' }));
    getTokenForSlug.mockReturnValue('tok123');

    const res = await POST(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'test-slug--2026-10-21' }) });
    expect(res.status).toBe(200);
    expect(writeLatestUpdate).not.toHaveBeenCalled();
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  it('returns 404 for a draft that does not exist', async () => {
    approveWeeklyDraft.mockResolvedValue(null);
    const res = await POST(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'test-slug--2026-10-21' }) });
    expect(res.status).toBe(404);
  });
});
