import { stateStore, createDraft, emptyState } from "../platform/storage";
import { aixTopics } from "./aix-topic-fixtures";
import { aixSources } from "./aix-source-fixtures";
import { aixUpdates } from "./aix-update-fixtures";
export function recoverAIx(target: "feed" | "detail") {
  const p = createDraft().profile;
  p.id = "aix-fintara";
  p.name = "Fintara AG: ESOP";
  p.topics = structuredClone(aixTopics);
  p.sources = structuredClone(aixSources).map((s) =>
    s.name === "economiesuisse" ? { ...s, active: false } : s,
  );
  p.sources.push(
    {
      id: "aix-linkedin",
      name: "Competing law firm",
      section: "signal",
      type: "linkedin",
      url: "https://www.linkedin.com/company/walder-wyss/",
      active: true,
      requested: true,
    },
    {
      id: "aix-ledgy",
      name: "Ledgy newsletter",
      section: "signal",
      type: "newsletter",
      url: "https://ledgy.com/newsletter",
      active: true,
      requested: true,
    },
  );
  stateStore.write({
    ...emptyState(),
    profiles: [p],
    updates: aixUpdates(p.id),
  });
  return target === "feed" ? "/feed" : `/updates/${p.id}-court`;
}
