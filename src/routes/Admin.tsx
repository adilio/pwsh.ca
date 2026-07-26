import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Logo } from "../components/Logo";
import { ApiKeysPanel } from "../components/ApiKeysPanel";
import { MembersPanel } from "../components/MembersPanel";
import {
  api,
  ApiError,
  canModify,
  ROLE_LABEL,
  type LinkRow,
  type Member,
} from "../lib/api";

/** Problems the OAuth callback can hand back via ?error=. */
const SIGN_IN_ERRORS: Record<string, string> = {
  github_declined: "GitHub sign-in was cancelled.",
  bad_state: "That sign-in attempt expired. Please try again.",
  exchange_failed: "GitHub would not complete the sign-in. Please try again.",
  profile_failed: "Could not read your GitHub profile. Please try again.",
};

type Phase =
  | { kind: "loading" }
  | { kind: "signedOut" }
  | { kind: "member"; user: Member };

export default function Admin() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [signInError, setSignInError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const session = await api.me();
      setPhase(
        session.signedIn
          ? { kind: "member", user: session.user }
          : { kind: "signedOut" },
      );
    } catch {
      setPhase({ kind: "signedOut" });
    }
  }, []);

  useEffect(() => {
    // The OAuth callback redirects here with ?error=… when something went
    // wrong; show it, then tidy the URL so a reload doesn't repeat it.
    const params = new URLSearchParams(window.location.search);
    const problem = params.get("error");
    if (problem) {
      setSignInError(SIGN_IN_ERRORS[problem] ?? "Sign-in did not complete.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    void load();
  }, [load]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Even if the call fails, drop back to the signed-out view.
    }
    setPhase({ kind: "signedOut" });
  }, []);

  if (phase.kind === "loading") {
    return (
      <section className="admin admin-gate">
        <div className="admin-empty admin-loading">
          <span className="loading-dot" aria-hidden="true" />
          Checking your session…
        </div>
      </section>
    );
  }

  if (phase.kind === "signedOut") {
    return <SignInGate error={signInError} />;
  }

  const { user } = phase;
  if (user.status === "pending") {
    return <PendingCard user={user} onSignOut={signOut} onRefresh={load} />;
  }
  if (user.status === "denied") {
    return <DeniedCard onSignOut={signOut} />;
  }
  return <Workspace user={user} onSignOut={signOut} />;
}

function SignInGate({ error }: { error: string | null }) {
  return (
    <section className="admin admin-gate">
      <div className="gate-card">
        <div className="gate-mark" aria-hidden="true">
          <Logo />
        </div>
        <h1>Short links, kept simple.</h1>
        <p className="admin-sub">
          Sign in with GitHub to manage pwsh.ca links. New accounts need an
          approval from the site owner before they can make changes.
        </p>
        <a className="button button-primary gate-signin" href="/api/auth/github">
          Sign in with GitHub
        </a>
        {error && (
          <p className="form-message form-error" role="alert">
            {error}
          </p>
        )}
        <p className="gate-footnote">
          We read your GitHub username and verified email. Nothing else.
        </p>
      </div>
    </section>
  );
}

function PendingCard({
  user,
  onSignOut,
  onRefresh,
}: {
  user: Member;
  onSignOut: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [reason, setReason] = useState(user.reason ?? "");
  const [sent, setSent] = useState(Boolean(user.reason));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.requestAccess(reason.trim());
      setSent(true);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not send that just now.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin admin-gate">
      <div className="gate-card">
        <div className="gate-mark" aria-hidden="true">
          <Logo />
        </div>
        <h1>Waiting on approval</h1>
        <p className="admin-sub">
          You're signed in as <strong>@{user.githubLogin}</strong>. The site
          owner reviews requests by hand — you'll get access once they approve
          yours.
        </p>

        {sent ? (
          <p className="form-message form-notice">
            Your request is in the queue. Check back later.
          </p>
        ) : (
          <form onSubmit={submit} className="gate-form">
            <label className="field-group">
              <span className="field-label">
                Anything to add? <span>Optional</span>
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Who you are and what you'd use short links for."
                maxLength={500}
                rows={3}
              />
            </label>
            <button className="button button-primary" disabled={busy}>
              {busy ? "Sending…" : "Send request"}
            </button>
          </form>
        )}

        {error && (
          <p className="form-message form-error" role="alert">
            {error}
          </p>
        )}

        <div className="gate-actions">
          <button className="text-action" onClick={() => void onRefresh()}>
            Check again
          </button>
          <button className="text-action" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </section>
  );
}

