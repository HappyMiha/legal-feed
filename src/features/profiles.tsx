"use client";
import { useState } from "react";
import {
  ArrowLeft,
  Copy,
  Download,
  Mail,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import {
  Button,
  Choices,
  Modal,
  frequencies,
  formatDate,
} from "../components/controls";
import type {
  AIxConfig,
  AIxState,
  Account,
  MonitoringProfile,
  Update,
} from "../domain/monitoring";
import type { Actions } from "../app";
import { monitoringBackend } from "../aix/aix-monitoring-backend";
import { stateStore } from "../platform/storage";
import { downloadBlob } from "../platform/export";
import { UpdateRows } from "./updates";
export function Profiles({
  id,
  profiles,
  updates,
  actions,
}: {
  id?: string;
  profiles: MonitoringProfile[];
  updates: Update[];
  actions: Actions;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const p = profiles.find((p) => p.id === id);
  if (!id)
    return (
      <>
        <div className="page-heading">
          <h1>Profiles</h1>
          <Button onClick={actions.begin}>
            <Plus />
            New profile
          </Button>
        </div>
        <div className="profile-list">
          {profiles.map((p) => (
            <article className="panel" key={p.id}>
              <div>
                <span className={`badge ${p.status}`}>{p.status}</span>
                <h2>
                  <button onClick={() => actions.go(`/profiles/${p.id}`)}>
                    {p.name}
                  </button>
                </h2>
                <p className="muted">
                  {p.topics.filter((t) => t.selected).length} topics ·{" "}
                  {p.sources.filter((s) => s.active).length} sources
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => actions.go(`/profiles/${p.id}`)}
              >
                Manage profile
              </Button>
            </article>
          ))}
        </div>
      </>
    );
  if (!p)
    return (
      <Empty>
        <h1>Profile unavailable</h1>
        <Button onClick={() => actions.go("/profiles")}>All profiles</Button>
      </Empty>
    );
  return (
    <div className="profile-detail">
      <Button variant="ghost" onClick={() => actions.go("/profiles")}>
        <ArrowLeft />
        All profiles
      </Button>
      <div className="page-heading">
        <div>
          <span className={`badge ${p.status}`}>{p.status}</span>
          <h1>{p.name}</h1>
          <p className="muted">Created {formatDate(p.created_at)}</p>
        </div>
        <div className="actions">
          <Button
            variant="outline"
            onClick={() =>
              void actions.run(async () => {
                await monitoringBackend.updateProfile({
                  ...p,
                  status: p.status === "active" ? "paused" : "active",
                });
                toast.success(
                  p.status === "active"
                    ? "Monitoring paused"
                    : "Monitoring resumed",
                );
              })
            }
          >
            {p.status === "active" ? <Pause /> : <Play />}
            {p.status === "active" ? "Pause" : "Resume"}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void actions.run(async () => {
                const copy = await monitoringBackend.duplicateProfile(p.id);
                actions.go(`/profiles/${copy.id}`);
              })
            }
          >
            <Copy />
            Duplicate
          </Button>
          <Button variant="ghost" onClick={() => setDeleting(true)}>
            <Trash2 />
            Delete
          </Button>
        </div>
      </div>
      <div className="review-blocks">
        {["Topics", "Sources", "Delivery"].map((label, index) => (
          <section className="panel" key={label}>
            <div className="section-heading">
              <h2>{label}</h2>
              <Button
                variant="ghost"
                onClick={() => actions.edit(p, label.toLowerCase())}
              >
                <Pencil />
                Edit {label.toLowerCase()}
              </Button>
            </div>
            {index === 0 ? (
              <ul>
                {p.topics
                  .filter((t) => t.selected)
                  .map((t) => (
                    <li key={t.id}>{t.title}</li>
                  ))}
              </ul>
            ) : index === 1 ? (
              <p>
                {p.sources
                  .filter((s) => s.active)
                  .map((s) => s.name + (s.requested ? " (requested)" : ""))
                  .join(" · ")}
              </p>
            ) : (
              <>
                <p>
                  {frequencies.find((f) => f[0] === p.delivery.frequency)?.[1]}{" "}
                  · Email ·{" "}
                  {p.delivery.relevance_threshold === "high"
                    ? "Only high relevance"
                    : "All matches"}
                </p>
                <Button
                  variant="ghost"
                  onClick={() => actions.go(`/digest/${p.id}`)}
                >
                  <Mail />
                  Preview digest
                </Button>
              </>
            )}
          </section>
        ))}
      </div>
      <section className="history">
        <h2>History</h2>
        {updates.some((u) => u.profile_id === id) ? (
          <UpdateRows
            updates={updates.filter((u) => u.profile_id === id)}
            profiles={profiles}
            actions={actions}
            history
          />
        ) : (
          <p className="muted">No updates yet.</p>
        )}
      </section>
      <Modal
        destructive
        title="Delete monitoring profile"
        description={`This removes the profile, its updates, saved states, and private notes. Type ${p.name} to confirm.`}
        open={deleting}
        onClose={() => setDeleting(false)}
      >
        <label className="field">
          Profile name
          <Input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <div className="actions">
          <Button variant="outline" onClick={() => setDeleting(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirmation !== p.name}
            onClick={() =>
              void actions.run(async () => {
                await monitoringBackend.deleteProfile(p.id, confirmation);
                setDeleting(false);
                actions.go("/profiles");
              })
            }
          >
            Delete profile
          </Button>
        </div>
      </Modal>
    </div>
  );
}
async function passwordHash(password: string, salt: string) {
  const bytes = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    bytes.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: bytes.encode(salt),
      iterations: 150000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function SettingsPage({
  state,
  config,
  actions,
}: {
  state: AIxState;
  config: AIxConfig;
  actions: Actions;
}) {
  const [account, setAccount] = useState<Account>(state.account);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const save = () => {
    stateStore.write({
      ...stateStore.read(),
      account: {
        ...account,
        password_hash: stateStore.read().account.password_hash,
        password_salt: stateStore.read().account.password_salt,
      },
    });
    toast.success("Settings saved");
  };
  const changePassword = async () => {
    setWorking(true);
    setError("");
    try {
      const existing = stateStore.read().account;
      if (
        existing.password_hash &&
        (await passwordHash(currentPassword, existing.password_salt!)) !==
          existing.password_hash
      ) {
        setError("The current password is incorrect.");
        return;
      }
      if (password.length < 8) {
        setError("Use at least 8 characters.");
        return;
      }
      const salt = crypto.randomUUID();
      stateStore.write({
        ...stateStore.read(),
        account: {
          ...existing,
          password_salt: salt,
          password_hash: await passwordHash(password, salt),
        },
      });
      setPasswordOpen(false);
      setPassword("");
      setCurrentPassword("");
      toast.success("Local password saved");
    } finally {
      setWorking(false);
    }
  };
  const deleteAccount = async () => {
    setWorking(true);
    try {
      const a = stateStore.read().account;
      if (
        !a.password_hash ||
        (await passwordHash(password, a.password_salt!)) !== a.password_hash
      ) {
        setError("The password is incorrect.");
        return;
      }
      stateStore.reset();
      setDeleteOpen(false);
      actions.go("/");
      toast.success("Account data cleared");
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="settings-page">
      <div className="page-heading">
        <h1>Settings</h1>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void actions.run(async () => save());
        }}
      >
        <section className="settings-section">
          <h2>Account</h2>
          <div className="settings-fields">
            <label className="field">
              Name
              <Input
                value={account.name}
                required
                onChange={(e) =>
                  setAccount({ ...account, name: e.target.value })
                }
              />
            </label>
            <label className="field">
              Email
              <Input
                type="email"
                value={account.email}
                onChange={(e) =>
                  setAccount({ ...account, email: e.target.value })
                }
              />
            </label>
            <label className="field">
              Firm
              <Input
                value={account.firm}
                onChange={(e) =>
                  setAccount({ ...account, firm: e.target.value })
                }
              />
            </label>
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError("");
                  setPassword("");
                  setPasswordOpen(true);
                }}
              >
                {state.account.password_hash
                  ? "Change password"
                  : "Set password"}
              </Button>
              <p className="muted">Local account data protection.</p>
            </div>
          </div>
        </section>
        <section className="settings-section">
          <h2>Notification defaults</h2>
          <div className="settings-fields">
            <Choices
              label="Default frequency"
              value={account.defaults.frequency}
              onChange={(v) =>
                setAccount({
                  ...account,
                  defaults: {
                    ...account.defaults,
                    frequency: v as typeof account.defaults.frequency,
                  },
                })
              }
              options={frequencies}
            />
            <div className="field">
              <span>Channel</span>
              <span>Email</span>
            </div>
            <label className="field">
              Quiet hours from
              <Input
                type="time"
                value={account.quiet_start}
                onChange={(e) =>
                  setAccount({ ...account, quiet_start: e.target.value })
                }
              />
            </label>
            <label className="field">
              Quiet hours to
              <Input
                type="time"
                value={account.quiet_end}
                onChange={(e) =>
                  setAccount({ ...account, quiet_end: e.target.value })
                }
              />
            </label>
          </div>
        </section>
        <section className="settings-section">
          <h2>Language</h2>
          <div className="actions">
            <Button type="button" variant="secondary" aria-pressed>
              EN
            </Button>
            <Button type="button" variant="outline" disabled>
              DE — unavailable
            </Button>
            <Button type="button" variant="outline" disabled>
              FR — unavailable
            </Button>
          </div>
        </section>
        <Button type="submit">Save settings</Button>
      </form>
      <section className="settings-section hosting">
        <h2>Data and hosting</h2>
        <dl>
          <dt>Processing model</dt>
          <dd>{config.processingModel}</dd>
          <dt>Deployment</dt>
          <dd>{config.deployment}</dd>
          <dt>Hosting location</dt>
          <dd>{config.hostingLocation}</dd>
        </dl>
        <p className="muted">
          Profiles and private notes are stored in this browser.
        </p>
      </section>
      <section className="settings-section">
        <h2>Privacy</h2>
        <div className="actions">
          <Button
            variant="outline"
            onClick={() => {
              const data = structuredClone(stateStore.read());
              delete data.account.password_hash;
              delete data.account.password_salt;
              downloadBlob(
                new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                }),
                "helvetic-lens-aix-data.json",
              );
            }}
          >
            <Download />
            Export my data
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setError("");
              setPassword("");
              setConfirmation("");
              setDeleteOpen(true);
            }}
          >
            <Trash2 />
            Delete account
          </Button>
        </div>
      </section>
      <Modal
        title="Set local password"
        description="This password confirms deletion of account data in this browser. It does not sign you in to an external service."
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void actions.run(changePassword);
          }}
        >
          {state.account.password_hash && (
            <label className="field">
              Current password
              <Input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
          )}
          <label className="field">
            New password
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPasswordOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={working}>Save password</Button>
          </div>
        </form>
      </Modal>
      <Modal
        destructive
        title="Delete account"
        description="This clears account details, profiles, updates, and notes saved in this browser. Type DELETE and enter your local password."
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      >
        {state.account.password_hash ? (
          <>
            <label className="field">
              Password
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="field">
              Confirmation
              <Input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="actions">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={confirmation !== "DELETE" || !password || working}
                onClick={() => void actions.run(deleteAccount)}
              >
                Delete account data
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>Set a local password before deleting account data.</p>
            <div className="actions">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setDeleteOpen(false);
                  setPasswordOpen(true);
                }}
              >
                Set password
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
