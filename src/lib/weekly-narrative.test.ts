import { describe, it, expect, vi, afterEach } from 'vitest';
import { scrubContact, draftNarrative, type WeekSummary } from './weekly-narrative';

vi.mock('@/lib/minimax', () => ({
  callMiniMax: vi.fn(),
}));

afterEach(() => vi.clearAllMocks());

describe('scrubContact', () => {
  it('removes a phone number and an email address', () => {
    const scrubbed = scrubContact('Call her on 0412 345 678 or priya@example.com about the offer');
    expect(scrubbed).not.toContain('0412');
    expect(scrubbed).not.toContain('priya@example.com');
    expect(scrubbed).toContain('[phone removed]');
    expect(scrubbed).toContain('[email removed]');
  });

  it('leaves ordinary text untouched', () => {
    expect(scrubContact('Loved the yard, thinks 700')).toBe('Loved the yard, thinks 700');
  });
});

describe('draftNarrative', () => {
  const summary: WeekSummary = {
    address: '85 Centenary Blvd',
    weekEnding: '2026-10-21',
    stats: [{ source: 'REA', views: 100, enquiries: 5, viewsDelta: 0, enquiriesDelta: 0 }],
    groupsThisWeek: 4,
    newBuyers: [],
    offers: [],
    competitorChanges: 1,
    upcomingOpens: 1,
  };

  it('throws when MINIMAX_API_KEY is unset', async () => {
    delete process.env.MINIMAX_API_KEY;
    await expect(draftNarrative(summary, '')).rejects.toThrow('MINIMAX_API_KEY not configured');
  });

  it('calls callMiniMax with the summary figures and returns the trimmed text', async () => {
    process.env.MINIMAX_API_KEY = 'test-key';
    const { callMiniMax } = await import('@/lib/minimax');
    vi.mocked(callMiniMax).mockResolvedValue('  Draft text here.  ');

    const result = await draftNarrative(summary, 'Previous update text');
    expect(result).toBe('Draft text here.');
    const promptArg = vi.mocked(callMiniMax).mock.calls[0][1][0].content;
    expect(promptArg).toContain('85 Centenary Blvd');
    expect(promptArg).toContain('Previous update text');
    expect(promptArg).toContain('REA 100 views, 5 enquiries');
  });
});
