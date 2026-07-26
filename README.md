# pwsh.ca

A community-run site and URL shortener for the open-source
PowerShell community. Not affiliated with or endorsed by Microsoft.

Live at **https://pwsh.ca**.

## What's here

- A landing page: what this domain is for, where the community already
  gathers, and what lands here next.
- A URL shortener: every `pwsh.ca/<code>` is a redirect stored in Netlify
  Blobs. Following a link is public; managing links needs an approved account.
- An admin portal at `/admin` for creating, editing, and deleting links, and
  for approving the people who help maintain them.

## Who can manage links

Anyone can follow a short link at `https://pwsh.ca/<code>`. Managing links is
invite-based:

1. Someone signs in at [pwsh.ca/admin](https://pwsh.ca/admin) with GitHub and
   requests access.
2. The site owner sees the request under **Members** and approves or denies it.
3. Once approved, they manage links under their own identity — in the browser,
   or from scripts with a personal API key they generate themselves.

There are three roles:

| Role | Can |
| --- | --- |
| **Member** | Create links, and manage the ones they created |
| **Admin** | Manage **every** link, whoever made it |
| **Super admin** | Everything, plus approving people and setting their roles |

Everyone approved sees every link; a link someone else owns shows as read-only
unless you're an admin. Every link records who made it.

You are the super admin — whoever `OWNER_GITHUB_LOGIN` names. That account is
approved automatically on first sign-in, there is exactly one of it, and the
role cannot be granted through the UI or the API. New accounts arrive as
members; promote them from the **Members** tab.

### Admin UI

1. Open [pwsh.ca/admin](https://pwsh.ca/admin) and select **Sign in with
   GitHub**. We read your GitHub username and verified email, nothing else.
2. On the **Links** tab, enter an absolute `http://` or `https://`
   destination. Optionally choose a custom code; leaving it blank generates a
   random six-character code.
3. Select a short code in the link list to copy its full URL.
4. Use **Edit** to repoint one of your codes or **Delete** to remove it. Links
   created by someone else are listed as read-only.
5. The **API keys** tab generates keys for scripts. A key is shown once, when
   it is created — only its hash is stored, so it cannot be shown again.
   Generate a new one if you lose it.
6. The **Members** tab (super admin only) is where access requests are approved
   or denied, roles are set with **Make admin** / **Demote to member**, and
   access is withdrawn. Removing or denying someone revokes their API keys
   immediately.

Custom codes are 1–64 characters and may contain letters, numbers, hyphens,
and underscores. Reserved site paths such as `admin`, `api`, and `assets`
cannot be used. A code cannot currently be renamed: create the replacement
code, update anything that uses the old URL, and then delete the old code.

### REST API

The same operations are available over JSON HTTP endpoints for scripts and
integrations. Management requests carry your personal API key as a bearer
token:

```http
Authorization: Bearer <your pwsh_… key>
```

For shell examples, put the key in an environment variable so each request does
not repeat it:

```bash
export PWSH_API_KEY='<the key you generated in /admin>'
```

Create a link with a custom code:

```bash
curl --fail-with-body https://pwsh.ca/api/shorten \
  --request POST \
  --header "Authorization: Bearer $PWSH_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{"url":"https://learn.microsoft.com/powershell/","code":"docs"}'
```

Omit `code` to generate one automatically:

```bash
curl --fail-with-body https://pwsh.ca/api/shorten \
  --request POST \
  --header "Authorization: Bearer $PWSH_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{"url":"https://learn.microsoft.com/powershell/"}'
```

List links, retrieve one link, change its destination, or delete it:

```bash
# List every link, newest first
curl --fail-with-body https://pwsh.ca/api/links \
  --header "Authorization: Bearer $PWSH_API_KEY"

# Retrieve one link
curl --fail-with-body https://pwsh.ca/api/links/docs \
  --header "Authorization: Bearer $PWSH_API_KEY"

# Repoint an existing code
curl --fail-with-body https://pwsh.ca/api/links/docs \
  --request PATCH \
  --header "Authorization: Bearer $PWSH_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{"url":"https://learn.microsoft.com/powershell/scripting/"}'

# Delete a link
curl --fail-with-body https://pwsh.ca/api/links/docs \
  --request DELETE \
  --header "Authorization: Bearer $PWSH_API_KEY"
```

Public clients can inspect one code without any credential:

```bash
curl --fail-with-body https://pwsh.ca/api/info/docs
```

The API returns a consistent response envelope:

```json
{
  "success": true,
  "data": {
    "code": "docs",
    "url": "https://learn.microsoft.com/powershell/",
    "createdAt": "2026-07-25T00:00:00.000Z"
  }
}
```

Errors include a stable machine-readable code and a human-readable message:

```json
{
  "success": false,
  "error": {
    "code": "code_taken",
    "message": "\"docs\" is already in use."
  }
}
```

| Method | Path | Purpose | Access |
| --- | --- | --- | --- |
| `POST` | `/api/shorten` | Create a random or custom short link | Member |
| `GET` | `/api/links` | List every link | Member |
| `GET` | `/api/links/:code` | Retrieve one link | Member |
| `PATCH` | `/api/links/:code` | Change a link's destination | Creator or admin |
| `DELETE` | `/api/links/:code` | Delete a link | Creator or admin |
| `GET` | `/api/keys` | List your API keys | Member |
| `POST` | `/api/keys` | Mint an API key | Member |
| `DELETE` | `/api/keys/:hash` | Revoke an API key | Member |
| `GET` | `/api/members` | List accounts and pending requests | Super admin |
| `PATCH` | `/api/members/:id` | Approve, deny, or set a role | Super admin |
| `DELETE` | `/api/members/:id` | Remove a member and their keys | Super admin |
| `GET` | `/api/auth/me` | Current identity and access status | Signed in |
| `GET` | `/api/info/:code` | Look up a link and its metadata | Public |
| `GET` | `/:code` | Redirect to the destination | Public |

See [`docs/API.md`](docs/API.md) for the compact endpoint reference.

## Stack

React 19 + Vite SPA, Netlify Functions for the API, Netlify Blobs (stores
`links`, `users`, `keys`) for storage. GitHub OAuth for sign-in, with sessions
carried in a signed `HttpOnly` cookie. No database, no auth library, no
framework beyond the router.

```
src/                 the SPA (routes, components, styles.css design system)
netlify/functions/   shorten, links, info, redirect, auth, members, keys
netlify/lib/         auth, session, oauth, users, keys, store, validator,
                     generator, http envelope
tests/               vitest suites for the API's pure logic
docs/API.md          the REST surface
```

## Local development

```bash
npm install
npm run dev          # netlify dev: SPA + functions + Blobs together
npm run ci:verify    # typecheck, lint, test, build — what CI runs
```

Copy [`.env.example`](.env.example) to a gitignored `.env` and fill it in.
Sign-in needs a GitHub OAuth app; because an OAuth app allows only one callback
URL, register a separate one for local development pointing at
`http://localhost:8888/api/auth/callback`.

| Variable | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | The GitHub OAuth app |
| `SESSION_SECRET` | Signs session cookies. Rotating it signs everyone out |
| `OWNER_GITHUB_LOGIN` | Your GitHub username — auto-approved as super admin |
| `ADMIN_TOKEN` | Optional break-glass token with super admin rights |

Production values live in Netlify's environment variables; set them with
`netlify env:set <NAME> <value>`.

## Deploys

`main` auto-deploys to Netlify. CI (`.github/workflows/ci.yml`) runs
typecheck, lint, tests, and a production build on every push and PR.

## License

MIT
