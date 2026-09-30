"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Button,
  Choices,
  SelectField,
  frequencies,
  sections,
} from "../components/controls";
import type {
  AppState,
  Draft,
  MonitoringProfile,
  Source,
  Topic,
  Update,
} from "../domain/monitoring";
import { stateStore, validSignalUrl } from "../platform/storage";
import { monitoringBackend } from "../production/backend";
import type { Actions } from "../app";
const steps = ["topics", "sources", "delivery", "review"];
const cantons = [
  "Zurich",
  "Bern",
  "Lucerne",
  "Uri",
  "Schwyz",
  "Obwalden",
  "Nidwalden",
  "Glarus",
  "Zug",
  "Fribourg",
  "Solothurn",
  "Basel-Stadt",
  "Basel-Landschaft",
  "Schaffhausen",
  "Appenzell Ausserrhoden",
  "Appenzell Innerrhoden",
  "St. Gallen",
  "Graubünden",
  "Aargau",
  "Thurgau",
  "Ticino",
  "Vaud",
  "Valais",
  "Neuchâtel",
  "Geneva",
  "Jura",
];
export function Wizard({
  step,
  state,
  actions,
}: {
  step: string;
  state: AppState;
  actions: Actions;
}) {
  const draft = state.draft;
  const [busy, setBusy] = useState(false);
  const [topicBusy, setTopicBusy] = useState(false);
  const [activated, setActivated] = useState<MonitoringProfile | null>(null);
  const activationLock = useRef(false);
  const save = (next: Draft) => {
    try {
      stateStore.write({ ...stateStore.read(), draft: next });
    } catch {
      toast.error(
        "Could not save your draft. Please try again.",
      );
    }
  };
  const patch = (p: Partial<MonitoringProfile>) => {
    if (draft) save({ ...draft, profile: { ...draft.profile, ...p } });
  };
  if (activated && (!draft || draft.profile.id === activated.id))
    return (
      <div className="activation">
        <span className="activation-check">
          <Check />
        </span>
        <h1>
          {draft?.editing_id
            ? "Your changes are saved"
            : "Your monitoring profile is live"}
        </h1>
        <p>{activated.name}</p>
        <div className="actions">
          <Button onClick={() => actions.go(`/feed?profile=${activated.id}`)}>
            Go to feed <ArrowRight />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setActivated(null);
              actions.begin();
            }}
          >
            Create another profile
          </Button>
        </div>
      </div>
    );
  if (!draft)
    return (
      <div className="empty-panel">
        <h1>Create monitoring profile</h1>
        <Button onClick={actions.begin}>Start profile</Button>
        <Button variant="outline" onClick={() => actions.go("/feed")}>
          Go to feed
        </Button>
      </div>
    );
  const p = draft.profile;
  const index = Math.max(0, steps.indexOf(step));
  const count = p.topics.filter((t) => t.selected).length;
  const sources = p.sources.filter((s) => s.active).length;
  const next = async () => {
    if (index === 0) {
      setBusy(true);
      try {
        if (!p.sources.length)
          patch({ sources: await monitoringBackend.suggestSources(p.topics) });
        actions.go("/monitoring/new/sources");
      } finally {
        setBusy(false);
      }
    } else actions.go(`/monitoring/new/${steps[index + 1]}`);
  };
  const activate = async () => {
    if (activationLock.current) return;
    activationLock.current = true;
    setBusy(true);
    try {
      const result = draft.editing_id
        ? await monitoringBackend.updateProfile(p)
        : await monitoringBackend.createProfile(p);
      if (draft.editing_id) {
        stateStore.write({ ...stateStore.read(), draft: null });
        actions.go(`/profiles/${p.id}`);
      } else setActivated(result);
    } catch {
      toast.error(
        "Could not activate monitoring. Check the profile and try again.",
      );
    } finally {
      setBusy(false);
      activationLock.current = false;
    }
  };
  return (
    <div className="wizard">
      <div className="wizard-heading">
        <div>
          <p className="eyebrow">
            {draft.editing_id
              ? "Edit monitoring profile"
              : "Create monitoring profile"}
          </p>
          <h1>
            {
              [
                "Define topics",
                "Select sources",
                "Choose delivery",
                "Review and activate",
              ][index]
            }
          </h1>
        </div>
        <span className="step-count">Step {index + 1} of 4</span>
      </div>
      <ol className="stepper" aria-label="Profile setup progress">
        {["Topics", "Sources", "Delivery", "Review"].map((label, i) => (
          <li
            key={label}
            className={i === index ? "current" : i < index ? "complete" : ""}
          >
            <span>{i < index ? <Check /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="wizard-body">
        {index === 0 && (
          <Topics
            draft={draft}
            save={save}
            patch={patch}
            onBusy={setTopicBusy}
          />
        )}
        {index === 1 && <Sources profile={p} patch={patch} actions={actions} />}
        {index === 2 && <Delivery profile={p} patch={patch} />}
        {index === 3 && (
          <>
            <label className="field">
              Profile name
              <Input
                value={p.name}
                onChange={(e) => patch({ name: e.target.value })}
                autoComplete="off"
                placeholder=""
                maxLength={120}
              />
            </label>
            <div className="review-blocks">
              {["Topics", "Sources", "Delivery"].map((label, i) => (
                <section className="panel" key={label}>
                  <div className="section-heading">
                    <h2>{label}</h2>
                    <Button
                      variant="ghost"
                      onClick={() => actions.go(`/monitoring/new/${steps[i]}`)}
                      aria-label={`Edit ${label.toLowerCase()}`}
                    >
                      <Pencil />
                      Edit
                    </Button>
                  </div>
                  {i === 0 ? (
                    <ul>
                      {p.topics
                        .filter((t) => t.selected)
                        .map((t) => (
                          <li key={t.id}>{t.title}</li>
                        ))}
                    </ul>
                  ) : i === 1 ? (
                    <>
                      <p>{sources} active sources</p>
                      <p className="muted">
                        {p.sources
                          .filter((s) => s.active)
                          .map((s) => s.name)
                          .join(" · ")}
                      </p>
                    </>
                  ) : (
                    <p>
                      {
                        frequencies.find(
                          (f) => f[0] === p.delivery.frequency,
                        )?.[1]
                      }{" "}
                      · Email ·{" "}
                      {p.delivery.relevance_threshold === "high"
                        ? "Only high relevance"
                        : "All matches"}
                    </p>
                  )}
                </section>
              ))}
            </div>
          </>
        )}
      </div>
      <footer className="wizard-footer">
        <Button
          variant="ghost"
          onClick={() =>
            index === 0
              ? actions.go(
                  draft.editing_id ? `/profiles/${draft.editing_id}` : "/",
                )
              : actions.go(`/monitoring/new/${steps[index - 1]}`)
          }
        >
          <ArrowLeft />
          {index === 0 ? "Cancel" : "Back"}
        </Button>
        <span className="muted">
          {index === 0
            ? `${count} topics selected`
            : index === 1
              ? `${sources} sources active`
              : ""}
        </span>
        <Button
          disabled={
            busy ||
            topicBusy ||
            (index === 0 && !count) ||
            (index === 1 && !sources) ||
            (index === 3 && (!p.name.trim() || !count || !sources))
          }
          onClick={() => {
            void actions.run(index === 3 ? activate : next);
          }}
        >
          {busy
            ? "Saving…"
            : index === 3
              ? draft.editing_id
                ? "Save changes"
                : "Activate monitoring"
              : "Continue"}
          <ArrowRight />
        </Button>
      </footer>
    </div>
  );
}
function Topics({
  draft,
  save,
  patch,
  onBusy,
}: {
  draft: Draft;
  save: (d: Draft) => void;
  patch: (p: Partial<MonitoringProfile>) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [custom, setCustom] = useState(false);
  const [own, setOwn] = useState("");
  const [description, setDescription] = useState("");
  const [basis, setBasis] = useState("");
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const generate = async () => {
    if (generating || !draft.input.trim()) return;
    setGenerating(true);
    onBusy(true);
    try {
      const topics = await monitoringBackend.suggestTopics(
        draft.input + " " + draft.missing,
      );
      if (!mounted.current) return;
      const current = stateStore.read().draft;
      if (!current || current.profile.id !== draft.profile.id) return;
      save({
        ...current,
        generated: true,
        profile: {
          ...current.profile,
          topics: [
            ...topics,
            ...current.profile.topics.filter((t) => t.origin === "user"),
          ],
        },
      });
    } catch {
      toast.error("Could not suggest topics. Please try again.");
    } finally {
      setGenerating(false);
      onBusy(false);
    }
  };
  const change = (id: string, p: Partial<Topic>) =>
    patch({
      topics: draft.profile.topics.map((t) =>
        t.id === id ? { ...t, ...p } : t,
      ),
    });
  return (
    <>
      <form
        className="topic-query"
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
      >
        <label className="field">
          What should we monitor?
          <Input
            value={draft.input}
            onChange={(e) => save({ ...draft, input: e.target.value })}
            disabled={generating}
            autoComplete="off"
          />
        </label>
        <Button type="submit" disabled={generating || !draft.input.trim()}>
          {draft.generated ? <RefreshCw /> : null}
          {draft.generated ? "Regenerate" : "Suggest legal topics"}
        </Button>
      </form>
      {generating ? (
        <div className="topic-processing" role="status">
          <span className="lens-progress" />
          Turning your keywords into legal topics
        </div>
      ) : (
        <>
          {draft.generated && !draft.profile.topics.length && (
            <p className="empty-inline">
              No topics found. Add your own topic to continue.
            </p>
          )}
          <div className="topic-grid">
            {draft.profile.topics.map((t) => (
              <article
                className={`topic-card ${t.selected ? "selected" : ""}`}
                key={t.id}
              >
                <Checkbox
                  checked={t.selected}
                  onCheckedChange={(checked) =>
                    change(t.id, { selected: checked === true })
                  }
                  aria-label={`Select ${t.title}`}
                />
                <div className="topic-copy">
                  {editing === t.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (editTitle.trim()) {
                          change(t.id, { title: editTitle.trim() });
                          setEditing(null);
                        }
                      }}
                    >
                      <Input
                        aria-label="Topic title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                      />
                      <div className="actions">
                        <Button type="submit" disabled={!editTitle.trim()}>
                          Save title
                        </Button>
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => setEditing(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <h2>{t.title}</h2>
                  )}
                  <p>{t.description}</p>
                  {t.legal_basis && (
                    <p className="legal-basis">{t.legal_basis}</p>
                  )}
                  <div className="topic-actions">
                    <Button
                      variant="ghost"
                      aria-label={`Edit ${t.title}`}
                      onClick={() => {
                        setEditing(t.id);
                        setEditTitle(t.title);
                      }}
                    >
                      <Pencil />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Delete ${t.title}`}
                      onClick={() =>
                        patch({
                          topics: draft.profile.topics.filter(
                            (x) => x.id !== t.id,
                          ),
                        })
                      }
                    >
                      <Trash2 />
                      Delete
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {draft.generated && (
        <label className="field missing-field">
          What’s missing?
          <Input
            value={draft.missing}
            onChange={(e) => save({ ...draft, missing: e.target.value })}
            placeholder=""
          />
        </label>
      )}
      <Button variant="outline" onClick={() => setCustom(!custom)}>
        <Plus />
        Add my own topic
      </Button>
      {custom && (
        <form
          className="panel custom-topic"
          onSubmit={(e) => {
            e.preventDefault();
            if (!own.trim()) return;
            patch({
              topics: [
                ...draft.profile.topics,
                {
                  id: crypto.randomUUID(),
                  title: own.trim(),
                  description: description.trim(),
                  legal_basis: basis.trim() || undefined,
                  origin: "user",
                  selected: true,
                },
              ],
            });
            setOwn("");
            setDescription("");
            setBasis("");
            setCustom(false);
          }}
        >
          <label className="field">
            Topic title
            <Input
              value={own}
              onChange={(e) => setOwn(e.target.value)}
              autoFocus
            />
          </label>
          <label className="field">
            Description (optional)
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="field">
            Legal basis (optional)
            <Input value={basis} onChange={(e) => setBasis(e.target.value)} />
          </label>
          <div className="actions">
            <Button disabled={!own.trim()}>Add topic</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCustom(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
function Sources({
  profile,
  patch,
  actions,
}: {
  profile: MonitoringProfile;
  patch: (p: Partial<MonitoringProfile>) => void;
  actions: Actions;
}) {
  const [signal, setSignal] = useState(false);
  const [type, setType] = useState("linkedin-page");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [canton, setCanton] = useState("Zurich");
  const addCanton = (value: string) => {
    setCanton(value);
    void actions.run(async () => {
      if (profile.sources.some((s) => s.canton === value)) return;
      patch({
        sources: [
          ...profile.sources,
          ...(await monitoringBackend.addCanton(value)),
        ],
      });
    });
  };
  const addSignal = () => {
    if (!validSignalUrl(url)) {
      setError("Enter a valid URL.");
      return;
    }
    patch({
      sources: [
        ...profile.sources,
        {
          id: crypto.randomUUID(),
          name: label.trim() || new URL(url).hostname,
          type: type.startsWith("linkedin")
            ? "linkedin"
            : (type as Source["type"]),
          section: "signal",
          url,
          active: true,
          requested: false,
        },
      ],
    });
    setUrl("");
    setLabel("");
    setError("");
    setSignal(false);
  };
  return (
    <>
      <div className="source-sections">
        {sections.slice(0, 3).map(([key, title]) => {
          const items = profile.sources.filter((s) => s.section === key);
          return (
            <section className="panel" key={key}>
              <div className="section-heading">
                <h2>{title}</h2>
                <span className="muted">
                  {items.filter((s) => s.active).length} of {items.length}{" "}
                  active
                </span>
              </div>
              {key === "government_cantonal" && (
                <div className="canton-control">
                  <SelectField
                    label="Canton"
                    value={canton}
                    onChange={addCanton}
                    options={cantons.map((c) => [c, c])}
                  />
                  <div className="actions">
                    {[...new Set(items.map((s) => s.canton))].map((name) => (
                      <Button
                        key={name}
                        variant="outline"
                        aria-label={`Remove canton ${name}`}
                        onClick={() => {
                          patch({
                            sources: profile.sources.filter(
                              (s) => s.canton !== name,
                            ),
                          });
                          if (canton === name)
                            setCanton(
                              profile.sources.find(
                                (s) => s.canton && s.canton !== name,
                              )?.canton || "",
                            );
                        }}
                      >
                        {name}
                        <Trash2 />
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="source-grid">
                {items.map((s) => (
                  <label key={s.id} className="source-row">
                    <span>{s.name}</span>
                    <Switch
                      checked={s.active}
                      onCheckedChange={(active) =>
                        patch({
                          sources: profile.sources.map((x) =>
                            x.id === s.id ? { ...x, active } : x,
                          ),
                        })
                      }
                      aria-label={s.name}
                    />
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <section className="panel signals">
        <div className="section-heading">
          <h2>
            Signals{" "}
            <span className="muted">
              {
                profile.sources.filter(
                  (s) => s.section === "signal" && s.active,
                ).length
              }{" "}
              of {profile.sources.filter((s) => s.section === "signal").length}{" "}
              active
            </span>
          </h2>
          <Button variant="outline" onClick={() => setSignal(!signal)}>
            <Plus />
            Add signal
          </Button>
        </div>
        {profile.sources
          .filter((s) => s.section === "signal")
          .map((s) => (
            <div key={s.id} className="signal-row">
              <div>
                <strong>{s.name}</strong>
                <p className="muted">{s.url}</p>
              </div>
              <span className="badge">{s.active ? s.type === "linkedin" ? "public posts" : "queued" : "paused"}</span>
              <Switch
                checked={s.active}
                onCheckedChange={(active) =>
                  patch({
                    sources: profile.sources.map((x) =>
                      x.id === s.id ? { ...x, active } : x,
                    ),
                  })
                }
                aria-label={`Activate signal ${s.name}`}
              />
              <Button
                variant="ghost"
                aria-label={`Remove ${s.name}`}
                onClick={() =>
                  patch({
                    sources: profile.sources.filter((x) => x.id !== s.id),
                  })
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        {signal && (
          <form
            className="signal-form"
            onSubmit={(e) => {
              e.preventDefault();
              addSignal();
            }}
          >
            <SelectField
              label="Type"
              value={type}
              onChange={setType}
              options={[
                ["linkedin-profile", "LinkedIn profile"],
                ["linkedin-page", "LinkedIn page"],
                ["website", "company website"],
                ["competitor", "competitor"],
                ["newsletter", "newsletter"],
                ["rss", "RSS"],
              ]}
            />
            <label className="field">
              URL
              <Input
                aria-invalid={!!error}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError("");
                }}
              />
            </label>
            <label className="field">
              Label (optional)
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="actions">
              <Button>Add signal</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSignal(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
function Delivery({
  profile,
  patch,
}: {
  profile: MonitoringProfile;
  patch: (p: Partial<MonitoringProfile>) => void;
}) {
  const d = profile.delivery;
  const [preview, setPreview] = useState<Update | null>(null);
  useEffect(() => {
    void monitoringBackend.getDeliveryPreview(profile).then(setPreview).catch(()=>setPreview(null));
  }, [profile]);
  return (
    <>
      <div className="delivery-layout">
        <section className="delivery-settings">
          <Choices
            label="Frequency"
            value={d.frequency}
            onChange={(frequency) =>
              patch({
                delivery: { ...d, frequency: frequency as typeof d.frequency },
              })
            }
            options={frequencies}
          />
          <fieldset className="field">
            <legend>Channel</legend>
            <div className="choice-group">
              <label className="choice selected">
                <Checkbox checked disabled />
                Email
              </label>
              <button className="choice unavailable" disabled>
                Teams — Coming soon
              </button>
              <button className="choice unavailable" disabled>
                Slack — Coming soon
              </button>
            </div>
          </fieldset>
          <Choices
            label="Relevance"
            value={d.relevance_threshold}
            onChange={(v) =>
              patch({
                delivery: { ...d, relevance_threshold: v as "high" | "all" },
              })
            }
            options={[
              ["high", "Only high relevance"],
              ["all", "All matches"],
            ]}
          />
        </section>
        <aside className="alert-preview">
          <p className="eyebrow">
            <Mail />{" "}
            {d.frequency === "weekly"
              ? "Weekly digest preview"
              : "Instant alert preview"}
          </p>
          <div className="preview-routing">
            Email · {frequencies.find((f) => f[0] === d.frequency)?.[1]}
          </div>
          <p className="muted">
            {d.relevance_threshold === "high"
              ? "Only high relevance"
              : "All matches"}
            {d.frequency === "both" ? " · Weekly digest on Monday, 07:00" : ""}
          </p>
          <hr />
          {preview && (
            <>
              <span className={`relevance ${preview.relevance}`}>{preview.relevance === "high" ? "High" : "Medium"} relevance</span>
              <h2>{preview.headline}</h2>
              <p>{preview.why_it_matters}</p>
              <p className="muted">{preview.source_name} · {preview.published_at}</p>
            </>
          )}
          {!preview && <p>No matching update to preview.</p>}
        </aside>
      </div>
      <details className="json-disclosure">
        <summary>View as JSON</summary>
        <pre>{JSON.stringify(profile, null, 2)}</pre>
      </details>
    </>
  );
}
