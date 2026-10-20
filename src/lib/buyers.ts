import { getStorage } from './storage';
import { assertSafeSlug, appendActivity, updatePropertySection, getProperty } from './markdown-loader';

export type BuyerPosition =
  | 'finance-approved'
  | 'cash'
  | 'subject-to-sale'
  | 'sold-own-home'
  | 'investor'
  | 'first-home'
  | 'unknown';

export type BuyerInterest = 'High' | 'Medium' | 'Low';

export interface BuyerFeedbackNote {
  ts: string;
  note: string;
  priceFeedback?: string;
  source: 'agent' | 'telegram' | 'whatsapp';
}

export interface Buyer {
  id: string;
  created: string;
  firstName: string;
  fullName?: string;
  phone?: string;
  email?: string;
  position: BuyerPosition;
  interest: BuyerInterest;
  private: boolean;
  feedback: BuyerFeedbackNote[];
}

// The only shape a vendor-facing surface may ever receive — never fullName,
// phone, or email, and the buyer's record id never leaves this module in
// anything a vendor route returns (R11).
export interface VendorBuyer {
  displayName: string;
  position: BuyerPosition;
  interest: BuyerInterest;
  latestFeedback?: string;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function readBuyers(slug: string): Promise<Buyer[]> {
  return getStorage().readList<Buyer>(`${slug}/buyers.json`);
}

async function writeBuyers(slug: string, items: Buyer[]): Promise<void> {
  assertSafeSlug(slug);
  await getStorage().writeList<Buyer>(`${slug}/buyers.json`, items);
}

async function syncBuyerFeedbackTable(slug: string, buyers: Buyer[]): Promise<void> {
  const rows = buyers
    .slice()
    .sort((a, b) => a.created.localeCompare(b.created))
    .flatMap(b => b.feedback.map(f => [f.ts.slice(0, 10), b.firstName, b.interest, f.note]));
  await updatePropertySection(slug, 'Buyer Feedback', '| Date | Buyer | Sentiment | Comments |', rows);
}

export interface UpsertBuyerInput {
  firstName: string;
  fullName?: string;
  phone?: string;
  email?: string;
  position?: BuyerPosition;
  interest?: BuyerInterest;
  private?: boolean;
  feedbackNote?: string;
  priceFeedback?: string;
  source?: BuyerFeedbackNote['source'];
}

// Matches an existing buyer by case-insensitive first name, so a repeated
// shorthand ("buyer: Priya, ...") updates the same record and appends a new
// feedback entry instead of creating a duplicate buyer (R10, R13).
export async function upsertBuyer(slug: string, input: UpsertBuyerInput): Promise<Buyer> {
  const buyers = await readBuyers(slug);
  const existing = buyers.find(b => b.firstName.toLowerCase() === input.firstName.toLowerCase());

  const now = new Date().toISOString();
  let buyer: Buyer;
  if (existing) {
    existing.fullName = input.fullName ?? existing.fullName;
    existing.phone = input.phone ?? existing.phone;
    existing.email = input.email ?? existing.email;
    existing.position = input.position ?? existing.position;
    existing.interest = input.interest ?? existing.interest;
    if (input.private !== undefined) existing.private = input.private;
    buyer = existing;
  } else {
    buyer = {
      id: randomId(),
      created: now,
      firstName: input.firstName,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      position: input.position ?? 'unknown',
      interest: input.interest ?? 'Medium',
      private: input.private ?? false,
      feedback: [],
    };
    buyers.push(buyer);
  }

  if (input.feedbackNote) {
    buyer.feedback.push({
      ts: now,
      note: input.feedbackNote,
      priceFeedback: input.priceFeedback,
      source: input.source ?? 'agent',
    });
  }

  await writeBuyers(slug, buyers);
  await syncBuyerFeedbackTable(slug, buyers);
  await appendActivity(slug, {
    source: 'inspection',
    actor: 'Agent',
    summary: existing
      ? `Updated buyer ${buyer.firstName}${input.feedbackNote ? ': ' + input.feedbackNote.slice(0, 100) : ''}`
      : `New interested buyer: ${buyer.firstName} (${buyer.position})`,
  });

  return buyer;
}

// The sole vendor-facing projection. Resolves the property's Buyer Display
// setting ('first-name' default, or 'anonymous') and strips every contact
// field; private buyers are dropped entirely (R11, KTD2).
export async function projectBuyersForVendor(slug: string): Promise<VendorBuyer[]> {
  const [buyers, property] = await Promise.all([readBuyers(slug), getProperty(slug)]);
  const anonymous = property?.buyerDisplay === 'anonymous';

  const visible = buyers
    .filter(b => !b.private)
    .sort((a, b) => {
      const rank = { High: 0, Medium: 1, Low: 2 };
      if (rank[a.interest] !== rank[b.interest]) return rank[a.interest] - rank[b.interest];
      return b.created.localeCompare(a.created);
    });

  // Anonymous labels are assigned by first-seen (creation) order, not the
  // interest-sorted display order, so the same buyer always gets the same
  // letter across calls.
  const byCreated = buyers.filter(b => !b.private).slice().sort((a, b) => a.created.localeCompare(b.created));
  const labelFor = (id: string) => {
    const idx = byCreated.findIndex(b => b.id === id);
    return `Buyer ${String.fromCharCode(65 + idx)}`;
  };

  return visible.map(b => ({
    displayName: anonymous ? labelFor(b.id) : b.firstName,
    position: b.position,
    interest: b.interest,
    latestFeedback: b.feedback[b.feedback.length - 1]?.note,
  }));
}

// Resolves one buyer's vendor-facing display name (first name, or the same
// anonymous "Buyer A/B/C" label projectBuyersForVendor would assign). Used
// by offers.ts so a vendor-facing offer can name who made it without ever
// exposing the buyer record itself (U6). Falls back to "A buyer" if the id
// is unknown (e.g. an offer logged without a matching buyer record).
export async function getBuyerDisplayName(slug: string, buyerId: string): Promise<string> {
  const [buyers, property] = await Promise.all([readBuyers(slug), getProperty(slug)]);
  const buyer = buyers.find(b => b.id === buyerId);
  if (!buyer) return 'A buyer';
  if (property?.buyerDisplay !== 'anonymous') return buyer.firstName;

  const byCreated = buyers.slice().sort((a, b) => a.created.localeCompare(b.created));
  const idx = byCreated.findIndex(b => b.id === buyerId);
  return `Buyer ${String.fromCharCode(65 + idx)}`;
}
