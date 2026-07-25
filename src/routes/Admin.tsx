import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Logo } from "../components/Logo";
import { api, ApiError, type LinkRow } from "../lib/api";

const TOKEN_KEY = "pwsh-admin-token";

export default function Admin() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY),
  );

  if (!token) {
    return (
      <TokenGate
        onAuthorized={(t) => {
          localStorage.setItem(TOKEN_KEY, t);
          setToken(t);
        }}
      />
    );
  }

  return (
    <LinkManager
      token={token}
      onSignOut={() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }}
    />
  );
}

function TokenGate({ onAuthorized }: { onAuthorized: (t: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const candidate = value.trim();
    if (!candidate) return;
    setBusy(true);
    setError(null);
    try {
      await api.list(candidate); // proves the token against the API
      onAuthorized(candidate);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "That token was rejected."
          : "Could not reach the API. Try again.",
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
        <h1>Short links, kept simple.</h1>
        <p className="admin-sub">
          Use your admin token to create, update, and tidy up pwsh.ca links.
        </p>
        <form onSubmit={submit} className="gate-form">
          <label className="field-label" htmlFor="admin-token">
            Admin token
          </label>
          <div className="gate-input-row">
            <input
              id="admin-token"
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste your token"
              autoComplete="current-password"
              autoFocus
            />
            <button
              className="button button-primary"
              disabled={busy || !value.trim()}
            >
              {busy ? "Checking…" : "Enter workspace"}
            </button>
          </div>
        </form>
        {error && (
          <p className="form-message form-error" role="alert">
            {error}
          </p>
        )}
        <p className="gate-footnote">Your token stays in this browser.</p>
      </div>
    </section>
  );
}

function LinkManager({
  token,
  onSignOut,
}: {
  token: string;
  onSignOut: () => void;
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
        onSignOut();
        return;
      }
      setError(err instanceof ApiError ? err.message : fallback);
    },
    [onSignOut],
  );

  const refresh = useCallback(async () => {
    try {
      setLinks(await api.list(token));
      setError(null);
    } catch (err) {
      fail(err, "Could not load links.");
    }
  }, [token, fail]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const made = await api.create(
        token,
        newUrl.trim(),
        newCode.trim() || undefined,
      );
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
      await api.update(token, code, editUrl.trim());
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
      await api.remove(token, code);
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
    window.setTimeout(
      () => setCopied((c) => (c === code ? null : c)),
      400,
    );
  }

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
          {links !== null && (
            <span className="link-count">
              <strong>{links.length}</strong> {links.length === 1 ? "link" : "links"}
            </span>
          )}
          <button className="button button-ghost" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="create-panel">
        <div className="create-panel-heading">
          <div>
            <h2>Create a short link</h2>
            <p>Paste a destination and choose a memorable ending if you want one.</p>
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
          <strong>Your link shelf is empty.</strong>
          <span>Create the first one above—it only takes a destination.</span>
        </div>
      ) : (
        <div className="links-section">
          <div className="links-section-heading">
            <h2>Your links</h2>
            <p>Click a short code to copy it.</p>
          </div>
          <div className="links-list">
            {links.map((link) => (
              <article className="link-row" key={link.code}>
                <div className="link-row-code">
                  <span className="link-row-label">Short link</span>
                  <div className="short-link-line">
                    <span className="short-link-host">{window.location.host}</span>
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
                </div>
                {editing !== link.code && (
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
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
