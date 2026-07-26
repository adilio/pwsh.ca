import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type ApiKey, type MintedKey } from "../lib/api";

/**
 * Personal API keys, for scripts and CI. A minted key is shown exactly once —
 * the server only ever stores its hash, so there is no way to show it again.
 */
export function ApiKeysPanel({ onAuthLost }: { onAuthLost: () => void }) {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [label, setLabel] = useState("");
  const [minted, setMinted] = useState<MintedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback(
    (e: unknown, fallback: string) => {
      if (e instanceof ApiError && e.status === 401) return onAuthLost();
      setError(e instanceof ApiError ? e.message : fallback);
    },
    [onAuthLost],
  );

  const refresh = useCallback(async () => {
    try {
      setKeys(await api.keys());
      setError(null);
    } catch (e) {
      fail(e, "Could not load your API keys.");
    }
  }, [fail]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function mint(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setMinted(await api.mintKey(label.trim() || "Untitled key"));
      setCopied(false);
      setLabel("");
      await refresh();
    } catch (e) {
      fail(e, "Could not create a key.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(key: ApiKey) {
    if (
      !window.confirm(
        `Revoke “${key.label}”? Anything using it stops working immediately.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await api.revokeKey(key.hash);
      if (minted?.hash === key.hash) setMinted(null);
      await refresh();
    } catch (e) {
      fail(e, "Could not revoke that key.");
    }
  }

  async function copyKey() {
    if (!minted) return;
    await navigator.clipboard.writeText(minted.key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Your API keys</h2>
          <p>
            For scripts and CI. Send one as{" "}
            <code>Authorization: Bearer …</code>.
          </p>
        </div>
      </div>

      <form onSubmit={mint} className="key-form">
        <label className="field-group">
          <span className="field-label">
            Label <span>Optional</span>
          </span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Laptop, deploy pipeline, …"
            maxLength={60}
          />
        </label>
        <button className="button button-primary" disabled={busy}>
          {busy ? "Generating…" : "Generate key"}
        </button>
      </form>

      {minted && (
        <div className="key-reveal" role="alert">
          <div className="key-reveal-heading">
            <strong>Copy this key now.</strong>
            <span>
              It is stored only as a hash — this is the one time it can be shown.
            </span>
          </div>
          <div className="key-reveal-row">
            <code className="key-plaintext">{minted.key}</code>
            <button
              className="button button-small button-primary"
              onClick={() => void copyKey()}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button className="text-action" onClick={() => setMinted(null)}>
            Done — hide it
          </button>
        </div>
      )}

      <div className="message-region" aria-live="polite">
        {error && (
          <p className="form-message form-error" role="alert">
            {error}
          </p>
        )}
      </div>

      {keys === null ? (
        <div className="admin-empty admin-loading">
          <span className="loading-dot" aria-hidden="true" />
          Loading keys…
        </div>
      ) : keys.length === 0 ? (
        <p className="panel-empty">No keys yet.</p>
      ) : (
        <div className="key-list">
          {keys.map((key) => (
            <article className="key-row" key={key.hash}>
              <div className="key-row-main">
                <strong>{key.label}</strong>
                <code className="key-prefix">{key.prefix}…</code>
              </div>
              <span className="key-row-meta">
                Created{" "}
                {new Date(key.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
                {key.lastUsedAt
                  ? ` · last used ${new Date(key.lastUsedAt).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" },
                    )}`
                  : " · never used"}
              </span>
              <button
                className="text-action text-action-danger"
                onClick={() => void revoke(key)}
              >
                Revoke
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
