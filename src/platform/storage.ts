import { z } from "zod";
import type { AIxState, Delivery, Draft } from "../domain/monitoring";
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
  client_name: z.string().default("Fintara AG"),
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
    password_hash: z.string().optional(),
    password_salt: z.string().optional(),
    quiet_start: z.string(),
    quiet_end: z.string(),
    defaults: deliverySchema,
  }),
});
export const STORAGE_KEY = "helvetic-lens-aix:v1";
export const defaultDelivery = (): Delivery => ({
  frequency: "both",
  channels: ["email"],
  relevance_threshold: "high",
  digest_day: "monday",
  digest_time: "07:00",
});
export const emptyState = (): AIxState => ({
  version: 1,
  draft: null,
  profiles: [],
  updates: [],
  account: {
    name: "Anna",
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
export interface StateStore {
  read(): AIxState;
  write(state: AIxState): void;
}
export class LocalStateStore implements StateStore {
  private state: AIxState | null = null;
  private listeners = new Set<() => void>();
  warning = "";
  read(): AIxState {
    if (this.state) return this.state;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.state = stateSchema.parse(JSON.parse(raw));
      }
    } catch {
      this.warning =
        "Stored data could not be restored. You can create a new profile or use recovery.";
    }
    return (this.state ??= emptyState());
  }
  write(state: AIxState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    this.state = state;
    this.listeners.forEach((l) => l());
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  snapshot = () => this.state;
  refresh = () => {
    this.state = null;
    this.read();
    this.listeners.forEach((l) => l());
  };
  reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    this.state = emptyState();
    this.warning = "";
    this.listeners.forEach((l) => l());
  };
}
export const stateStore = new LocalStateStore();
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