function DeniedCard({ onSignOut }: { onSignOut: () => void }) {
  return (
    <section className="admin admin-gate">
      <div className="gate-card">
        <div className="gate-mark" aria-hidden="true">
          <Logo />
        </div>
        <h1>No access yet</h1>
        <p className="admin-sub">
          This account isn't approved to manage pwsh.ca links. If you think
          that's a mistake, get in touch with the site owner.
        </p>
        <div className="gate-actions">
          <button className="text-action" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </section>
  );
}

function Workspace({
  user,
  onSignOut,
}: {
  user: Member;
  onSignOut: () => void;
}) {
  const [tab, setTab] = useState<"links" | "keys" | "members">("links");
  const isOwner = user.role === "owner";

  return (
    <section className="admin">
      <header className="admin-header">
        <div className="admin-heading">
          <h1>Short links</h1>
          <p className="admin-sub">
            One short address for every long way around.
          </p>
        </div>
        <div className="admin-header-actions">
          <span className="who">
            {user.avatarUrl && (
              <img
                className="who-avatar"
                src={user.avatarUrl}
                alt=""
                width={24}
                height={24}
              />
            )}
            @{user.githubLogin}
            {user.role !== "member" && (
              <span className="who-role">{ROLE_LABEL[user.role]}</span>
            )}
          </span>
          <button className="button button-ghost" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Workspace sections">
        <button
          className={`admin-tab${tab === "links" ? " admin-tab-active" : ""}`}
          onClick={() => setTab("links")}
          aria-current={tab === "links"}
        >
          Links
        </button>
        <button
          className={`admin-tab${tab === "keys" ? " admin-tab-active" : ""}`}
          onClick={() => setTab("keys")}
          aria-current={tab === "keys"}
        >
          API keys
        </button>
        {isOwner && (
          <button
            className={`admin-tab${tab === "members" ? " admin-tab-active" : ""}`}
            onClick={() => setTab("members")}
            aria-current={tab === "members"}
          >
            Members
          </button>
        )}
      </nav>

      {tab === "links" && <LinkManager user={user} onAuthLost={onSignOut} />}
      {tab === "keys" && <ApiKeysPanel onAuthLost={onSignOut} />}
      {tab === "members" && isOwner && <MembersPanel onAuthLost={onSignOut} />}
    </section>
  );
}

