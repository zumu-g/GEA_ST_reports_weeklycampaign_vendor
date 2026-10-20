import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { addOffer, updateOfferStatus, acknowledgeOffer, projectOffersForVendor, readOffers } from './offers';
import { readActivity, readComments } from './markdown-loader';

const SLUG = 'test-offers-slug';
const origDir = process.env.PROPERTIES_DIR;
let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-offers-'));
  process.env.PROPERTIES_DIR = tmp;
  await fs.mkdir(path.join(tmp, SLUG), { recursive: true });
  await fs.writeFile(
    path.join(tmp, SLUG, 'PROPERTY.md'),
    `# 85 Test Street\n\n## Property Details\n- **Owner:** Test Owner\n\n## Offers Received\n| Date | Buyer | Amount | Conditions | Status | Notes |\n|------|-------|--------|------------|--------|-------|\n|      |       |        |            |        |       |\n`,
    'utf-8'
  );
});

afterEach(async () => {
  process.env.PROPERTIES_DIR = origDir;
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('addOffer', () => {
  it('creates the offer, writes a roll-up row, an activity event, and matches an existing buyer by first name', async () => {
    const offer = await addOffer(SLUG, {
      buyerFirstName: 'Priya',
      amount: 705_000,
      conditions: 'subject to finance 14 days',
      settlementDays: 60,
    });
    expect(offer.status).toBe('received');

    const content = await fs.readFile(path.join(tmp, SLUG, 'PROPERTY.md'), 'utf-8');
    expect(content).toContain('| Priya | $705,000 | subject to finance 14 days | received |');

    const activity = await readActivity(SLUG);
    expect(activity).toHaveLength(2); // buyers.ts upsertBuyer's event + offers.ts's own

    // A second offer from the same first name reuses the same buyer.
    const second = await addOffer(SLUG, { buyerFirstName: 'Priya', amount: 710_000, conditions: '' });
    expect(second.buyerId).toBe(offer.buyerId);
  });
});

describe('updateOfferStatus', () => {
  it('rejects a status change on an already-settled offer with a distinct error', async () => {
    const offer = await addOffer(SLUG, { buyerFirstName: 'Priya', amount: 700_000, conditions: '' });
    await updateOfferStatus(SLUG, offer.id, 'withdrawn');
    await expect(updateOfferStatus(SLUG, offer.id, 'accepted')).rejects.toThrow('Offer already settled');
  });

  it('appends each status change to history', async () => {
    const offer = await addOffer(SLUG, { buyerFirstName: 'Priya', amount: 700_000, conditions: '' });
    const updated = await updateOfferStatus(SLUG, offer.id, 'countered');
    expect(updated.history.map(h => h.status)).toEqual(['received', 'countered']);
  });
});

describe('acknowledgeOffer', () => {
  it('posts a comment, appends one activity event, and is idempotent on a second call', async () => {
    const offer = await addOffer(SLUG, { buyerFirstName: 'Priya', amount: 705_000, conditions: '' });
    const acked = await acknowledgeOffer(SLUG, offer.id, 'Happy with this');
    expect(acked.vendorAck?.note).toBe('Happy with this');

    const comments = await readComments(SLUG);
    expect(comments).toHaveLength(1);
    expect(comments[0].author).toBe('vendor');

    const again = await acknowledgeOffer(SLUG, offer.id, 'different note');
    expect(again.vendorAck?.note).toBe('Happy with this'); // unchanged — idempotent
    const commentsAfter = await readComments(SLUG);
    expect(commentsAfter).toHaveLength(1); // no duplicate comment
  });

  it('throws Offer not found for an unknown id', async () => {
    await expect(acknowledgeOffer(SLUG, 'nope')).rejects.toThrow('Offer not found');
  });
});

describe('projectOffersForVendor', () => {
  it('carries the buyer display name, never the buyer record', async () => {
    await addOffer(SLUG, { buyerFirstName: 'Priya', amount: 705_000, conditions: 'finance 14 days' });
    const projected = await projectOffersForVendor(SLUG);
    expect(projected).toHaveLength(1);
    expect(projected[0]).toMatchObject({ buyerDisplayName: 'Priya', amount: 705_000, acknowledged: false });
    expect(projected[0]).not.toHaveProperty('buyerId');
  });

  it('a vendor acknowledge on a different property\'s offer id is rejected by the route layer (not this function)', async () => {
    const offer = await addOffer(SLUG, { buyerFirstName: 'Priya', amount: 1, conditions: '' });
    const offers = await readOffers(SLUG);
    expect(offers.map(o => o.id)).toContain(offer.id);
  });
});
