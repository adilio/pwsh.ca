# pwsh.ca

A community-run site and URL shortener for the open-source
PowerShell community. Not affiliated with or endorsed by Microsoft.

Live at **https://pwsh.ca**.

## What's here

- A landing page: what this domain is for, where the community already
  gathers, and what lands here next.
- A URL shortener: every `pwsh.ca/<code>` is a redirect stored in Netlify
  Blobs. Following a link is public; creating one needs the admin token.
- An admin portal at `/admin` for creating, editing, and deleting links.

## Using the shortener

Anyone can follow a short link at `https://pwsh.ca/<code>`. Creating and
managing links requires the shared admin token. Keep that token private: it
grants access to every link in the service.

### Admin UI

The browser interface is the simplest option for day-to-day management:

1. Open [pwsh.ca/admin](https://pwsh.ca/admin).
2. Enter the admin token. The token is stored only in that browser's local
   storage until you select **Sign out** or clear the site's browser data.
3. To create a link, enter an absolute `http://` or `https://` destination.
   Optionally choose a custom code; leaving it blank generates a random
   six-character code.
4. Select a short code in the link list to copy its full URL.
5. Use **Edit** to repoint an existing code or **Delete** to remove it.

Custom codes are 1–64 characters and may contain letters, numbers, hyphens,
and underscores. Reserved site paths such as `admin`, `api`, and `assets`
cannot be used. A code cannot currently be renamed: create the replacement
code, update anything that uses the old URL, and then delete the old code.

### REST API

The same operations are available over JSON HTTP endpoints for scripts and
integrations. All management requests require the token as a bearer token:

```http
Authorization: Bearer <ADMIN_TOKEN>
```

For shell examples, put the token in an environment variable so each request
does not repeat it:

```bash
export ADMIN_TOKEN='<your admin token>'
```

Create a link with a custom code:

```bash
curl --fail-with-body https://pwsh.ca/api/shorten \
  --request POST \
  --header "Authorization: Bearer $ADMIN_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{"url":"https://learn.microsoft.com/powershell/","code":"docs"}'
```

Omit `code` to generate one automatically:

```bash
curl --fail-with-body https://pwsh.ca/api/shorten \
  --request POST \
  --header "Authorization: Bearer $ADMIN_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{"url":"https://learn.microsoft.com/powershell/"}'
```

List links, retrieve one link, change its destination, or delete it:

```bash
# List every link, newest first
curl --fail-with-body https://pwsh.ca/api/links \
  --header "Authorization: Bearer $ADMIN_TOKEN"

# Retrieve one link
curl --fail-with-body https://pwsh.ca/api/links/docs \
  --header "Authorization: Bearer $ADMIN_TOKEN"

# Repoint an existing code
curl --fail-with-body https://pwsh.ca/api/links/docs \
  --request PATCH \
  --header "Authorization: Bearer $ADMIN_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{"url":"https://learn.microsoft.com/powershell/scripting/"}'

# Delete a link
curl --fail-with-body https://pwsh.ca/api/links/docs \
  --request DELETE \
  --header "Authorization: Bearer $ADMIN_TOKEN"
```

Public clients can inspect one code without an admin token:

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
| `POST` | `/api/shorten` | Create a random or custom short link | Admin |
| `GET` | `/api/links` | List every link | Admin |
| `GET` | `/api/links/:code` | Retrieve one link | Admin |
| `PATCH` | `/api/links/:code` | Change a link's destination | Admin |
| `DELETE` | `/api/links/:code` | Delete a link | Admin |
| `GET` | `/api/info/:code` | Look up a link and its metadata | Public |
| `GET` | `/:code` | Redirect to the destination | Public |

See [`docs/API.md`](docs/API.md) for the compact endpoint reference.

## Stack

React 19 + Vite SPA, Netlify Functions for the API, Netlify Blobs (store
`links`) for storage. No database, no framework beyond the router.

```
src/                 the SPA (routes, components, styles.css design system)
netlify/functions/   shorten, links, info, redirect
netlify/lib/         auth, store, validator, generator, http envelope
tests/               vitest suites for the API's pure logic
docs/API.md          the REST surface
```

## Local development

```bash
npm install
npm run dev          # netlify dev: SPA + functions + Blobs together
npm run ci:verify    # typecheck, lint, test, build — what CI runs
```

`npm run dev` needs an `ADMIN_TOKEN` for the write endpoints. Put one in a
gitignored `.env`:

```
ADMIN_TOKEN=<a long random string>
```

The production value lives in Netlify's environment variables; rotate it with
`netlify env:set ADMIN_TOKEN <new value>`.

## Deploys

`main` auto-deploys to Netlify. CI (`.github/workflows/ci.yml`) runs
typecheck, lint, tests, and a production build on every push and PR.

## License

MIT
