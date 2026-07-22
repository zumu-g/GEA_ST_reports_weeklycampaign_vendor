import { describe, it, expect } from 'vitest';
import { parseArticleBroadcast, parseFreeformNote, parseTelegramMessage } from './message-parsers';

describe('parseArticleBroadcast', () => {
  it('parses trigger phrase + URL + title/summary lines', () => {
    const message =
      'Add this article link and summary to all property reports this week\n' +
      'https://www.abc.net.au/news/2026-07-21/how-the-australian-property-market\n' +
      'Three graphs that show uncertainty in the property market\n' +
      'Global instability, shifting tax policies and interest rate pressures force buyers and sellers to adjust.';

    expect(parseArticleBroadcast(message)).toEqual({
      url: 'https://www.abc.net.au/news/2026-07-21/how-the-australian-property-market',
      title: 'Three graphs that show uncertainty in the property market',
      note: 'Global instability, shifting tax policies and interest rate pressures force buyers and sellers to adjust.',
    });
  });

  it('is case-insensitive on the trigger phrase', () => {
    expect(parseArticleBroadcast('add THIS article to reports\nhttps://example.com/a')).toEqual({
      url: 'https://example.com/a',
    });
  });

  it('returns url-only when there is no title/summary text', () => {
    expect(parseArticleBroadcast('Add this article link and summary\nhttps://example.com/a')).toEqual({
      url: 'https://example.com/a',
    });
  });

  it('returns null when the trigger phrase is missing (a normal note with a link)', () => {
    expect(parseArticleBroadcast('85 Centenary | note: sent them this https://example.com/a')).toBeNull();
  });

  it('returns null when the trigger phrase is present but no URL exists', () => {
    expect(parseArticleBroadcast('Add this article to all reports this week, forgot the link')).toBeNull();
  });

  it('trims trailing punctuation the greedy URL match swallows', () => {
    expect(parseArticleBroadcast('Add this article\nhttps://example.com/a).\nTitle')).toEqual({
      url: 'https://example.com/a',
      title: 'Title',
    });
  });

  it('picks the first URL when multiple are present', () => {
    const result = parseArticleBroadcast(
      'Add this article\nhttps://example.com/first\nsee also https://example.com/second'
    );
    expect(result?.url).toBe('https://example.com/first');
  });
});

// No pre-existing test file covered these parsers before extraction from the
// Telegram route (U5) — these tests establish the behaviour-unchanged
// baseline the WhatsApp route now shares.
describe('parseFreeformNote', () => {
  it('parses pipe form', () => {
    expect(parseFreeformNote('85 Centenary | note: spoke to buyer')).toEqual({
      propertyText: '85 Centenary',
      note: 'spoke to buyer',
    });
  });

  it('parses #feed form (greedy 3-word property match, matching pre-extraction behaviour)', () => {
    // The regex's {0,2} repetition is greedy, so it consumes up to 3 words
    // for propertyText before the remainder becomes the note — this is the
    // original Telegram route's behaviour, unchanged by extraction.
    expect(parseFreeformNote('#feed 85 Centenary spoke to buyer')).toEqual({
      propertyText: '85 Centenary spoke',
      note: 'to buyer',
    });
  });

  it('parses colon form', () => {
    expect(parseFreeformNote('85 Centenary: note: spoke to buyer')).toEqual({
      propertyText: '85 Centenary',
      note: 'spoke to buyer',
    });
  });

  it('returns null for inspection-shorthand text', () => {
    expect(parseFreeformNote('85 Centenary | open | 3 groups | 1 interested')).toBeNull();
  });
});

describe('parseTelegramMessage', () => {
  it('parses pipe-delimited inspection shorthand', () => {
    const result = parseTelegramMessage('85 Centenary | open | 3 groups | 1 interested | felt overpriced');
    expect(result).toMatchObject({
      propertyText: '85 Centenary',
      type: 'Open Home',
      groups: 3,
      interested: 1,
      notes: 'felt overpriced',
    });
  });

  it('parses colon/comma format', () => {
    const result = parseTelegramMessage('14 Hartsmere: private, 3 groups, 1 interested, very keen');
    expect(result).toMatchObject({
      propertyText: '14 Hartsmere',
      type: 'Private Inspection',
      groups: 3,
      interested: 1,
      interestLevel: 'High',
    });
  });

  it('parses dash format', () => {
    const result = parseTelegramMessage('Calibar - open - 5 groups');
    expect(result).toMatchObject({ propertyText: 'Calibar', type: 'Open Home', groups: 5 });
  });
});
