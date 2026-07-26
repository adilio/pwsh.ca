# pwsh.ca API

Every response uses the same envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "invalid_url", "message": "..." } }
```

## Authentication

Management endpoints accept either credential:

- **A personal API key** — `Authorization: Bearer pwsh_…`. Generate one in
  `/admin` once your access is approved. Best for scripts and CI.
- **A session cookie** — set by GitHub sign-in at `/admin`. This is what the
  browser UI uses; it is `HttpOnly`, so page scripts can't read it.

`ADMIN_TOKEN`, if configured, is also accepted as a bearer token and acts as
the site owner. It is a break-glass credential, not the everyday path.

Access levels:

| Level | Who | Can |
| --- | --- | --- |
| Public | anyone | follow links, `GET /api/info/:code` |
| Member | any approved account | create links, manage the ones they created |
| Admin | a member the owner promoted | manage **every** link |
| Owner | `OWNER_GITHUB_LOGIN`, or `ADMIN_TOKEN` | everything, plus approve people and set roles |

There is exactly one owner, and the role comes from `OWNER_GITHUB_LOGIN` alone —
`role: "owner"` cannot be assigned over the API.

Unapproved accounts get `403` with code `pending_approval` or `access_denied`.

## Identity

### GET /api/auth/github

Begin GitHub sign-in. Sets a `state` nonce cookie and redirects to GitHub.

### GET /api/auth/callback

GitHub returns here. Verifies the `state` nonce, exchanges the code, creates or
refreshes the user, sets the session cookie, and redirects to `/admin`. On
failure it redirects to `/admin?error=<reason>` instead.

### GET /api/auth/me

Current identity: `{ signedIn: false }`, or `{ signedIn: true, user: {…} }` with
the user's `status` (`pending` / `approved` / `denied`) and `role`.

### POST /api/auth/logout

Clears the session cookie.

### POST /api/access/request

Attach a reason to a pending access request. Body: `{"reason":"…"}` (≤500
chars). Requires sign-in; no-ops once a decision has been made.

## Links

### POST /api/shorten

Create a short link. Member.

```bash
curl -X POST https://pwsh.ca/api/shorten \
  -H "Authorization: Bearer $PWSH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://learn.microsoft.com/powershell/","code":"docs"}'
```

`code` is optional; omit it for a random six-character Base62 code. Codes are
1–64 characters of `A-Za-z0-9_-` and may not shadow a reserved path
(`api`, `admin`, `assets`, …). Returns `201` with `{ code, url, createdAt,
createdBy, createdByLogin, shortUrl }`, or `409` if the code is taken.

### GET /api/links

List every link, newest first. Member.

### GET /api/links/:code

One link's record. Member.

### PATCH /api/links/:code

Repoint an existing code. **Its creator, an admin, or the owner.** Body:
`{"url":"https://…"}`.

### DELETE /api/links/:code

Remove a code. **Its creator, an admin, or the owner.**

Both take the same rule: every approved member can see every link, but changing
one needs authorship or a link-management role. Anyone else gets
`403 not_owner`. Links created before attribution existed have no `createdBy`,
so no member can claim them — they are left to admins and the owner.

### GET /api/info/:code

Public lookup: returns `{ code, url, createdAt }` for a code, or `404`.

### GET /:code

The redirect itself. `302` to the target with `Cache-Control: no-store`, so a
repointed link takes effect immediately. Unknown codes get a branded `404`
page.

## Members

Owner only, all of them.

### GET /api/members

Everyone who has signed in, pending requests first.

### PATCH /api/members/:id

Decide a request and/or set a role. Either field may be sent, or both:

```json
{ "status": "approved", "role": "admin" }
```

`status` is `approved` or `denied`; `role` is `admin` or `member`. Denying also
revokes that member's API keys. Sending neither field is `400 nothing_to_do`;
`role: "owner"` is `400 invalid_role`. The owner's own record cannot be changed
(`400 owner_immutable`).

### DELETE /api/members/:id

Remove a member and revoke their keys. Returns `{ id, deleted, keysRevoked }`.

## API keys

### GET /api/keys

Your own keys — label, prefix, and timestamps. The key itself is never
returned; only its SHA-256 hash is stored.

### POST /api/keys

Mint a key. Body: `{"label":"deploy pipeline"}` (optional). The response is the
**only** place the plaintext `key` appears. Limit of 10 keys per member
(`409 key_limit`).

### DELETE /api/keys/:hash

Revoke a key by its hash. Yours, or any key if you are the owner.
