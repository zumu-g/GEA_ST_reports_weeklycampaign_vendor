import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { readBuyers, upsertBuyer, projectBuyersForVendor } from './buyers';
import { readActivity } from './markdown-loader';

const SLUG = 'test-buyer-slug';

const origDir = process.env.PROPERTIES_DIR;
let tmp: string;

function fixture(buyerDisplay = 'first-name'): string {
  return `# 85 Test Street

## Property Details
- **Owner:** Test Owner
- **Buyer Display:** ${buyerDisplay}

## Buyer Feedback
| Date | Buyer | Sentiment | Comments |
|------|-------|-----------|----------|
|      |       |           |          |
`;
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-buyers-'));
  process.env.PROPERTIES_DIR = tmp;
  await fs.mkdir(path.join(tmp, SLUG), { recursive: true });
  await fs.writeFile(path.join(tmp, SLUG, 'PROPERTY.md'), fixture(), 'utf-8');
});

afterEach(async () => {
  process.env.PROPERTIES_DIR = origDir;
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('upsertBuyer', () => {
  it('creates a new buyer with a feedback note, one activity event and one roll-up row', async () => {
    await upsertBuyer(SLUG, {
      firstName: 'Priya',
      fullName: 'Priya Sharma',
      phone: '0400000000',
      position: 'finance-approved',
      interest: 'High',
      feedbackNote: 'Loved the yard',
    });

    const buyers = await readBuyers(SLUG);
    expect(buyers).toHaveLength(1);
    expect(buyers[0].firstName).toBe('Priya');
    expect(buyers[0].feedback).toHaveLength(1);

    const activity = await readActivity(SLUG);
    expect(activity).toHaveLength(1);

    const content = await fs.readFile(path.join(tmp, SLUG, 'PROPERTY.md'), 'utf-8');
    expect(content).toContain('| Priya | High | Loved the yard |');
  });

  it('matches an existing buyer by case-insensitive first name and appends a second feedback row without duplicating the buyer', async () => {
    await upsertBuyer(SLUG, { firstName: 'Priya', feedbackNote: 'First visit' });
    await upsertBuyer(SLUG, { firstName: 'priya', feedbackNote: 'Second visit, thinks 700' });

    const buyers = await readBuyers(SLUG);
    expect(buyers).toHaveLength(1);
    expect(buyers[0].feedback).toHaveLength(2);
  });

  it('marks a buyer private without throwing when no feedback note is given', async () => {
    const buyer = await upsertBuyer(SLUG, { firstName: 'Confidential', private: true });
    expect(buyer.private).toBe(true);
  });
});

describe('projectBuyersForVendor', () => {
  it('strips fullName, phone and email in first-name mode', async () => {
    await upsertBuyer(SLUG, {
      firstName: 'Priya',
      fullName: 'Priya Sharma',
      phone: '0400000000',
      email: 'priya@example.com',
      position: 'cash',
      interest: 'High',
    });

    const projected = await projectBuyersForVendor(SLUG);
    expect(projected).toEqual([
      { displayName: 'Priya', position: 'cash', interest: 'High', latestFeedback: undefined },
    ]);
  });

  it('returns stable anonymous labels in first-seen order, independent of interest-sort display order', async () => {
    await fs.writeFile(path.join(tmp, SLUG, 'PROPERTY.md'), fixture('anonymous'), 'utf-8');
    await upsertBuyer(SLUG, { firstName: 'Alex', interest: 'Low' });
    await upsertBuyer(SLUG, { firstName: 'Blake', interest: 'High' });
    await upsertBuyer(SLUG, { firstName: 'Casey', interest: 'Medium' });

    const projected = await projectBuyersForVendor(SLUG);
    const byName = Object.fromEntries(projected.map(b => [b.displayName, b]));
    expect(byName['Buyer A'].interest).toBe('Low'); // Alex, created first
    expect(byName['Buyer B'].interest).toBe('High'); // Blake, created second
    expect(byName['Buyer C'].interest).toBe('Medium'); // Casey, created third

    const secondCall = await projectBuyersForVendor(SLUG);
    expect(secondCall).toEqual(projected);
  });

  it('drops a private buyer from the projection entirely', async () => {
    await upsertBuyer(SLUG, { firstName: 'Visible', interest: 'High' });
    await upsertBuyer(SLUG, { firstName: 'Hidden', private: true, interest: 'High' });

    const projected = await projectBuyersForVendor(SLUG);
    expect(projected.map(b => b.displayName)).toEqual(['Visible']);
  });
});
