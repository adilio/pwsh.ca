import { useCallback, useEffect, useState } from "react";
import {
  api,
  ApiError,
  ROLE_LABEL,
  type AssignableRole,
  type Member,
} from "../lib/api";

/**
 * Owner-only roster: pending access requests to act on, then everyone who
 * already has access.
 */
export function MembersPanel({ onAuthLost }: { onAuthLost: () => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const fail = useCallback(
    (e: unknown, fallback: string) => {
      if (e instanceof ApiError && e.status === 401) return onAuthLost();
      setError(e instanceof ApiError ? e.message : fallback);
    },
    [onAuthLost],
  );

  const refresh = useCallback(async () => {
    try {
      setMembers(await api.members());
      setError(null);
    } catch (e) {
      fail(e, "Could not load members.");
    }
  }, [fail]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function decide(m: Member, status: "approved" | "denied") {
    setBusy(m.id);
    setError(null);
    setNotice(null);
    try {
      await api.decide(m.id, status);
      setNotice(
        status === "approved"
          ? `Approved ${m.githubLogin}.`
          : `Denied ${m.githubLogin}.`,
      );
      await refresh();
    } catch (e) {
      fail(e, "Could not update that request.");
    } finally {
      setBusy(null);
    }
  }

  async function setRole(m: Member, role: AssignableRole) {
    if (
      role === "admin" &&
      !window.confirm(
        `Make ${m.githubLogin} an admin? They'll be able to repoint and delete ` +
          `every link, including yours. They still won't be able to approve ` +
          `people or change roles.`,
      )
    ) {
      return;
    }
    setBusy(m.id);
    setError(null);
    setNotice(null);
    try {
      await api.setRole(m.id, role);
      setNotice(
        role === "admin"
          ? `${m.githubLogin} is now an admin.`
          : `${m.githubLogin} is now a member.`,
      );
      await refresh();
    } catch (e) {
      fail(e, "Could not change that role.");
    } finally {
      setBusy(null);
    }
  }

  async function revoke(m: Member) {
    if (
      !window.confirm(
        `Remove ${m.githubLogin}? Their API keys stop working immediately.`,
      )
    ) {
      return;
    }
    setBusy(m.id);
    setError(null);
    setNotice(null);
    try {
      const res = await api.removeMember(m.id);
      setNotice(
        `Removed ${m.githubLogin}` +
          (res.keysRevoked ? ` and revoked ${res.keysRevoked} key(s).` : "."),
      );
      await refresh();
    } catch (e) {
      fail(e, "Could not remove that member.");
    } finally {
      setBusy(null);
    }
  }

  if (members === null) {
    return (
      <section className="panel">
        <div className="admin-empty admin-loading">
          <span className="loading-dot" aria-hidden="true" />
          Loading members…
        </div>
      </section>
    );
  }

  const pending = members.filter((m) => m.status === "pending");
  const active = members.filter((m) => m.status !== "pending");

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Access requests</h2>
          <p>People who signed in with GitHub and asked to manage links.</p>
        </div>
        {pending.length > 0 && (
          <span className="pending-badge">
            <strong>{pending.length}</strong> waiting
          </span>
        )}
      </div>

      <div className="message-region" aria-live="polite">
        {notice && <p className="form-message form-notice">{notice}</p>}
        {error && (
          <p className="form-message form-error" role="alert">
            {error}
          </p>
        )}
      </div>

      {pending.length === 0 ? (
        <p className="panel-empty">No requests waiting on you.</p>
      ) : (
        <div className="member-list">
          {pending.map((m) => (
            <article className="member-row member-row-pending" key={m.id}>
              <MemberIdentity member={m} />
              {m.reason && <p className="member-reason">“{m.reason}”</p>}
              <div className="member-actions">
                <button
                  className="button button-small button-primary"
                  onClick={() => void decide(m, "approved")}
                  disabled={busy === m.id}
                >
                  Approve
                </button>
                <button
                  className="button button-small button-ghost"
                  onClick={() => void decide(m, "denied")}
                  disabled={busy === m.id}
                >
                  Deny
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {active.length > 0 && (
        <>
          <div className="panel-subheading">
            <h3>Who has access</h3>
            <p>
              Members manage the links they created. Admins manage every link.
              Only you can approve people and change roles.
            </p>
          </div>
          <div className="member-list">
            {active.map((m) => (
              <article className="member-row" key={m.id}>
                <MemberIdentity member={m} />
                <span
                  className={
                    m.status === "denied"
                      ? "member-status member-status-denied"
                      : `member-status member-role-${m.role}`
                  }
                >
                  {m.status === "denied" ? "Denied" : ROLE_LABEL[m.role]}
                </span>
                {m.role !== "owner" && (
                  <div className="member-actions">
                    {m.status === "denied" ? (
                      <button
                        className="text-action"
                        onClick={() => void decide(m, "approved")}
                        disabled={busy === m.id}
                      >
                        Approve
                      </button>
                    ) : m.role === "admin" ? (
                      <button
                        className="text-action"
                        onClick={() => void setRole(m, "member")}
                        disabled={busy === m.id}
                      >
                        Demote to member
                      </button>
                    ) : (
                      <button
                        className="text-action"
                        onClick={() => void setRole(m, "admin")}
                        disabled={busy === m.id}
                      >
                        Make admin
                      </button>
                    )}
                    <button
                      className="text-action text-action-danger"
                      onClick={() => void revoke(m)}
                      disabled={busy === m.id}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function MemberIdentity({ member }: { member: Member }) {
  return (
    <div className="member-identity">
      {member.avatarUrl && (
        <img
          className="member-avatar"
          src={member.avatarUrl}
          alt=""
          width={36}
          height={36}
        />
      )}
      <div className="member-names">
        <strong>{member.name || member.githubLogin}</strong>
        <span className="member-meta">
          @{member.githubLogin}
          {member.email && <> · {member.email}</>}
        </span>
      </div>
    </div>
  );
}
