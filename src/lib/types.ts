export interface VendorReport {
  id: string;
  propertyAddress: string;
  vendorName: string;
  agent: string;
  weekEnding: string;
  listingDate: string;
  askingPrice: string;
  // realestate.com.au stats
  reaViews: number;
  reaEnquiries: number;
  reaSaves: number;
  reaSearchAppearances: number;
  // domain.com.au stats
  domainViews: number;
  domainEnquiries: number;
  domainSaves: number;
  domainSearchAppearances: number;
  // Open home stats
  openHomeAttendees: number;
  privateInspections: number;
  // Campaign info
  campaignType: string;
  daysOnMarket: number;
  // Draft workflow
  status?: 'draft' | 'approved';
  // Chat messages
  messages: ChatMessage[];
}

export interface WeeklyDraft {
  id: string;
  propertySlug: string;
  weekEnding: string;
  status: 'draft' | 'approved';
  approvedAt: string | null;
  propertyAddress: string;
  vendorName: string;
  agent: string;
  askingPrice: string;
  campaignType: string;
  listingDate: string;
  daysOnMarket: number;
  reaViews: number;
  reaEnquiries: number;
  reaSaves: number;
  reaSearchAppearances: number;
  domainViews: number;
  domainEnquiries: number;
  domainSaves: number;
  domainSearchAppearances: number;
  openHomeAttendees: number;
  privateInspections: number;
  agentCommentary: string;
  newsArticles: NewsArticle[];
  generatedNarrative: GeneratedReportNarrative | null;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderRole: "agent" | "vendor";
  message: string;
  timestamp: string;
}

export interface WeeklySummary {
  weekEnding: string;
  totalListings: number;
  totalReaViews: number;
  totalDomainViews: number;
  totalEnquiries: number;
  totalOpenHomeAttendees: number;
  totalPrivateInspections: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  note: string;
}

export interface GenerateReportInput {
  propertyAddress: string;
  vendorName: string;
  agent: string;
  weekEnding: string;
  campaignType: string;
  askingPrice: string;
  daysOnMarket: string;
  listingDate: string;
  // REA actuals
  reaViews: string;
  reaEnquiries: string;
  reaSaves: string;
  reaSearchAppearances: string;
  reaFileContent: string;
  // REA targets
  reaViewsTarget: string;
  reaEnquiriesTarget: string;
  reaSavesTarget: string;
  // Domain actuals
  domainViews: string;
  domainEnquiries: string;
  domainSaves: string;
  domainSearchAppearances: string;
  domainFileContent: string;
  // Domain targets
  domainViewsTarget: string;
  domainEnquiriesTarget: string;
  domainSavesTarget: string;
  // Inspections
  openHomeAttendees: string;
  privateInspections: string;
  openHomeAttendeesTarget: string;
  inspectionNotes: string;
  agentCommentary: string;
  newsArticles: NewsArticle[];
}

export interface StatRow {
  label: string;
  actual: number | null;
  target: number | null;
}

// --- Rental types ---

export interface RentalAnalyticsRow {
  weekEnding: string;
  reaViews: number;
  reaEnquiries: number;
  reaSaves: number;
  domainViews: number;
  domainEnquiries: number;
  domainSaves: number;
  applications: number;
}

export interface RentalGenerateInput {
  propertyAddress: string;
  landlordName: string;
  agent: string;
  weekEnding: string;
  leaseType: string;
  rentPw: string;
  daysListed: string;
  listedDate: string;
  reaViews: string;
  reaEnquiries: string;
  reaSaves: string;
  domainViews: string;
  domainEnquiries: string;
  domainSaves: string;
  applications: string;
  applicationNotes: string;
  openHomeAttendees: string;
  privateInspections: string;
  inspectionNotes: string;
  agentCommentary: string;
  newsArticles: NewsArticle[];
}

// --- End rental types ---

export interface GeneratedReportNarrative {
  greeting: string;
  openingParagraph: string;
  performanceHighlights: string[];
  statsTable: StatRow[];
  portalAnalysis: string;
  inspectionSummary: string;
  marketContext: string;
  agentInsight: string;
  nextSteps: string;
  closing: string;
}
