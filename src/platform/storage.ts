import { z } from "zod";
import type { AppState, Delivery, Draft } from "../domain/monitoring";
const deliverySchema = z.object({
  frequency: z.enum(["instant", "weekly", "both"]),
  channels: z.array(z.enum(["email", "teams", "slack"])),
  relevance_threshold: z.enum(["high", "all"]),
  digest_day: z.string().optional(),
  digest_time: z.string().optional(),
});
const topicSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  legal_basis: z.string().optional(),
  origin: z.enum(["ai", "user"]),
  selected: z.boolean(),
});
const sourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  section: z.enum([
    "government_federal",
    "government_cantonal",
    "non_government",
    "signal",
  ]),
  type: z.enum([
    "court",
    "law",
    "authority",
    "consultation",
    "association",
    "linkedin",
    "website",
    "competitor",
    "newsletter",
    "rss",
  ]),
  active: z.boolean(),
  requested: z.boolean().optional(),
  url: z.string().optional(),
  canton: z.string().optional(),
});
const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["active", "paused"]),
  topics: z.array(topicSchema),
  sources: z.array(sourceSchema),
  delivery: deliverySchema,
  created_at: z.string(),
  updated_at: z.string(),
});
const updateSchema = z.object({
  id: z.string(),
  profile_id: z.string(),
  source_id: z.string(),
  topic_ids: z.array(z.string()),
  headline: z.string(),
  summary: z.string(),
  why_it_matters: z.string(),
  relevance: z.enum(["high", "medium"]),
  published_at: z.string(),
  read: z.boolean(),
  saved: z.boolean(),
  hidden: z.boolean(),
  client_name: z.string(),
  source_name: z.string(),
  source_section: sourceSchema.shape.section,
  topic_title: z.string(),
  legal_basis: z.string(),
  note: z.string().optional(),
  feedback: z.enum(["relevant", "not_relevant"]).optional(),
  feedback_reason: z.string().optional(),
  url: z.string().optional(),
});
const stateSchema = z.object({
  version: z.literal(1),
  draft: z
    .object({
      input: z.string(),
      missing: z.string(),
      generated: z.boolean(),
      editing_id: z.string().optional(),
      profile: profileSchema,
    })
    .nullable(),
  profiles: z.array(profileSchema),
  updates: z.array(updateSchema),
  account: z.object({
    name: z.string(),
    email: z.string(),
    firm: z.string(),
    quiet_start: z.string(),
    quiet_end: z.string(),
    defaults: deliverySchema,
  }),
});
export const defaultDelivery = (): Delivery => ({
  frequency: "both",
  channels: ["email"],
  relevance_threshold: "high",
  digest_day: "monday",
  digest_time: "07:00",
});
export const emptyState = (): AppState => ({
  version: 1,
  draft: null,
  profiles: [],
  updates: [],
  account: {
    name: "",
    email: "",
    firm: "",
    quiet_start: "22:00",
    quiet_end: "07:00",
    defaults: defaultDelivery(),
  },
});
export function createDraft(delivery = defaultDelivery()): Draft {
  const now = new Date().toISOString();
  return {
    input: "",
    missing: "",
    generated: false,
    profile: {
      id: crypto.randomUUID(),
      name: "",
      status: "active",
      topics: [],
      sources: [],
      delivery,
      created_at: now,
      updated_at: now,
    },
  };
}
export class RemoteStateStore {
 private state: AppState | null = null;
 private listeners = new Set<() => void>();
 private draftKey = "legal-feed:draft:v1";
 private loaded = false;
 private request = 0;
 warning = "";
 read(): AppState { return this.state ?? emptyState(); }
 write(state: AppState) {
  // Only an unfinished wizard draft is device-local. Server state is authoritative.
  if(!this.loaded) throw Error("Account is still loading.");
  localStorage.setItem(this.draftKey, JSON.stringify(state.draft));
  this.state={...this.read(),draft:state.draft};this.emit();
 }
 replace(state:AppState){this.state=state;this.loaded=true;this.emit();}
 private emit(){this.listeners.forEach(l=>l());}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
 snapshot=()=>this.state;
 refresh=async()=>{
  const request=++this.request;
  const {api}=await import('../production/api');
  const remote=await api<AppState>('state');
  if(request!==this.request)return;
  const switched=this.state?.account_id!==remote.account_id;
  if(switched){this.loaded=false;this.draftKey=`legal-feed:draft:v1:${remote.account_id}`;}
  let draft=switched?null:this.state?.draft??null;
  if(!this.loaded){try{const raw=localStorage.getItem(this.draftKey);if(raw)draft=stateSchema.shape.draft.parse(JSON.parse(raw));}catch{localStorage.removeItem(this.draftKey);}}
  this.state={...remote,draft};this.loaded=true;this.emit();
 };
 reset=()=>{localStorage.removeItem(this.draftKey);this.state=null;this.loaded=false;this.emit();};
}
export const stateStore = new RemoteStateStore();
export function validSignalUrl(value: string) {
  try {
    const u = new URL(value);
    return (
      ["https:", "http:"].includes(u.protocol) &&
      u.hostname.includes(".") &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}