function LinkManager({
  user,
  onAuthLost,
}: {
  user: Member;
  onAuthLost: () => void;
}) {
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newUrl, setNewUrl] = useState("");
  const [newCode, setNewCode] = useState("");
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const fail = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof ApiError && err.status === 401) {
        onAuthLost();
        return;
      }
      setError(err instanceof ApiError ? err.message : fallback);
    },
    [onAuthLost],
  );

  const refresh = useCallback(async () => {
    try {
      setLinks(await api.list());
      setError(null);
    } catch (err) {
      fail(err, "Could not load links.");
    }
  }, [fail]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const made = await api.create(newUrl.trim(), newCode.trim() || undefined);
      setNewUrl("");
      setNewCode("");
      setNotice(`Created ${made.shortUrl}`);
      await refresh();
    } catch (err) {
      fail(err, "Could not create the link.");
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(code: string) {
    setError(null);
    setNotice(null);
    try {
      await api.update(code, editUrl.trim());
      setEditing(null);
      setNotice(`Updated /${code}`);
      await refresh();
    } catch (err) {
      fail(err, "Could not update the link.");
    }
  }

  async function remove(code: string) {
    if (!window.confirm(`Delete /${code}? This cannot be undone.`)) return;
    setError(null);
    setNotice(null);
    try {
      await api.remove(code);
      setNotice(`Deleted /${code}`);
      await refresh();
    } catch (err) {
      fail(err, "Could not delete the link.");
    }
  }

  async function copy(code: string) {
    const shortUrl = `${window.location.origin}/${code}`;
    await navigator.clipboard.writeText(shortUrl);
    setNotice(`Copied ${shortUrl}`);
    // The chip flashes kiln for a beat, then fades back on its own.
    setCopied(code);
    window.setTimeout(() => setCopied((c) => (c === code ? null : c)), 400);
  }

  return (
    <>
      <div className="create-panel">
        <div className="create-panel-heading">
          <div>
            <h2>Create a short link</h2>
            <p>
              Paste a destination and choose a memorable ending if you want one.
            </p>
          </div>
          <span className="domain-stamp">{window.location.host}/</span>
        </div>
        <form onSubmit={create} className="create-form">
          <label className="field-group create-url">
            <span className="field-label">Destination URL</span>
            <input
              type="url"
              required
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.com/a/very/long/path"
              aria-label="Target URL"
            />
          </label>
          <label className="field-group create-code">
            <span className="field-label">
              Custom code <span>Optional</span>
            </span>
            <span className="prefixed-input">
              <span aria-hidden="true">/</span>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="launch-notes"
                aria-label="Custom code"
                pattern="[A-Za-z0-9_-]{1,64}"
              />
            </span>
          </label>
          <button
            className="button button-primary create-button"
            disabled={creating || !newUrl.trim()}
          >
            {creating ? "Creating…" : "Create short link"}
          </button>
        </form>
      </div>

      <div className="message-region" aria-live="polite">
        {notice && <p className="form-message form-notice">{notice}</p>}
        {error && (
          <p className="form-message form-error" role="alert">
            {error}
          </p>
        )}
      </div>

      {links === null ? (
        <div className="admin-empty admin-loading">
          <span className="loading-dot" aria-hidden="true" />
          Loading your links…
        </div>
      ) : links.length === 0 ? (
        <div className="admin-empty">
          <strong>The link shelf is empty.</strong>
          <span>Create the first one above—it only takes a destination.</span>
        </div>
      ) : (
        <div className="links-section">
          <div className="links-section-heading">
            <h2>All links</h2>
            <p>Click a short code to copy it.</p>
          </div>
          <div className="links-list">
            {links.map((link) => (
              <article className="link-row" key={link.code}>
                <div className="link-row-code">
                  <span className="link-row-label">Short link</span>
                  <div className="short-link-line">
                    <span className="short-link-host">
                      {window.location.host}
                    </span>
                    <button
                      className={`code-chip${
                        copied === link.code ? " code-chip-copied" : ""
                      }`}
                      onClick={() => void copy(link.code)}
                      aria-label={`Copy ${window.location.host}/${link.code}`}
                    >
                      /{link.code}
                    </button>
                    <span className="copy-hint" aria-hidden="true">
                      {copied === link.code ? "Copied" : "Copy"}
                    </span>
                  </div>
                </div>
                <div className="link-row-target">
                  <span className="link-row-label">Destination</span>
                  {editing === link.code ? (
                    <div className="edit-row">
                      <input
                        type="url"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        aria-label={`New target for ${link.code}`}
                        autoFocus
                      />
                      <div className="edit-actions">
                        <button
                          className="button button-small button-primary"
                          onClick={() => void saveEdit(link.code)}
                          disabled={!editUrl.trim()}
                        >
                          Save
                        </button>
                        <button
                          className="button button-small button-ghost"
                          onClick={() => setEditing(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="target-line">
                      <a href={link.url} target="_blank" rel="noreferrer">
                        {link.url}
                      </a>
                      <span aria-hidden="true">↗</span>
                    </div>
                  )}
                </div>
                <div className="link-row-meta">
                  <span className="link-row-label">Created</span>
                  <time dateTime={link.createdAt}>
                    {new Date(link.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                  <span className="link-row-author">
                    {link.createdByLogin ? `by @${link.createdByLogin}` : "—"}
                  </span>
                </div>
                {editing !== link.code &&
                  (canModify(user, link) ? (
                    <div className="link-row-actions">
                      <button
                        className="text-action"
                        onClick={() => {
                          setEditing(link.code);
                          setEditUrl(link.url);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="text-action text-action-danger"
                        onClick={() => void remove(link.code)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    // Someone else's link: visible to everyone, theirs to change.
                    <span className="link-row-readonly">Read-only</span>
                  ))}
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
