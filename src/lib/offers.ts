import { getStorage } from './storage';
import { assertSafeSlug, appendActivity, updatePropertySection, appendComment } from './markdown-loader';
import { readBuyers, upsertBuyer, getBuyerDisplayName } from './buyers';

export type OfferStatus = 'received' | 'countered' | 'accepted' | 'declined' | 'withdrawn';

export interface OfferHistoryEntry {
  ts: string;
  status: OfferStatus;
}

export interface Offer {
  id: string;
  created: string;
  buyerId: string;
  amount: number;
  conditions: string;
  settlementDays?: number;
  expiry?: string;
  status: OfferStatus;
  vendorAck?: { ts: string; note?: string };
  history: OfferHistoryEntry[];
}

// The only shape a vendor-facing route may return — the buyer's display
// name only, never the buyer record (R11, mirrors buyers.ts's VendorBuyer).
export interface VendorOffer {
  id: string;
  buyerDisplayName: string;
  amount: number;
  conditions: string;
  settlementDays?: number;
  expiry?: string;
  status: OfferStatus;
  acknowledged: boolean;
  created: string;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function readOffers(slug: string): Promise<Offer[]> {
  return getStorage().readList<Offer>(`${slug}/offers.json`);
}

async function writeOffers(slug: string, items: Offer[]): Promise<void> {
  assertSafeSlug(slug);
  await getStorage().writeList<Offer>(`${slug}/offers.json`, items);
}

async function syncOffersTable(slug: string, offers: Offer[]): Promise<void> {
  const rows = await Promise.all(
    offers
      .slice()
      .sort((a, b) => a.created.localeCompare(b.created))
      .map(async o => [
        o.created.slice(0, 10),
        await getBuyerDisplayName(slug, o.buyerId),
        `$${o.amount.toLocaleString('en-AU')}`,
        o.conditions,
        o.status,
        o.vendorAck ? 'Vendor acknowledged' : '',
      ]),
  );
  await updatePropertySection(slug, 'Offers Received', '| Date | Buyer | Amount | Conditions | Status | Notes |', rows);
}

export interface AddOfferInput {
  buyerFirstName: string;
  amount: number;
  conditions: string;
  settlementDays?: number;
  expiry?: string;
}

// Matches/creates the buyer by first name (same rule as upsertBuyer) so an
// offer logged from shorthand links to the same record a prior check-in or
// feedback note created (R10).
export async function addOffer(slug: string, input: AddOfferInput): Promise<Offer> {
  const buyer = await upsertBuyer(slug, { firstName: input.buyerFirstName });

  const offers = await readOffers(slug);
  const now = new Date().toISOString();
  const offer: Offer = {
    id: randomId(),
    created: now,
    buyerId: buyer.id,
    amount: input.amount,
    conditions: input.conditions,
    settlementDays: input.settlementDays,
    expiry: input.expiry,
    status: 'received',
    history: [{ ts: now, status: 'received' }],
  };
  offers.push(offer);
  await writeOffers(slug, offers);
  await syncOffersTable(slug, offers);
  await appendActivity(slug, {
    source: 'inspection',
    actor: 'Agent',
    summary: `New offer: $${offer.amount.toLocaleString('en-AU')} from ${buyer.firstName}`,
  });

  return offer;
}

const TERMINAL_STATUSES: OfferStatus[] = ['accepted', 'declined', 'withdrawn'];

export async function updateOfferStatus(slug: string, offerId: string, status: OfferStatus): Promise<Offer> {
  const offers = await readOffers(slug);
  const idx = offers.findIndex(o => o.id === offerId);
  if (idx === -1) throw new Error('Offer not found');
  const offer = offers[idx];
  if (TERMINAL_STATUSES.includes(offer.status)) throw new Error('Offer already settled');

  const now = new Date().toISOString();
  offers[idx] = { ...offer, status, history: [...offer.history, { ts: now, status }] };
  await writeOffers(slug, offers);
  await syncOffersTable(slug, offers);
  await appendActivity(slug, { source: 'inspection', actor: 'Agent', summary: `Offer status: ${status}` });

  return offers[idx];
}

// Vendor acknowledgement — never acceptance. Posts into the existing
// comments thread (so the agent sees it where they already look) and emails
// the agent via the internal helper, never the vendor-facing notify route
// (U1). Idempotent: a second acknowledge on an already-acked offer is a
// no-op rather than a duplicate comment.
export async function acknowledgeOffer(slug: string, offerId: string, note?: string): Promise<Offer> {
  const offers = await readOffers(slug);
  const idx = offers.findIndex(o => o.id === offerId);
  if (idx === -1) throw new Error('Offer not found');
  const offer = offers[idx];
  if (offer.vendorAck) return offer;

  const now = new Date().toISOString();
  offers[idx] = { ...offer, vendorAck: { ts: now, note } };
  await writeOffers(slug, offers);
  await syncOffersTable(slug, offers);

  const displayName = await getBuyerDisplayName(slug, offer.buyerId);
  const body = `Acknowledged offer of $${offer.amount.toLocaleString('en-AU')} from ${displayName}.` + (note ? ` "${note}"` : '');
  await appendComment(slug, { author: 'vendor', body });
  await appendActivity(slug, { source: 'comment', actor: 'Vendor', summary: body.slice(0, 140) });

  return offers[idx];
}

export async function projectOffersForVendor(slug: string): Promise<VendorOffer[]> {
  const offers = await readOffers(slug);
  const buyers = await readBuyers(slug);
  const buyerMap = new Map(buyers.map(b => [b.id, b]));

  return Promise.all(
    offers
      .slice()
      .sort((a, b) => b.created.localeCompare(a.created))
      .map(async o => ({
        id: o.id,
        buyerDisplayName: buyerMap.has(o.buyerId) ? await getBuyerDisplayName(slug, o.buyerId) : 'A buyer',
        amount: o.amount,
        conditions: o.conditions,
        settlementDays: o.settlementDays,
        expiry: o.expiry,
        status: o.status,
        acknowledged: !!o.vendorAck,
        created: o.created,
      })),
  );
}
