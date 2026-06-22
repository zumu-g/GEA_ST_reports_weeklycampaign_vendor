import { describe, it, expect } from 'vitest';
import { fieldDisplay } from '@/lib/field-display';

describe('fieldDisplay (gap vs zero)', () => {
  it('renders "Needs entry" for a gap, regardless of the underlying value', () => {
    const out = fieldDisplay(0, { source: null, capturedAt: null, gap: true });
    expect(out.isGap).toBe(true);
    expect(out.text).toBe('Needs entry');
  });

  it('renders a real captured 0 as "0", not a gap', () => {
    const out = fieldDisplay(0, { source: 'rea', capturedAt: '2026-06-20T00:00:00Z', gap: false });
    expect(out.isGap).toBe(false);
    expect(out.text).toBe('0');
  });

  it('formats a numeric value and includes a source/recency hint', () => {
    const out = fieldDisplay(2847, { source: 'rea', capturedAt: '2026-06-20T00:00:00Z', gap: false });
    expect(out.text).toBe('2,847');
    // Month formatting is ICU/locale-dependent ("Jun"/"June"); assert structure, not exact spelling.
    expect(out.hint).toMatch(/^rea · 20 Jun/);
  });

  it('has no hint when there is no source', () => {
    const out = fieldDisplay(5);
    expect(out).toEqual({ text: '5', isGap: false, hint: null });
  });

  it('falls back to just the source when capturedAt is missing/invalid', () => {
    const out = fieldDisplay(5, { source: 'crm', capturedAt: null, gap: false });
    expect(out.hint).toBe('crm');
  });
});
