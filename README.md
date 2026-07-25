# pwsh.ca

A community-run placeholder site and URL shortener for the open-source
PowerShell community. Not affiliated with or endorsed by Microsoft.

Live at **https://pwsh.ca**.

## What's here

- A landing page: what this domain is for, where the community already
  gathers, and what lands here next.
- A URL shortener: every `pwsh.ca/<code>` is a redirect stored in Netlify
  Blobs. Following a link is public; creating one needs the admin token.
- An admin portal at `/admin` for creating, editing, and deleting links.

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
