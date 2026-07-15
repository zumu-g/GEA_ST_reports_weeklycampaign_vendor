import { describe, it, expect } from 'vitest';
import { parseFreeformNote, parseTelegramMessage } from './message-parsers';

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
