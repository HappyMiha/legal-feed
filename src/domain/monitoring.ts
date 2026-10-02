export type Topic = {
  id: string;
  title: string;
  description: string;
  legal_basis?: string;
  origin: "ai" | "user";
  selected: boolean;
};
export type Source = {
  id: string;
  name: string;
  section:
    "government_federal" | "government_cantonal" | "non_government" | "signal";
  type:
    | "court"
    | "law"
    | "authority"
    | "consultation"
    | "association"
    | "linkedin"
    | "website"
    | "competitor"
    | "newsletter"
    | "rss";
  url?: string;
  active: boolean;
  requested?: boolean;
  canton?: string;
};
export type Delivery = {
  frequency: "instant" | "weekly" | "both";
  channels: ("email" | "teams" | "slack")[];
  relevance_threshold: "high" | "all";
  digest_day?: string;
  digest_time?: string;
};
export type MonitoringProfile = {
  id: string;
  name: string;
  status: "active" | "paused";
  topics: Topic[];
  sources: Source[];
  delivery: Delivery;
  created_at: string;
  updated_at: string;
};
export type Update = {
  id: string;
  profile_id: string;
  source_id: string;
  topic_ids: string[];
  headline: string;
  summary: string;
  why_it_matters: string;
  relevance: "high" | "medium";
  url?: string;
  published_at: string;
  date_kind?: "published" | "discovered";
  read: boolean;
  saved: boolean;
  hidden: boolean;
  note?: string;
  feedback?: "relevant" | "not_relevant";
  feedback_reason?: string;
  client_name: string;
  source_name: string;
  source_section: Source["section"];
  topic_title: string;
  legal_basis: string;
};
export type SourceRecord = {
  update: Update;
  title: string;
  body: string;
  disclosure: string;
};
export type Draft = {
  input: string;
  missing: string;
  generated: boolean;
  editing_id?: string;
  profile: MonitoringProfile;
};
export type Account = {
  locale?: import("../i18n/core").Locale;
  pending_email?: string;
  name: string;
  email: string;
  firm: string;
  has_password?: boolean;
  quiet_start: string;
  quiet_end: string;
  defaults: Delivery;
};
export type AppState = {
  feed_quota?: FeedQuota;
  account_id?: string;
  version: 1;
  draft: Draft | null;
  profiles: MonitoringProfile[];
  updates: Update[];
  account: Account;
};
export type FeedLimitRequest={id:string;requested_limit:number;reason:string;status:'pending'|'approved'|'rejected'|'expired';approved_limit:number|null;created_at:string;expires_at:number;decided_at:string|null};
export type FeedQuota={limit:number;used:number;request:FeedLimitRequest|null};
export type FeedLimitReview=FeedLimitRequest & {name:string;email:string;limit:number;used:number};
export type RuntimeConfig = {
  summaryNotice: boolean;
  processingModel: string;
  deployment: string;
  hostingLocation: string;
};
export interface MonitoringBackend {
  suggestTopics(input: string): Promise<Topic[]>;
  suggestSources(topics: Topic[]): Promise<Source[]>;
  createProfile(profile: MonitoringProfile): Promise<MonitoringProfile>;
  updateProfile(profile: MonitoringProfile): Promise<MonitoringProfile>;
  getProfiles(): Promise<MonitoringProfile[]>;
  getUpdates(profileId: string): Promise<Update[]>;
  getUpdate(id: string): Promise<Update>;
  saveUpdate(id: string, saved: boolean): Promise<void>;
  addNote(id: string, note: string): Promise<void>;
  submitFeedback(
    id: string,
    feedback: "relevant" | "not_relevant",
    reason?: string,
  ): Promise<void>;
  markRead(id: string): Promise<void>;
  getSourceRecord(id: string): Promise<SourceRecord>;
  getDeliveryPreview(profile?: MonitoringProfile): Promise<Update | null>;
  addCanton(canton: string): Promise<Source[]>;
  deleteProfile(id: string, confirmation: string): Promise<void>;
  duplicateProfile(id: string): Promise<MonitoringProfile>;
}
