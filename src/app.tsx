"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Rss, Layers2, Settings2, Plus, ArrowRight } from "lucide-react";
import { toast, Toaster } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Empty } from "@/components/ui/empty";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandLockup } from "./components/brand";
import { Button } from "./components/controls";
import type { AIxConfig, MonitoringProfile, Update } from "./domain/monitoring";
import { stateStore, createDraft } from "./platform/storage";
import { monitoringBackend } from "./aix/aix-monitoring-backend";
import { recoverAIx } from "./aix/aix-operator";
import { Wizard } from "./features/wizard";
import { Feed, UpdateDetail, SourceView, Digest } from "./features/updates";
import { Profiles, SettingsPage } from "./features/profiles";
export type Actions = {
  go: (path: string) => void;
  run: (work: () => Promise<void>) => Promise<void>;
  begin: () => void;
  edit: (profile: MonitoringProfile, step: string) => void;
};
const serverSnapshot = () => null;
export default function AIxApp({ config }: { config: AIxConfig }) {
  const state = useSyncExternalStore(
    stateStore.subscribe,
    stateStore.snapshot,
    serverSnapshot,
  );
  const [path, setPath] = useState("/");
  const [query, setQuery] = useState("");
  const [model, setModel] = useState<{
    profiles: MonitoringProfile[];
    updates: Update[];
  }>({ profiles: [], updates: [] });
  const [ready, setReady] = useState(false);
  const generation = useRef(0);
  const go = useCallback((target: string) => {
    history.pushState({}, "", target);
    setPath(location.pathname);
    setQuery(location.search);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const run = useCallback(async (work: () => Promise<void>) => {
    try {
      await work();
    } catch {
      toast.error("Could not save this change. Please try again.");
    }
  }, []);
  useEffect(() => {
    stateStore.refresh();
    const sync = () => {
      setPath(location.pathname);
      setQuery(location.search);
    };
    const params = new URLSearchParams(location.search);
    if (
      config.operatorControls &&
      (params.has("reset") || params.get("state") === "empty")
    ) {
      stateStore.reset();
      history.replaceState({}, "", "/");
    } else if (
      config.operatorControls &&
      ["feed", "detail"].includes(params.get("state") || "")
    ) {
      history.replaceState(
        {},
        "",
        recoverAIx(params.get("state") as "feed" | "detail"),
      );
    }
    sync();
    const operator = (event: KeyboardEvent) => {
      if (
        config.operatorControls &&
        event.altKey &&
        event.shiftKey &&
        ["Digit0", "Digit5", "Digit6"].includes(event.code)
      ) {
        event.preventDefault();
        if (event.code === "Digit0") {
          stateStore.reset();
          go("/");
        } else go(recoverAIx(event.code === "Digit5" ? "feed" : "detail"));
      }
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("storage", stateStore.refresh);
    window.addEventListener("keydown", operator);
    if (stateStore.warning) toast.error(stateStore.warning);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("storage", stateStore.refresh);
      window.removeEventListener("keydown", operator);
    };
  }, [config.operatorControls, go]);
  useEffect(() => {
    if (!state) return;
    let alive = true;
    const request = ++generation.current;
    void (async () => {
      const profiles = await monitoringBackend.getProfiles();
      const updates = (
        await Promise.all(
          profiles.map((p) => monitoringBackend.getUpdates(p.id)),
        )
      ).flat();
      if (alive && request === generation.current) {
        setModel({ profiles, updates });
        setReady(true);
      }
    })().catch(() => {
      setReady(true);
      toast.error(
        "Could not load monitoring profiles. Please reload or create a new profile.",
      );
    });
    return () => {
      alive = false;
    };
  }, [state]);
  const begin = () => {
    void run(async () => {
      const s = stateStore.read();
      if (!s.draft || s.draft.editing_id)
        stateStore.write({
          ...s,
          draft: createDraft(structuredClone(s.account.defaults)),
        });
      go("/monitoring/new/topics");
    });
  };
  const edit = (profile: MonitoringProfile, step: string) => {
    void run(async () => {
      stateStore.write({
        ...stateStore.read(),
        draft: {
          input: "",
          missing: "",
          generated: true,
          editing_id: profile.id,
          profile: structuredClone(profile),
        },
      });
      go(`/monitoring/new/${step}`);
    });
  };
  const actions = { go, run, begin, edit };
  const { profiles, updates } = model;
  const isWizard = path.startsWith("/monitoring/");
  const activeId = new URLSearchParams(query).get("profile") || profiles[0]?.id;
  const isEmpty = !profiles.length && !isWizard && path != "/settings";
  let content;
  if (!state || !ready)
    content = (
      <div className="loading" role="status">
        Loading monitoring profiles…
      </div>
    );
  else if (isWizard)
    content = (
      <Wizard
        step={path.split("/").pop() || "topics"}
        state={state}
        actions={actions}
      />
    );
  else if (isEmpty)
    content = (
      <Empty className="first-login">
        <h1>
          Tell us what to watch.
          <br />
          <span>We handle the rest.</span>
        </h1>
        <Button onClick={begin}>
          Create monitoring profile <ArrowRight />
        </Button>
      </Empty>
    );
  else if (path.startsWith("/updates/"))
    content = (
      <UpdateDetail
        key={path}
        id={path.split("/")[2]}
        profiles={profiles}
        updates={updates}
        config={config}
        actions={actions}
      />
    );
  else if (path.startsWith("/source-records/"))
    content = (
      <SourceView id={path.split("/")[2]} config={config} actions={actions} />
    );
  else if (path.startsWith("/profiles"))
    content = (
      <Profiles
        id={path.split("/")[2]}
        profiles={profiles}
        updates={updates}
        actions={actions}
      />
    );
  else if (path.startsWith("/digest/"))
    content = (
      <Digest
        id={path.split("/")[2]}
        profiles={profiles}
        updates={updates}
        actions={actions}
      />
    );
  else if (path === "/settings")
    content = <SettingsPage state={state} config={config} actions={actions} />;
  else if (path === "/" || path === "/feed")
    content = (
      <Feed
        key={activeId || "all"}
        activeId={activeId}
        profiles={profiles}
        updates={updates}
        actions={actions}
      />
    );
  else
    content = (
      <Empty>
        <h1>Page unavailable</h1>
        <Button onClick={() => go("/feed")}>Go to feed</Button>
      </Empty>
    );
  return (
    <SidebarProvider>
      <Sidebar className="aix-sidebar" collapsible="offcanvas">
        <SidebarHeader>
          <button className="brand-link" onClick={() => go("/")}>
            <BrandLockup />
          </button>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Main navigation" className="main-nav">
            <button
              className={path === "/" || path === "/feed" ? "active" : ""}
              onClick={() => go("/feed")}
            >
              <Rss />
              Feed
              <span className="nav-count">
                {updates.filter((u) => !u.read && !u.hidden).length || ""}
              </span>
            </button>
            <button
              className={path.startsWith("/profiles") ? "active" : ""}
              onClick={() => go("/profiles")}
            >
              <Layers2 />
              Profiles
            </button>
          </nav>
          {profiles.length > 0 && (
            <div className="sidebar-profiles">
              <p>PROFILES</p>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  className={p.id === activeId ? "current-profile" : ""}
                  onClick={() => go(`/feed?profile=${p.id}`)}
                >
                  <span>{p.name}</span>
                  <span>
                    {updates.filter(
                      (u) => u.profile_id === p.id && !u.read && !u.hidden,
                    ).length || ""}
                  </span>
                </button>
              ))}
              <button className="new-profile" onClick={begin}>
                <Plus />
                New profile
              </button>
            </div>
          )}
        </SidebarContent>
        <SidebarFooter>
          <button className="settings-link" onClick={() => go("/settings")}>
            <Settings2 />
            Settings
          </button>
          <div className="account-lockup">
            <Avatar className="avatar" aria-hidden="true">
              <AvatarImage src="/images/anna-avatar.png" alt="" />
              <AvatarFallback>
                {(state?.account.name || "Anna").slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div>
              {state?.account.name || "Anna"}
              <small>{state?.account.firm || "Personal account"}</small>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="app-main">
        <header className="topbar">
          <SidebarTrigger className="mobile-menu" />
          <span>
            {isWizard
              ? "Monitoring profile"
              : path.startsWith("/profiles")
                ? "Profiles"
                : path === "/settings"
                  ? "Settings"
                  : "Monitoring"}
          </span>
          <span className="topbar-right">Helvetic Lens</span>
        </header>
        <main
          id="main-content"
          className={isWizard ? "wizard-main" : "page-main"}
        >
          {content}
        </main>
      </div>
      <Toaster richColors position="bottom-right" />
    </SidebarProvider>
  );
}
