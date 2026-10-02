"use client";
import {useI18n} from '../i18n/client';

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  Copy,
  FileDown,
  FileText,
  MessageSquare,
  Search,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty } from "@/components/ui/empty";
import {
  Button,
  Modal,
  SelectField,
  formatDate,
  sections,
} from "../components/controls";
import type {
  RuntimeConfig,
  MonitoringProfile,
  SourceRecord,
  Update,
} from "../domain/monitoring";
import type { Actions } from "../app";
import { monitoringBackend } from "../production/backend";
import { exportUpdatePDF, summaryText } from "../platform/export";
export function UpdateRows({
  updates,
  profiles,
  actions,
  history = false,
}: {
  updates: Update[];
  profiles: MonitoringProfile[];
  actions: Actions;
  history?: boolean;
}) {
 const {t:tr,locale}=useI18n();

  return (
    <div className="update-list">
      {updates.map((u) => (
        <article
          key={u.id}
          className={`update-row ${u.read ? "read" : "unread"}`}
          data-testid="update-row"
        >
          <div className="update-meta">
            <span>{u.source_section==="signal"?u.source_name:tr(u.source_name)}</span>
            <span>{u.date_kind === "discovered" ? tr("Discovered")+" " : ""}{formatDate(u.published_at,locale)}</span>
            <span className={`relevance ${u.relevance}`}>
              {u.relevance === "high" ? tr("High") : tr("Medium")}
            </span>
            {!u.read && <span className="unread-label">{tr("Unread")}</span>}
            {u.saved && <Bookmark aria-label={tr("Saved")} className="saved-icon" />}
            {history && u.hidden && <span className="badge">{tr("Not relevant")}</span>}
          </div>
          <button
            className="update-headline"
            onClick={() => actions.go(`/updates/${u.id}`)}
          >
            {u.headline}
            <ArrowUpRight />
          </button>
          <div className="update-matches">
            <span>{profiles.find((p) => p.id === u.profile_id)?.name}</span>
            <span>{u.topic_title}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
export function Feed({
  activeId,
  profiles,
  updates,
  actions,
}: {
  activeId?: string;
  profiles: MonitoringProfile[];
  updates: Update[];
  actions: Actions;
}) {
 const {t:tr,locale}=useI18n();

  const [profile, setProfile] = useState(activeId || "all");
  const [section, setSection] = useState("all");
  const [relevance, setRelevance] = useState("all");
  const [query, setQuery] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [unread, setUnread] = useState(false);
  const matched = updates.filter(
    (u) => !u.hidden && (profile === "all" || u.profile_id === profile),
  );
  const filtered = matched.filter(
    (u) =>
      (section === "all" || u.source_section === section) &&
      (relevance === "all" || u.relevance === relevance) &&
      (!unread || !u.read) &&
      (!start || u.published_at >= start) &&
      (!end || u.published_at.slice(0,10) <= end) &&
      `${u.headline} ${u.summary} ${u.why_it_matters} ${u.source_section==="signal"?u.source_name:tr(u.source_name)} ${u.topic_title}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const current = profiles.find((p) => p.id === profile);
  const clear = () => {
    setSection("all");
    setRelevance("all");
    setQuery("");
    setStart("");
    setEnd("");
    setUnread(false);
  };
  return (
    <div className="feed">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{tr("Feed")}</p>
          <h1>{current?.name || tr("All profiles")}</h1>
          <p className="muted">
            {tr("{0} new updates",{0:matched.filter(u=>!u.read).length})} {current?.status === "paused" ? " · "+tr("Monitoring paused") : ""}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => actions.go(`/profiles/${current?.id || ""}`)}
        > {tr("Manage profile")} </Button>
      </div>
      <div className="feed-toolbar">
        <div className="search-input">
          <Search />
          <Input
            aria-label={tr("Search updates")}
            placeholder={tr("Search updates")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="feed-filters">
          <SelectField
            label={tr("Profile")} translateOptions={false}
            value={profile}
            onChange={setProfile}
            options={[
              ["all", tr("All profiles")],
              ...profiles.map((p) => [p.id, p.name] as [string, string]),
            ]}
          />
          <SelectField
            label={tr("Source section")}
            value={section}
            onChange={setSection}
            options={[["all", "All sources"], ...sections]}
          />
          <SelectField
            label={tr("Relevance")}
            value={relevance}
            onChange={setRelevance}
            options={[
              ["all", "All relevance"],
              ["high", "High"],
              ["medium", "Medium"],
            ]}
          />
          <label className="field">
            {tr("From")}
            <Input
              type="date"
              aria-label={tr("From date")}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="field"> {tr("To")} <Input
              type="date"
              aria-label={tr("To date")}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <div className="filter-bottom">
          <label className="check-label">
            <Checkbox
              checked={unread}
              onCheckedChange={(v) => setUnread(v === true)}
            /> {tr("Unread only")} </label>
          <span className="muted">{tr("{0} updates",{0:filtered.length})}</span>
          {(query ||
            section !== "all" ||
            relevance !== "all" ||
            start ||
            end ||
            unread) && (
            <Button variant="ghost" onClick={clear}> {tr("Clear filters")} </Button>
          )}
        </div>
      </div>
      {start && end && start > end ? (
        <p role="alert" className="error"> {tr("The end date must be on or after the start date.")} </p>
      ) : filtered.length ? (
        <UpdateRows updates={filtered} profiles={profiles} actions={actions} />
      ) : (
        <Empty>
          <h2>{tr("No updates match")}</h2>
          <Button variant="outline" onClick={clear}> {tr("Clear filters")} </Button>
        </Empty>
      )}
    </div>
  );
}
export function UpdateDetail({
  id,
  profiles,
  updates,
  config,
  actions,
}: {
  id: string;
  profiles: MonitoringProfile[];
  updates: Update[];
  config: RuntimeConfig;
  actions: Actions;
}) {
 const {t:tr,locale}=useI18n();

  const u = updates.find((u) => u.id === id);
  const profile = profiles.find((p) => p.id === u?.profile_id);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(u?.note || "");
  const [feedback, setFeedback] = useState(false);
  const [reason, setReason] = useState("");
  const [pdf, setPdf] = useState(false);
  const [includeNote, setIncludeNote] = useState(false);
  const [copyFailure, setCopyFailure] = useState(false);
  useEffect(() => {
    if (u) void actions.run(() => monitoringBackend.markRead(id));
  }, [id, !!u]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!u)
    return (
      <Empty>
        <h1>{tr("Update unavailable")}</h1>
        <Button onClick={() => actions.go("/feed")}>{tr("Go to feed")}</Button>
      </Empty>
    );
  const text = summaryText(u, config.summaryNotice,locale);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(tr("Summary copied"));
    } catch {
      setCopyFailure(true);
    }
  };
  return (
    <div className="update-detail">
      <Button
        variant="ghost"
        className="back-link"
        onClick={() => actions.go(`/feed?profile=${u.profile_id}`)}
      >
        <ArrowLeft /> {tr("Back to feed")} </Button>
      <div className="detail-heading">
        <div className="update-meta">
          <span>{u.source_section==="signal"?u.source_name:tr(u.source_name)}</span>
          <span>{u.date_kind === "discovered" ? tr("Discovered")+" " : ""}{formatDate(u.published_at,locale)}</span>
          <span className={`relevance ${u.relevance}`}>
            {tr(u.relevance==="high"?"High relevance":"Medium relevance")}
          </span>
        </div>
        <h1>{u.headline}</h1>
        <div className="detail-provenance">
          <div>
            <span>{tr("Matched topic")}</span>
            <strong>{u.topic_title}</strong>
          </div>
          <div>
            <span>{tr("Legal basis")}</span>
            <strong>{u.legal_basis==="Not specified in the source"?tr(u.legal_basis):u.legal_basis}</strong>
          </div>
        </div>
      </div>
      <div className="detail-layout">
        <div>
          <section className="impact-section">
            <p className="eyebrow">{profile?.name || u.client_name}</p>
            <h2>{tr("Why it matters for {0}",{0:u.client_name})}</h2>
            <p>{u.why_it_matters}</p>
          </section>
          <section className="summary-section">
            <h2>{tr("Summary")}</h2>
            <p>{u.summary}</p>
          </section>
          {u.note && !noteOpen && (
            <section className="private-note">
              <h2>{tr("Private note")}</h2>
              <p>{u.note}</p>
              <Button
                variant="ghost"
                onClick={() => {
                  setNote(u.note || "");
                  setNoteOpen(true);
                }}
              > {tr("Edit note")} </Button>
            </section>
          )}
          {noteOpen && (
            <form
              className="private-note"
              onSubmit={(e) => {
                e.preventDefault();
                void actions.run(async () => {
                  await monitoringBackend.addNote(id, note);
                  setNoteOpen(false);
                  toast.success(tr("Private note saved"));
                });
              }}
            >
              <label className="field"> {tr("Private note")} <Textarea
                  aria-label={tr("Private note")}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  autoFocus
                />
              </label>
              <div className="actions">
                <Button>{tr("Save note")}</Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setNoteOpen(false)}
                > {tr("Cancel")} </Button>
              </div>
            </form>
          )}
          {copyFailure && (
            <div className="copy-fallback">
              <p role="alert"> {tr("Could not copy. Select the text and copy it manually.")} </p>
              <Textarea
                readOnly
                value={text}
                aria-label={tr("Summary to copy")}
                onFocus={(e) => e.target.select()}
                rows={9}
              />
            </div>
          )}
          <div className="feedback-bar">
            <span>{tr("Was this relevant?")}</span>
            <Button
              variant={u.feedback === "relevant" ? "secondary" : "ghost"}
              onClick={() => {
                void actions.run(async () => {
                  await monitoringBackend.submitFeedback(id, "relevant");
                  toast.success(tr("Feedback saved"));
                });
              }}
            >
              <ThumbsUp /> {tr("Relevant")}{u.feedback === "relevant" && <Check />}
            </Button>
            <Button
              variant={u.feedback === "not_relevant" ? "secondary" : "ghost"}
              onClick={() => setFeedback(true)}
            >
              <ThumbsDown /> {tr("Not relevant")} </Button>
          </div>
          {config.summaryNotice && (
            <p className="scenario-note">{tr("AI-assisted summary — consult the original source.")}</p>
          )}
        </div>
        <aside className="detail-actions">
          <Button onClick={() => void copy()}>
            <Copy /> {tr("Copy summary")} </Button>
          <Button
            variant="outline"
            onClick={() =>
              void actions.run(() => monitoringBackend.saveUpdate(id, !u.saved))
            }
          >
            <Bookmark fill={u.saved ? "currentColor" : "none"} />
            {u.saved ? tr("Saved") : tr("Save")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setNote(u.note || "");
              setNoteOpen(true);
            }}
          >
            <MessageSquare /> {tr("Add private note")} </Button>
          <Button variant="outline" onClick={() => setPdf(true)}>
            <FileDown /> {tr("Export PDF")} </Button>
          <div className="source-actions">
          {u.url&&<Button variant="ghost" asChild><a href={u.url} target="_blank" rel="noopener noreferrer">{tr("Original source")}<ArrowUpRight /></a></Button>}
          <Button
            variant="ghost"
            onClick={() => actions.go(`/source-records/${id}`)}
          >
            <FileText /> {tr("Saved copy")} </Button>
          </div>
        </aside>
      </div>
      <Modal
        title={tr("Not relevant")}
        description={tr("This update will be hidden from the feed and kept in profile history.")}
        open={feedback}
        onClose={() => setFeedback(false)}
      >
        <label className="field"> {tr("Reason (optional)")} <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <div className="actions">
          <Button variant="outline" onClick={() => setFeedback(false)}> {tr("Cancel")} </Button>
          <Button
            onClick={() =>
              void actions.run(async () => {
                await monitoringBackend.submitFeedback(
                  id,
                  "not_relevant",
                  reason,
                );
                setFeedback(false);
                toast.success(tr("Feedback saved"));
              })
            }
          > {tr("Confirm feedback")} </Button>
        </div>
      </Modal>
      <Modal
        title={tr("Export PDF")}
        description={tr("Download the update, its source details, and profile-specific impact.")}
        open={pdf}
        onClose={() => setPdf(false)}
      >
        {u.note && (
          <label className="check-label">
            <Checkbox
              checked={includeNote}
              onCheckedChange={(v) => setIncludeNote(v === true)}
            /> {tr("Include private note")} </label>
        )}
        <div className="actions">
          <Button variant="outline" onClick={() => setPdf(false)}> {tr("Cancel")} </Button>
          <Button
            onClick={() => {
              void exportUpdatePDF(u, includeNote, config.summaryNotice,locale)
                .then(() => {
                  setPdf(false);
                  toast.success(tr("PDF exported"));
                })
                .catch(() => toast.error(tr("Could not create the PDF.")));
            }}
          > {tr("Download PDF")} </Button>
        </div>
      </Modal>
    </div>
  );
}
export function SourceView({
  id,
  config,
  actions,
}: {
  id: string;
  config: RuntimeConfig;
  actions: Actions;
}) {
 const {t:tr,locale}=useI18n();

  const [record, setRecord] = useState<SourceRecord | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void monitoringBackend
      .getSourceRecord(id)
      .then((r) => {
        if (active) setRecord(r);
      })
      .catch(() => setError(true));
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <div className="source-record">
      <Button variant="ghost" onClick={() => actions.go(`/updates/${id}`)}>
        <ArrowLeft /> {tr("Back to update")} </Button>
      {error ? (
        <h1>{tr("Saved copy unavailable")}</h1>
      ) : record ? (
        <>
          <p className="eyebrow">{tr("Saved copy")}</p>
          <h1>{record.title}</h1>
          <dl>
            <dt>{tr("Source")}</dt>
            <dd>{record.update.source_section==="signal"?record.update.source_name:tr(record.update.source_name)}</dd>
            <dt>{record.update.date_kind==='discovered'?tr("Discovered"):tr("Published")}</dt>
            <dd>{formatDate(record.update.published_at,locale)}</dd>
            <dt>{tr("Legal basis")}</dt>
            <dd>{record.update.legal_basis==="Not specified in the source"?tr(record.update.legal_basis):record.update.legal_basis}</dd>
          </dl>
          {record.update.url && <p><a href={record.update.url} target="_blank" rel="noopener noreferrer">{tr("Open original publication ↗")}</a></p>}
          <section>
            <h2>{tr("Saved source text")}</h2>
            {record.body.split(/\n{2,}/).map((paragraph,index)=><p key={index}>{paragraph}</p>)}
          </section>
          {config.summaryNotice && (
            <p className="scenario-note">{tr(record.disclosure)}</p>
          )}
        </>
      ) : (
        <p role="status">{tr("Loading saved copy…")}</p>
      )}
    </div>
  );
}
export function Digest({
  id,
  profiles,
  updates,
  actions,
}: {
  id: string;
  profiles: MonitoringProfile[];
  updates: Update[];
  actions: Actions;
}) {
 const {t:tr,locale}=useI18n();

  const p = profiles.find((p) => p.id === id);
  const items = updates
    .filter((u) => u.profile_id === id && !u.hidden && (p?.delivery.relevance_threshold === "all" || u.relevance === "high"))
    .sort((a, b) =>
      a.relevance === b.relevance
        ? b.published_at.localeCompare(a.published_at)
        : a.relevance === "high"
          ? -1
          : 1,
    );
  if (!p)
    return (
      <Empty>
        <h1>{tr("Profile unavailable")}</h1>
        <Button onClick={() => actions.go("/profiles")}>{tr("Profiles")}</Button>
      </Empty>
    );
  return (
    <div className="digest">
      <Button variant="ghost" onClick={() => actions.go(`/profiles/${id}`)}>
        <ArrowLeft /> {tr("Back to profile")} </Button>
      <p className="eyebrow">{tr("Email digest preview")}</p>
      <h1>{tr("Legal Feed: {0} updates for {1}",{0:items.length,1:p.name.split(":")[0]})}
      </h1>
      <h2>{p.name}</h2>
      {!items.length && <p className="muted">{tr("No updates yet.")}</p>}
      {items.map((u) => (
        <article key={u.id}>
          <span className={`relevance ${u.relevance}`}>
            {u.relevance === "high" ? tr("High") : tr("Medium")}
          </span>
          <button
            className="update-headline"
            onClick={() => actions.go(`/updates/${u.id}`)}
          >
            {u.headline}
          </button>
          <p>{u.why_it_matters}</p>
        </article>
      ))}
      <div className="actions">
        <Button variant="outline" onClick={() => actions.go(`/profiles/${id}`)}> {tr("Manage this profile")} </Button>
        <Button variant="ghost" onClick={() => actions.edit(p, "delivery")}> {tr("Change frequency")} </Button>
      </div>
    </div>
  );
}
