import type {
  MonitoringBackend,
  MonitoringProfile,
  Topic,
  Update,
} from "../domain/monitoring";
import { stateStore, type StateStore } from "../platform/storage";
import { aixTopics, matchesAIx } from "./aix-topic-fixtures";
import { aixSources, aixCantonSources } from "./aix-source-fixtures";
import { aixUpdates } from "./aix-update-fixtures";
export class AIxMonitoringBackend implements MonitoringBackend {
  constructor(
    private store: StateStore = stateStore,
    private topicDelay = 1700,
  ) {}
  async suggestTopics(input: string) {
    await new Promise((r) => setTimeout(r, this.topicDelay));
    return structuredClone(matchesAIx(input) ? aixTopics : []);
  }
  async suggestSources(topics: Topic[]) {
    return structuredClone(topics.some((t) => t.selected) ? aixSources : []);
  }
  async addCanton(canton: string) {
    return aixCantonSources(canton);
  }
  async createProfile(profile: MonitoringProfile) {
    if (
      !profile.name.trim() ||
      !profile.topics.some((t) => t.selected) ||
      !profile.sources.some((s) => s.active)
    )
      throw Error("Complete the profile before activating.");
    const state = this.store.read();
    if (state.profiles.some((p) => p.id === profile.id))
      throw Error("This profile already exists.");
    const next = structuredClone({
      ...profile,
      name: profile.name.trim(),
      updated_at: new Date().toISOString(),
    });
    // Fixed historical AIx snapshots remain independent of subscription edits.
    const isESOP = profile.topics.some((t) =>
      aixTopics.some((f) => f.id === t.id),
    );
    this.store.write({
      ...state,
      draft: null,
      profiles: [...state.profiles, next],
      updates: [
        ...state.updates,
        ...(isESOP
          ? aixUpdates(profile.id, profile.name.split(":")[0].trim())
          : []),
      ],
    });
    return structuredClone(next);
  }
  async updateProfile(profile: MonitoringProfile) {
    if (
      !profile.name.trim() ||
      !profile.topics.some((t) => t.selected) ||
      !profile.sources.some((s) => s.active)
    )
      throw Error("Complete the profile before saving.");
    const s = this.store.read();
    if (!s.profiles.some((p) => p.id === profile.id))
      throw Error("Profile unavailable.");
    const next = {
      ...profile,
      name: profile.name.trim(),
      updated_at: new Date().toISOString(),
    };
    this.store.write({
      ...s,
      profiles: s.profiles.map((p) =>
        p.id === next.id ? structuredClone(next) : p,
      ),
    });
    return structuredClone(next);
  }
  async getProfiles() {
    return structuredClone(this.store.read().profiles);
  }
  async getUpdates(profileId: string) {
    return structuredClone(
      this.store.read().updates.filter((u) => u.profile_id === profileId),
    );
  }
  async getUpdate(id: string) {
    const u = this.store.read().updates.find((u) => u.id === id);
    if (!u) throw Error("Update unavailable.");
    return structuredClone(u);
  }
  private patch(id: string, patch: Partial<Update>) {
    const s = this.store.read();
    if (!s.updates.some((u) => u.id === id)) throw Error("Update unavailable.");
    this.store.write({
      ...s,
      updates: s.updates.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    });
  }
  async saveUpdate(id: string, saved: boolean) {
    this.patch(id, { saved });
  }
  async addNote(id: string, note: string) {
    this.patch(id, { note });
  }
  async markRead(id: string) {
    const u = await this.getUpdate(id);
    if (!u.read) this.patch(id, { read: true });
  }
  async submitFeedback(
    id: string,
    feedback: "relevant" | "not_relevant",
    reason?: string,
  ) {
    this.patch(id, {
      feedback,
      feedback_reason: reason?.trim(),
      hidden: feedback === "not_relevant",
    });
  }
  async getSourceRecord(id: string) {
    const update = await this.getUpdate(id);
    return {
      update,
      title: update.headline,
      body: update.summary,
      disclosure: "AIx sample scenario",
    };
  }
  async getDeliveryPreview(profile?: MonitoringProfile) {
    if (
      profile &&
      !profile.topics.some((t) => aixTopics.some((f) => f.id === t.id))
    )
      return null;
    return aixUpdates(
      "aix-preview",
      profile?.name.split(":")[0].trim() || "Fintara AG",
    )[0];
  }
  async deleteProfile(id: string, confirmation: string) {
    const s = this.store.read(),
      p = s.profiles.find((p) => p.id === id);
    if (!p || confirmation !== p.name)
      throw Error("Enter the exact profile name.");
    this.store.write({
      ...s,
      profiles: s.profiles.filter((p) => p.id !== id),
      updates: s.updates.filter((u) => u.profile_id !== id),
      draft: s.draft?.editing_id === id ? null : s.draft,
    });
  }
  async duplicateProfile(id: string) {
    const p = (await this.getProfiles()).find((p) => p.id === id);
    if (!p) throw Error("Profile unavailable.");
    const now = new Date().toISOString();
    const copy = {
      ...p,
      id: crypto.randomUUID(),
      name: `Copy of ${p.name}`,
      created_at: now,
      updated_at: now,
    };
    const s = this.store.read();
    this.store.write({
      ...s,
      profiles: [...s.profiles, structuredClone(copy)],
    });
    return copy;
  }
}
export const monitoringBackend: MonitoringBackend = new AIxMonitoringBackend();
