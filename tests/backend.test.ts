import { test } from "node:test";
import assert from "node:assert/strict";
import { AIxMonitoringBackend } from "../src/aix/aix-monitoring-backend";
import {
  createDraft,
  emptyState,
  validSignalUrl,
  type StateStore,
} from "../src/platform/storage";
import type { AIxState } from "../src/domain/monitoring";
function setup() {
  let data = emptyState();
  const store: StateStore = {
    read: () => data,
    write: (s: AIxState) => {
      data = structuredClone(s);
    },
  };
  return { store, backend: new AIxMonitoringBackend(store, 0) };
}
async function profile(backend: AIxMonitoringBackend) {
  const p = createDraft().profile;
  p.name = "Fintara AG: ESOP";
  p.topics = await backend.suggestTopics("ESOP");
  p.sources = await backend.suggestSources(p.topics);
  return p;
}
test("case-insensitive scenario triggers and restrained unknown query", async () => {
  const { backend } = setup();
  for (const q of [
    "ESOP",
    "vSoP",
    "employee participation",
    "employee options",
    "stock options",
    "phantom shares",
    "equity plan",
    "Mitarbeiterbeteiligung",
  ])
    assert.equal((await backend.suggestTopics(q)).length, 6);
  assert.deepEqual(await backend.suggestTopics("unrelated matters"), []);
});
test("activation validates, creates exactly four isolated historical records and rejects duplicate IDs", async () => {
  const { backend } = setup();
  const p = await profile(backend);
  await assert.rejects(() => backend.createProfile({ ...p, name: " " }));
  await assert.rejects(() => backend.createProfile({ ...p, topics: [] }));
  await assert.rejects(() => backend.createProfile({ ...p, sources: [] }));
  await backend.createProfile(p);
  const records = await backend.getUpdates(p.id);
  assert.equal(records.length, 4);
  assert.equal(records.filter((u) => u.relevance === "high").length, 2);
  await assert.rejects(() => backend.createProfile(p));
  records[0].note = "mutation";
  assert.equal((await backend.getUpdate(records[0].id)).note, undefined);
});
test("save, notes, read and feedback persist; history survives subscription changes and pause", async () => {
  const { backend, store } = setup();
  const p = await backend.createProfile(await profile(backend));
  const u = (await backend.getUpdates(p.id))[0];
  await backend.saveUpdate(u.id, true);
  await backend.addNote(u.id, "Discuss with founders");
  await backend.markRead(u.id);
  await backend.submitFeedback(u.id, "not_relevant", "Reviewed");
  await backend.updateProfile({
    ...p,
    status: "paused",
    topics: p.topics.slice(1),
    sources: p.sources.map((s) => ({ ...s, active: s.id === "seca" })),
  });
  const reopened = new AIxMonitoringBackend(store, 0);
  const result = await reopened.getUpdate(u.id);
  assert.equal(result.saved, true);
  assert.equal(result.read, true);
  assert.equal(result.note, "Discuss with founders");
  assert.equal(result.hidden, true);
  assert.equal(result.feedback_reason, "Reviewed");
  assert.equal(result.topic_title, "Taxation of employee participations");
  assert.equal((await reopened.getUpdates(p.id)).length, 4);
  await reopened.submitFeedback(u.id, "relevant");
  assert.equal((await reopened.getUpdate(u.id)).hidden, false);
  await reopened.addNote(u.id, "");
  assert.equal((await reopened.getUpdate(u.id)).note, "");
});
test("duplicate has independent configuration and no copied private history; delete scoped to profile", async () => {
  const { backend } = setup();
  const p = await backend.createProfile(await profile(backend));
  const copy = await backend.duplicateProfile(p.id);
  assert.notEqual(copy.id, p.id);
  assert.equal((await backend.getUpdates(copy.id)).length, 0);
  copy.topics[0].title = "Changed";
  await backend.updateProfile(copy);
  assert.equal(
    (await backend.getProfiles())[0].topics[0].title,
    p.topics[0].title,
  );
  await assert.rejects(() => backend.deleteProfile(p.id, "wrong"));
  await backend.deleteProfile(p.id, p.name);
  assert.equal((await backend.getProfiles()).length, 1);
  assert.equal((await backend.getUpdates(p.id)).length, 0);
});
test("unknown custom profiles do not receive unrelated ESOP content; URL validation rejects unsafe schemes", async () => {
  const { backend } = setup();
  const p = createDraft().profile;
  p.name = "Custom";
  p.topics = [
    {
      id: "custom",
      title: "Own topic",
      description: "",
      origin: "user",
      selected: true,
    },
  ];
  p.sources = await backend.suggestSources(p.topics);
  await backend.createProfile(p);
  assert.equal((await backend.getUpdates(p.id)).length, 0);
  for (const url of [
    "javascript:alert(1)",
    "not a URL",
    "https://",
    "https://user:password@example.com",
  ])
    assert.equal(validSignalUrl(url), false);
  assert.equal(validSignalUrl("https://ledgy.com/newsletter"), true);
});
test("profile context is captured in scenario impact without mutating other clients", async () => {
  const { backend } = setup();
  const p = await profile(backend);
  p.name = "Another AG: ESOP";
  const result = await backend.createProfile(p);
  const u = (await backend.getUpdates(result.id))[0];
  assert.equal(u.client_name, "Another AG");
  assert.match(u.why_it_matters, /Another's/);
  assert.equal((await backend.getDeliveryPreview())?.client_name, "Fintara AG");
});
